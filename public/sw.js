/* DTS-Calc service worker. Plain JS, no build step.
 *
 * Cache policy (keep in sync with lib/pure/swCacheStrategy.ts):
 * - Navigations: stale-while-revalidate, keyed by pathname only. /about?edit=<id>
 *   reuses the cached /about document and paints Focus directly. The note id is
 *   not a cache key, and it is not written into that shared shell: a visit with
 *   ?edit= stores the pathname document, not the id-specific response.
 * - Nothing cached for that pathname: wait for the network. Do not substitute
 *   the home document. Offline with no cache for that path returns an error.
 * - /_next/static/*: cache-first (content-hashed, immutable)
 * - favicon / manifest: stale-while-revalidate
 * - Flight / RSC: network only. Never cache a URL with an _rsc query param, an
 *   RSC: 1 header, or a Next-Router-Prefetch / Next-Router-State-Tree header.
 *   A non-navigation GET that carries ?edit= is network-only too.
 *
 * Install reads /sw-precache.json (written by scripts/write-sw-precache.mjs)
 * and fills a staging cache, never the live one. The live name is
 * dts-calc-v8 plus CACHE_BUILD. The build script replaces CACHE_BUILD with a
 * hash of this file and the precache manifest. A failed install deletes only
 * that staging cache. skipWaiting runs only after the staging cache is
 * complete. Activate copies it onto the live name and deletes the staging
 * cache only after the live cache contains every precache URL, which always
 * includes `/`. The shell documents every shell page are
 * copied as one set: if any one fails, that set is not left half-written.
 * A staging cache missing any of those pages is never promoted and is not
 * read, so offline `/` cannot come from a different build than the other shell pages.
 * Once this worker is already active, startup runs that copy again while the
 * staging cache exists, so a quota error during activate is retried the next
 * time the worker starts. An install still in progress is left alone. A
 * failed check keeps staging and the previous caches, so an offline launch
 * still has a shell. Until the copy finishes, navigations and shell lookups
 * read the live cache, then a complete staging cache, then the newest older dts-calc-v* cache.
 * There is no file-count cap.
 * A failed install waits before the next full download (dts-calc-install-backoff).
 * Backoff records for other builds are deleted.
 *
 * Install records every open tab (clients.matchAll({ includeUncontrolled: true })).
 * Those ids are the previous build. Activate does not rebuild that list:
 * Chromium already counts those tabs as this worker's during activate, so a
 * diff against clients.matchAll() is empty and would purge immediately.
 * Older caches stay until every recorded tab is gone. Activating this worker
 * does not reload an open tab; the new shell is used on the next reload.
 * /_next/static lookups read the live cache, then a complete staging cache, then older caches. A finished live cache
 * is the only HTML shell a navigation uses. While a complete staging cache is still present the
 * live cache may be partial, so a navigation can use that staging cache or an older shell
 * instead of failing offline. A staging cache missing a shell page is skipped.
 * A shell is stored only when each asset it names
 * is already in the cache being written or can be fetched.
 */
const CACHE_VERSION = 'dts-calc-v8'
const CACHE_BUILD = '__STARTER_CACHE_BUILD__'
const LIVE_CACHE = `${CACHE_VERSION}-${CACHE_BUILD}`
const STAGING_CACHE = `${LIVE_CACHE}-staging`
const BACKOFF_CACHE = 'dts-calc-install-backoff'
const CLIENT_CACHE = 'dts-calc-clients'
const PRECACHE_MANIFEST = '/sw-precache.json'
const SHELL_PAGES = ['/']
const SHELL_ASSETS = ['/', '/assets/dts-calc-favicon.svg', '/manifest.json']
const INSTALL_BACKOFF_START_MS = 30 * 1000
const INSTALL_BACKOFF_MAX_MS = 15 * 60 * 1000
const SHELL_REFRESH_MS = 60 * 1000
const OLD_CLIENTS_URL = 'http://localhost/__dts_calc_old_clients'
const shellRefreshState = new Map()

