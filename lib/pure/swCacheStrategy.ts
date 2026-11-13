/**
 * Service worker cache policy.
 *
 * Canonical classification for tests and docs. Keep `public/sw.js` in sync —
 * the SW is plain JS with no build step, so it cannot import this module.
 *
 * Navigations are stale-while-revalidate and cached by pathname only, so
 * `/?edit=<id>` reuses the `/` shell. The stored shell is the pathname document, so
 * the id is not written into that shared entry either. A cached shell paints
 * immediately and the network copy is stored in the background. That copy is
 * kept only when every hashed asset it references — including lazy chunks
 * those scripts point at — is in the cache. There is no numeric cap on that
 * walk or on the install precache: both follow the full `.next/static` set.
 * A pathname with nothing cached waits for the network. It is not replaced
 * with the home document. Offline with nothing cached for that path is an error.
 *
 * Install is all-or-nothing and writes a staging cache, never the live one.
 * A failed precache deletes that staging cache and does not activate. The live
 * name is `dts-calc-v8` plus a build id that `scripts/write-sw-precache.mjs`
 * writes into gitignored `public/sw.generated.js` from a hash of the worker
 * and the precache list. The site serves that file at `/sw.js`. Activate and
 * startup copy staging onto the live name only when it holds the shell pages. A staging cache missing any of those is never promoted and is not
 * read, so offline `/` cannot come from a different build than the other shell pages. When it holds them, those pages are copied as one set. Staging and
 * older caches are deleted only after the live cache contains every precache
 * URL, including `/`. A failed check keeps staging and the
 * previous caches and is retried the next time this worker starts. Until then,
 * navigations and shell lookups read the live cache, then a complete staging
 * cache, then the newest older cache. Tabs open at install time
 * are the previous build; their caches stay
 * until those documents are gone. `/_next/static` also reads those caches.
 * A failed install waits before the next full download.
 *
 * Next.js flight requests are network-only: a `_rsc` query param, an `RSC: 1`
 * header, or a `Next-Router-Prefetch` / `Next-Router-State-Tree` header.
 * Same-origin GETs that are not navigations and carry `edit` are network-only
 * too, so a note id cannot become a cache key.
 *
 * Content-hashed Next chunks stay cache-first. Favicon and manifest stay
 * stale-while-revalidate.
 */

type HeaderLookup = { get(name: string): string | null }

export type FlightRequestLike = {
  url: string
  mode?: string
  headers?: HeaderLookup
}

/** True for Next.js RSC / flight fetches. These must not be written to Cache Storage. */
export function isFlightRequest(input: FlightRequestLike): boolean {
  const url = new URL(input.url, 'http://localhost')
  if (url.searchParams.has('_rsc')) return true
  const headers = input.headers
  if (!headers || typeof headers.get !== 'function') return false
  if (headers.get('rsc') === '1') return true
  if (headers.get('next-router-prefetch') !== null) return true
  if (headers.get('next-router-state-tree') !== null) return true
  return false
}

/**
 * True when the worker must not read or write the cache for this GET.
 * Navigations to `/about?edit=<id>` are not included: they paint the shell.
 */
export function shouldBypassSwCache(input: FlightRequestLike): boolean {
  if (isFlightRequest(input)) return true
  const url = new URL(input.url, 'http://localhost')
  if (input.mode !== 'navigate' && url.searchParams.has('edit')) return true
  return false
}

export type SwCacheStrategy =
  | 'network-first'
  | 'cache-first'
  | 'stale-while-revalidate'

/** Precached app-shell URLs (install-time). Hashed JS/CSS/fonts come from sw-precache.json. */
export const SW_SHELL_ASSETS = [
  '/',
  '/assets/dts-calc-favicon.svg',
  '/manifest.json',
] as const

/**
 * Cache names left by the plain-JS DTS-Calc worker that /sw.js replaced: `dts-calc-meta` and
 * `dts-calc-<20 hex>`. Mirrored in public/sw.js. It must never match this worker's own names.
 */
export function isLegacyDtsCalcCache(name: string): boolean {
  return name === 'dts-calc-meta' || /^dts-calc-[0-9a-f]{20}$/.test(name)
}

/** Immutable hashed build output — safe to cache-first. */
export function isHashedNextStatic(pathname: string): boolean {
  return pathname.startsWith('/_next/static/')
}

/** Files under /assets/ and the manifest: precached at install, then SWR. Offline is served from the cache. */
export function isShellStaticAsset(pathname: string): boolean {
  // Everything under /assets/ ships with the build (fonts, icons, artwork) and is precached at install.
  return pathname.startsWith('/assets/') || pathname === '/manifest.json'
}

/**
 * Choose a fetch strategy for a same-origin GET (non-/api/).
 */
export function classifySwRequest(
  pathname: string,
  isNavigation: boolean
): SwCacheStrategy {
  if (isNavigation) return 'stale-while-revalidate'
  if (isHashedNextStatic(pathname)) return 'cache-first'
  if (isShellStaticAsset(pathname)) return 'stale-while-revalidate'
  return 'network-first'
}