function isHashedNextStatic(pathname) {
  return pathname.startsWith('/_next/static/')
}

function isShellStaticAsset(pathname) {
  return pathname === '/assets/dts-calc-favicon.svg' || pathname === '/manifest.json'
}

function classifyRequest(pathname, isNavigation) {
  if (isNavigation) return 'stale-while-revalidate'
  if (isHashedNextStatic(pathname)) return 'cache-first'
  if (isShellStaticAsset(pathname)) return 'stale-while-revalidate'
  return 'network-first'
}

/**
 * Next.js RSC / flight. Mirrors lib/pure/swCacheStrategy.ts isFlightRequest.
 * Header lookup is case-insensitive on a real Headers object.
 */
function isFlightRequest(req, url) {
  if (url.searchParams.has('_rsc')) return true
  const headers = req.headers
  if (!headers || typeof headers.get !== 'function') return false
  if (headers.get('rsc') === '1') return true
  if (headers.get('next-router-prefetch') !== null) return true
  if (headers.get('next-router-state-tree') !== null) return true
  return false
}

/** Network only: flight data, or a note id that would otherwise become a cache key. */
function shouldBypassCache(req, url) {
  if (isFlightRequest(req, url)) return true
  if (req.mode !== 'navigate' && url.searchParams.has('edit')) return true
  return false
}

function reportBackgroundFailure(error) {
  console.error('dts-calc: background cache update failed', error)
}

function putIfBasicOk(cache, req, res) {
  if (res && res.ok && res.type === 'basic') {
    return Promise.resolve(cache.put(req, res.clone())).catch((error) => {
      reportBackgroundFailure(error)
    })
  }
  return Promise.resolve()
}

/** Cache Storage key for a navigation: origin + pathname, no query or hash. */
function navigationCacheKey(req) {
  const raw = typeof req === 'string' ? req : req.url
  const url = new URL(raw, self.location.origin)
  return new URL(url.pathname, self.location.origin).href
}

/**
 * Match a navigation by pathname. ignoreSearch covers a Cache entry stored
 * under another query. Never substitute a different route's document.
 */
async function matchNavigationCache(req, cache) {
  const key = navigationCacheKey(req)
  const cached = await cache.match(key, { ignoreSearch: true })
  if (cached) return cached
  const pathname = new URL(key).pathname
  return cache.match(pathname, { ignoreSearch: true })
}

/** Absolute /_next/static URLs referenced by a document or script. */
function referencedStaticUrls(html) {
  const urls = new Set()
  // Flight data escapes these paths with backslashes. A backslash is not a
  // URL character here; matching it made Cache Storage store `chunk.js/`.
  const re = /\/_next\/static\/[A-Za-z0-9._~/-]+/g
  let match
  while ((match = re.exec(html))) {
    const url = match[0].split('?')[0].split('#')[0].replace(/\/+$/, '')
    if (url.length > '/_next/static/'.length) urls.add(url)
  }
  return [...urls]
}

/**
 * Static URLs a document or chunk needs, including Turbopack's relative
 * `static/chunks|media/...` references (lazy runtime chunks, the pairing worker).
 */
function referencedBuildUrls(text) {
  const urls = new Set(referencedStaticUrls(text))
  const rel = /["'`]static\/(?:chunks|media)\/[A-Za-z0-9._~-]+/g
  let match
  while ((match = rel.exec(text))) {
    urls.add(`/_next/${match[0].slice(1)}`)
  }
  return [...urls]
}

/** Font and other url() targets inside a cached stylesheet. */
function cssAssetUrls(css, cssPath) {
  const urls = []
  const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g
  let match
  while ((match = re.exec(css))) {
    const raw = match[2].trim()
    if (!raw || raw.startsWith('data:')) continue
    const clean = raw.split('?')[0].split('#')[0]
    if (clean.startsWith('/_next/static/')) {
      urls.push(clean)
      continue
    }
    if (clean.startsWith('/')) continue
    try {
      const base = cssPath.slice(0, cssPath.lastIndexOf('/') + 1)
      const joined = new URL(clean, `http://local${base}`).pathname
      if (joined.startsWith('/_next/static/')) urls.push(joined)
    } catch {
      /* ignore malformed url() */
    }
  }
  return urls
}

async function ensureStatic(cache, url) {
  const hit = await cache.match(url)
  if (hit) return true
  try {
    const res = await fetch(url)
    if (!(res && res.ok && res.type === 'basic')) return false
    await cache.put(url, res.clone())
    return true
  } catch {
    return false
  }
}

/**
 * Fetch every static URL a document points at, then the lazy chunks and fonts
 * those files point at. A failure anywhere returns false so the caller keeps
 * the previous HTML. Unique URLs are visited once; there is no file-count cap.
 */
async function ensureStaticTree(cache, seeds) {
  const pending = [...seeds]
  const seen = new Set()
  while (pending.length) {
    const url = pending.shift()
    if (!url || seen.has(url)) continue
    seen.add(url)
    const ok = await ensureStatic(cache, url)
    if (!ok) return false
    if (!/\.(js|mjs|css)$/.test(url)) continue
    const res = await cache.match(url)
    if (!res) return false
    let text = ''
    try {
      text = await res.text()
    } catch {
      return false
    }
    if (url.endsWith('.css')) {
      for (const asset of cssAssetUrls(text, url)) {
        const assetOk = await ensureStatic(cache, asset)
        if (!assetOk) return false
      }
    }
    for (const nested of referencedBuildUrls(text)) {
      if (!seen.has(nested)) pending.push(nested)
    }
  }
  return true
}

/**
 * Store a navigation response under its pathname only when every hashed asset
 * it points at (and lazy chunks those scripts point at) is cached. A 404 or a
 * failed font leaves the previous HTML in place. Query strings are not keys.
 */
async function putNavigationIfAssetsReady(cache, req, res) {
  if (!(res && res.ok && res.type === 'basic')) return false
  // Snapshot before any await. The caller may return `res` to the page, and
  // a later clone of a consumed body throws, which used to drop the upgrade.
  let snapshot
  try {
    snapshot = res.clone()
  } catch (error) {
    reportBackgroundFailure(error)
    throw error
  }
  let html = ''
  try {
    html = await snapshot.clone().text()
  } catch (error) {
    reportBackgroundFailure(error)
    return false
  }
  const ready = await ensureStaticTree(cache, referencedBuildUrls(html))
  if (!ready) return false
  await cache.put(navigationCacheKey(req), snapshot)
  return true
}

/**
 * One canonical /about fetch at a time, and not again for SHELL_REFRESH_MS.
 * Every /about?edit= visit would otherwise download the shell in the background.
 */
function refreshCanonicalShell(cache, canonicalUrl) {
  const now = Date.now()
  const state = shellRefreshState.get(canonicalUrl)
  if (state && state.inflight) return state.inflight
  if (state && now - state.at < SHELL_REFRESH_MS) return Promise.resolve(true)
  const inflight = (async () => {
    try {
      const shellRes = await fetch(canonicalUrl, { cache: 'reload' })
      const ok = await putNavigationIfAssetsReady(cache, canonicalUrl, shellRes)
      shellRefreshState.set(canonicalUrl, { at: ok ? Date.now() : 0, inflight: null })
      return ok
    } catch {
      shellRefreshState.set(canonicalUrl, { at: 0, inflight: null })
      return false
    }
  })()
  shellRefreshState.set(canonicalUrl, { at: state ? state.at : 0, inflight })
  return inflight
}

/**
 * Persist the shared shell. A request that carries ?edit=<id> must not write
 * that response: the id would sit in the pathname entry and leak into the next
 * visit. Store a fetch of the pathname instead. `already` is the visitor's
 * response when this call already fetched it and the URL has no note id.
 */
async function storeNavigationShell(cache, req, already) {
  const raw = typeof req === 'string' ? req : req.url
  const url = new URL(raw, self.location.origin)
  if (url.searchParams.has('edit')) {
    return refreshCanonicalShell(cache, navigationCacheKey(req))
  }
  let res = already
  if (!res) {
    try {
      res = await fetch(req)
    } catch {
      return false
    }
  }
  return putNavigationIfAssetsReady(cache, req, res)
}

/**
 * Navigations: cached shell immediately, refresh in the background.
 * A shell from before the entrance script waits up to ENTRANCE_SHELL_WAIT_MS,
 * then paints the cached copy and keeps the upgrade in the background.
 * With no cache, wait for the network. A hard failure with no cache is an error.
 * The response given to the visitor is always the one for the URL they opened.
 */
async function serveNavigation(req, cache, event) {
  const cached = await matchNavigationCache(req, cache)
  const refresh = async () => {
    const res = await fetch(req)
    await storeNavigationShell(cache, req, res)
    return res
  }

  if (cached) {
    const pending = storeNavigationShell(cache, req).catch((error) => {
      reportBackgroundFailure(error)
    })
    if (event && typeof event.waitUntil === 'function') {
      event.waitUntil(pending)
    }
    return cached
  }

  try {
    return await refresh()
  } catch {
    return Response.error()
  }
}

function isVersionCache(name) {
  return name.startsWith('dts-calc-v') && !name.endsWith('-staging')
}

function isRetiredVersionCache(name) {
  return isVersionCache(name) && name !== LIVE_CACHE
}

/**
 * Caches from the plain-JS worker this one replaced (keep in sync with isLegacyDtsCalcCache in
 * lib/pure/swCacheStrategy.ts): `dts-calc-meta` and `dts-calc-<20 hex>`. The 20 hex characters
 * never match this worker's own names (`dts-calc-v8-...`, `dts-calc-clients`, `dts-calc-install-backoff`).
 */
function isLegacyCache(name) {
  return name === 'dts-calc-meta' || /^dts-calc-[0-9a-f]{20}$/.test(name)
}

/**
 * Delete the old worker's caches, but only once the live cache of this build holds the full
 * shell. Until then they stay, so a failed or partial install can never leave a device with no
 * offline shell. Safe to run again: it does nothing when there is nothing left to delete.
 */
async function deleteLegacyCaches() {
  const names = await caches.keys()
  const legacy = names.filter((name) => isLegacyCache(name))
  if (legacy.length === 0) return
  if (names.indexOf(LIVE_CACHE) === -1) return
  if (!(await liveHasPrecache(await caches.open(LIVE_CACHE), null))) return
  await Promise.all(legacy.map((name) => caches.delete(name)))
}

function isStaticAssetRequest(req) {
  const raw = typeof req === 'string' ? req : req.url
  try {
    return new URL(raw, self.location.origin).pathname.startsWith('/_next/static/')
  } catch {
    return false
  }
}

async function matchCacheName(name, req, options) {
  const cache = await caches.open(name)
  return cache.match(req, options)
}

/**
 * Staging holds a complete copy until promotion finishes. Older version caches
 * are searched newest-last in caches.keys(), which is creation order, so the
 * last one is the newest.
 */
async function stagingHasShellPages(staging) {
  for (const page of SHELL_PAGES) {
    if (!(await staging.match(page))) return false
  }
  return true
}

async function matchStagingThenOlder(req, options) {
  const names = await caches.keys()
  if (names.indexOf(STAGING_CACHE) !== -1) {
    const staging = await caches.open(STAGING_CACHE)
    // A partial staging cache is not a shell. One page from it and the rest
    // from an older build would mix two versions offline.
    if (await stagingHasShellPages(staging)) {
      const staged = await staging.match(req, options)
      if (staged) return staged
    }
  }
  const older = names.filter((name) => isRetiredVersionCache(name))
  for (let i = older.length - 1; i >= 0; i--) {
    const hit = await matchCacheName(older[i], req, options)
    if (hit) return hit
  }
  return undefined
}

/**
 * Hashed build files. Live cache, then the complete staging copy, then older
 * dts-calc-v* caches. HTML is not matched here.
 */
async function matchStaticRetained(req, options) {
  if (!isStaticAssetRequest(req)) return undefined
  const names = await caches.keys()
  if (names.indexOf(LIVE_CACHE) !== -1) {
    const liveHit = await matchCacheName(LIVE_CACHE, req, options)
    if (liveHit) return liveHit
  }
  return matchStagingThenOlder(req, options)
}

/**
 * Navigations and shell assets. A complete live cache is the only HTML source.
 * While this build's staging cache still exists, the live cache may be missing
 * entries, so a miss falls through to staging and then the newest older cache.
 */
async function matchNavigationOrShell(req, options) {
  const names = await caches.keys()
  if (names.indexOf(LIVE_CACHE) !== -1) {
    const liveHit = await matchCacheName(LIVE_CACHE, req, options)
    if (liveHit) return liveHit
  }
  if (names.indexOf(STAGING_CACHE) === -1) return undefined
  return matchStagingThenOlder(req, options)
}

function openNavigationCache() {
  return Promise.resolve({
    match(req, options) {
      return matchNavigationOrShell(req, options)
    },
    async put(req, res) {
      const live = await caches.open(LIVE_CACHE)
      await live.put(req, res)
    },
  })
}

/** Static reads may use an older build. Writes always go to the live cache. */
function staticFallbackCache() {
  return {
    match(req, options) {
      return matchStaticRetained(req, options)
    },
    async put(req, res) {
      const live = await caches.open(LIVE_CACHE)
      await live.put(req, res)
    },
  }
}

async function cacheFirst(req, cache) {
  const cached = await cache.match(req)
  if (cached) return cached
  try {
    const res = await fetch(req)
    await putIfBasicOk(cache, req, res)
    return res
  } catch {
    const fallback = await cache.match(req)
    return fallback || Response.error()
  }
}

async function staleWhileRevalidate(req, cache) {
  const cached = await cache.match(req)
  const networkPromise = fetch(req)
    .then((res) => {
      return putIfBasicOk(cache, req, res).then(() => res)
    })
    .catch(() => null)

  if (cached) {
    networkPromise.catch(() => {})
    return cached
  }

  const res = await networkPromise
  return res || Response.error()
}

/**
 * Precache the manifest and the shell. Throws precache-incomplete unless every
 * fetch is stored, so install can delete the partial cache and stay inactive.
 */
async function precacheShell(cache) {
  let manifestRes
  try {
    manifestRes = await fetch(PRECACHE_MANIFEST, { cache: 'no-store' })
  } catch {
    throw new Error('precache-incomplete')
  }
  if (!manifestRes || !manifestRes.ok) throw new Error('precache-incomplete')

  let listed
  try {
    listed = await manifestRes.json()
  } catch {
    throw new Error('precache-incomplete')
  }
  if (!Array.isArray(listed)) throw new Error('precache-incomplete')

  for (const url of listed) {
    if (typeof url !== 'string' || !url.startsWith('/_next/static/')) {
      throw new Error('precache-incomplete')
    }
    const ok = await ensureStatic(cache, url)
    if (!ok) throw new Error('precache-incomplete')
  }

  // Fetch every shell document first, then store them. A miss deletes any
  // page this attempt already wrote so staging never keeps a partial set.
  const shellResponses = []
  for (const page of SHELL_PAGES) {
    let res
    try {
      res = await fetch(page, { cache: 'reload' })
    } catch {
      throw new Error('precache-incomplete')
    }
    shellResponses.push({ page, res })
  }
  const writtenShells = []
  try {
    for (const item of shellResponses) {
      const stored = await putNavigationIfAssetsReady(cache, item.page, item.res)
      if (!stored) throw new Error('precache-incomplete')
      writtenShells.push(item.page)
    }
  } catch (error) {
    await Promise.all(writtenShells.map(async (page) => {
      try { await cache.delete(navigationCacheKey(page)) } catch { /* staging is discarded by install */ }
    }))
    throw error
  }

  for (const asset of SHELL_ASSETS) {
    if (SHELL_PAGES.indexOf(asset) !== -1) continue
    let res
    try {
      res = await fetch(asset, { cache: 'reload' })
    } catch {
      throw new Error('precache-incomplete')
    }
    if (!(res && res.ok && res.type === 'basic')) throw new Error('precache-incomplete')
    await cache.put(asset, res.clone())
  }
}

async function installBackoffActive() {
  try {
    const cache = await caches.open(BACKOFF_CACHE)
    const hit = await cache.match(`/__dts_calc_install_until/${CACHE_BUILD}`)
    if (!hit) return false
    const until = Number(await hit.text())
    return Number.isFinite(until) && Date.now() < until
  } catch {
    return false
  }
}

async function noteInstallFailure() {
  const cache = await caches.open(BACKOFF_CACHE)
  let delay = INSTALL_BACKOFF_START_MS
  try {
    const prev = await cache.match(`/__dts_calc_install_delay/${CACHE_BUILD}`)
    if (prev) {
      const parsed = Number(await prev.text())
      if (parsed > 0) delay = Math.min(parsed * 2, INSTALL_BACKOFF_MAX_MS)
    }
  } catch {
    delay = INSTALL_BACKOFF_START_MS
  }
  await cache.put(`/__dts_calc_install_until/${CACHE_BUILD}`, new Response(String(Date.now() + delay)))
  await cache.put(`/__dts_calc_install_delay/${CACHE_BUILD}`, new Response(String(delay)))
}

async function clearInstallBackoff() {
  try {
    const cache = await caches.open(BACKOFF_CACHE)
    await cache.delete(`/__dts_calc_install_until/${CACHE_BUILD}`)
    await cache.delete(`/__dts_calc_install_delay/${CACHE_BUILD}`)
  } catch {
    /* A missing backoff record does not block activation. */
  }
}

async function readOldClientIds() {
  try {
    const cache = await caches.open(CLIENT_CACHE)
    const hit = await cache.match(OLD_CLIENTS_URL)
    if (!hit) return []
    const parsed = JSON.parse(await hit.text())
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id) => typeof id === 'string')
  } catch {
    return []
  }
}

async function writeOldClientIds(ids) {
  const cache = await caches.open(CLIENT_CACHE)
  await cache.put(OLD_CLIENTS_URL, new Response(JSON.stringify(ids)))
}

/**
 * Snapshot of tabs open during install. They loaded the previous build.
 * Called from install, not activate: during activate Chromium's
 * clients.matchAll() already includes those tabs, so a diff is empty.
 * A natural navigation mints a new id. claim() lets this worker control an
 * open tab without reloading it, so that tab keeps its id and its older cache.
 */
async function noteClientsLoadedBeforeThisWorker() {
  const keys = await caches.keys()
  if (!keys.some((name) => isRetiredVersionCache(name))) {
    await writeOldClientIds([])
    return
  }
  let all
  try {
    all = await self.clients.matchAll({ includeUncontrolled: true })
  } catch {
    return
  }
  const ids = []
  for (const client of all) {
    if (client.id && ids.indexOf(client.id) === -1) ids.push(client.id)
  }
  await writeOldClientIds(ids)
}

function isForeignStaging(name) {
  return name.startsWith('dts-calc-v') && name.endsWith('-staging') && name !== STAGING_CACHE
}

/** Drop staging caches left by other builds. Keep the one this install fills. */
async function deleteForeignStaging() {
  const keys = await caches.keys()
  await Promise.all(keys.filter((key) => isForeignStaging(key)).map((key) => caches.delete(key)))
}

/** Backoff keys are per build. Records for builds that are gone are stale. */
async function deleteStaleBackoff() {
  try {
    const cache = await caches.open(BACKOFF_CACHE)
    const requests = await cache.keys()
    await Promise.all(requests.map(async (req) => {
      const path = new URL(req.url).pathname
      if (path.indexOf(CACHE_BUILD) === -1) await cache.delete(req)
    }))
  } catch {
    /* A backoff record is an optimisation. */
  }
}

/**
 * True after this worker has finished activating. During install and during
 * the activate event the state is still installing or activating, so startup
 * must not copy a staging cache that install is still filling.
 */
function thisWorkerIsActive() {
  try {
    const current = self.serviceWorker
    if (!current || !self.registration) return true
    return current.state === 'activated' && self.registration.active === current
  } catch {
    return true
  }
}

async function startupMaintenance() {
  await deleteForeignStaging()
  await deleteStaleBackoff()
  if (!thisWorkerIsActive()) return
  try {
    await deleteLegacyCaches()
  } catch {
    /* Retried the next time the worker starts. */
  }
  const names = await caches.keys()
  if (names.indexOf(STAGING_CACHE) === -1) return
  const promoted = await promoteStaging()
  if (promoted) await purgeRetiredCaches()
}

/**
 * Live must hold every URL this build precached before staging or an older
 * cache is deleted. `/` are required even when staging never
 * listed them: without those two documents the app has no offline shell.
 */
async function liveHasPrecache(live, staging) {
  const required = SHELL_PAGES.slice()
  if (staging) {
    const requests = await staging.keys()
    for (const req of requests) {
      const path = new URL(req.url).pathname
      if (required.indexOf(path) === -1) required.push(path)
    }
  }
  for (const path of required) {
    if (!(await live.match(path))) return false
  }
  return true
}

/**
 * Copy every shell page together. A failure deletes the pages this
 * attempt added so a navigation cannot prefer a half-updated shell over the
 * previous cache.
 */
async function copyShellDocuments(staging, live) {
  const pending = []
  for (const page of SHELL_PAGES) {
    if (await live.match(page)) continue
    const res = await staging.match(page)
    if (!res) return false
    pending.push({ page, res })
  }
  const written = []
  try {
    for (const item of pending) {
      await live.put(item.page, item.res.clone())
      written.push(item.page)
    }
  } catch {
    await Promise.all(written.map(async (page) => {
      try { await live.delete(page) } catch { /* the previous shell stays usable */ }
    }))
    return false
  }
  for (const page of SHELL_PAGES) {
    if (await live.match(page)) continue
    await Promise.all(written.map(async (pageToDrop) => {
      try { await live.delete(pageToDrop) } catch { /* the previous shell stays usable */ }
    }))
    return false
  }
  return true
}

/**
 * Copy staging onto the live name. Returns true only when the live cache
 * contains every precache URL (at least `/`) and staging has
 * been deleted. A throw, a missing shell, or a failed check leaves staging
 * and the previous caches in place so the next startup can retry.
 * A staging cache missing a shell page returns before anything is
 * copied. Install never writes the live cache itself.
 */
async function promoteStaging() {
  invalidatePurgeCheck()
  const names = await caches.keys()
  const live = await caches.open(LIVE_CACHE)
  if (names.indexOf(STAGING_CACHE) === -1) return liveHasPrecache(live, null)
  const staging = await caches.open(STAGING_CACHE)
  if (!(await stagingHasShellPages(staging))) return false
  const requests = await staging.keys()
  try {
    for (const req of requests) {
      const path = new URL(req.url).pathname
      if (SHELL_PAGES.indexOf(path) !== -1) continue
      if (await live.match(req)) continue
      const res = await staging.match(req)
      if (!res) return false
      await live.put(req, res.clone())
    }
    if (!(await copyShellDocuments(staging, live))) return false
    if (!(await liveHasPrecache(live, staging))) return false
  } catch {
    return false
  }
  if (!(await liveHasPrecache(live, staging))) return false
  await caches.delete(STAGING_CACHE)
  const after = await caches.keys()
  if (after.indexOf(STAGING_CACHE) !== -1) return false
  return liveHasPrecache(await caches.open(LIVE_CACHE), null)
}

/**
 * Drop older version caches only after the live cache has the full staged
 * set and every tab recorded at install is gone. Static lookups still read
 * the older caches until then.
 *
 * `settled` skips the cache lookup until activate or promote. `names` is that
 * list while retired caches are waiting for a tab to close: the client list
 * is read again, the cache names are not.
 */
let purgeCheck = null

function invalidatePurgeCheck() {
  purgeCheck = null
}

async function purgeRetiredCaches() {
  if (purgeCheck === 'settled') return
  let names
  if (purgeCheck && purgeCheck.names) {
    names = purgeCheck.names
  } else {
    names = await caches.keys()
    const retired = names.some((key) => isRetiredVersionCache(key))
    const ready = names.indexOf(STAGING_CACHE) === -1
      && retired
      && await liveHasPrecache(await caches.open(LIVE_CACHE), null)
    if (!ready) {
      purgeCheck = 'settled'
      return
    }
    purgeCheck = { names }
  }
  let all
  try {
    all = await self.clients.matchAll({ includeUncontrolled: true })
  } catch {
    return
  }
  const alive = new Set(all.map((client) => client.id))
  const still = (await readOldClientIds()).filter((id) => alive.has(id))
  await writeOldClientIds(still)
  if (still.length > 0) return
  await Promise.all(names.filter((key) => isRetiredVersionCache(key)).map((key) => caches.delete(key)))
  purgeCheck = 'settled'
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    if (await installBackoffActive()) throw new Error('precache-backoff')
    // Staging only. A previous attempt's partial staging is discarded here.
    // The live cache is a different name and is not opened.
    await caches.delete(STAGING_CACHE)
    const cache = await caches.open(STAGING_CACHE)
    try {
      await precacheShell(cache)
      await clearInstallBackoff()
      await noteClientsLoadedBeforeThisWorker()
      await self.skipWaiting()
    } catch (error) {
      try {
        await caches.delete(STAGING_CACHE)
      } catch {
        /* Install still fails, so this staging cache is not promoted. */
      }
      try {
        await noteInstallFailure()
      } catch {
        /* The backoff record is an optimisation. The install still fails. */
      }
      throw error
    }
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    invalidatePurgeCheck()
    await startupMaintenance()
    const promoted = await promoteStaging()
    try {
      await self.clients.claim()
    } catch {
      /* claim is missing on very old browsers; old-client tracking still applies. */
    }
    if (promoted) await purgeRetiredCaches()
    try {
      await deleteLegacyCaches()
    } catch {
      /* Retried the next time the worker starts. */
    }
  })())
})

function handleFetch(req, event) {
  if (req.method !== 'GET') return null

  let url
  try {
    url = new URL(req.url)
  } catch {
    return null
  }
  if (url.origin !== self.location.origin) return null
  if (url.pathname.startsWith('/api/')) return null
  if (shouldBypassCache(req, url)) return fetch(req)

  const isNavigation = req.mode === 'navigate'
  const strategy = classifyRequest(url.pathname, isNavigation)

  if (isNavigation) {
    return openNavigationCache().then((cache) => serveNavigation(req, cache, event))
  }
  if (strategy === 'cache-first') return cacheFirst(req, staticFallbackCache())
  const live = openNavigationCache()
  if (strategy === 'stale-while-revalidate') {
    return live.then((cache) => staleWhileRevalidate(req, cache))
  }
  return fetch(req).then(
    async (res) => {
      await putIfBasicOk(await live, req, res)
      return res
    },
    async () => {
      if (!isHashedNextStatic(url.pathname)) return Response.error()
      const cached = await matchStaticRetained(req)
      return cached || Response.error()
    }
  )
}

self.addEventListener('fetch', (event) => {
  const pending = handleFetch(event.request, event)
  if (!pending) return
  event.respondWith(pending)
  if (typeof event.waitUntil === 'function') {
    event.waitUntil(purgeRetiredCaches().catch(() => {}))
  }
})

const startupDone = startupMaintenance()
