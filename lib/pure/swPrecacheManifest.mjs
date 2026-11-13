import { createHash } from 'node:crypto'

/** Placeholder in public/sw.js. The build replaces it; a committed hash is not required. */
export const CACHE_BUILD_TOKEN = '__STARTER_CACHE_BUILD__'

/**
 * Build id for the live cache. `normalizedSw` is sw.js with CACHE_BUILD set to
 * the placeholder. The precache manifest is part of the hash so a new chunk
 * set gets a new cache even when the worker source is unchanged.
 *
 * @param {string} normalizedSw
 * @param {string} manifestText
 * @returns {string}
 */
export function cacheBuildKey(normalizedSw, manifestText) {
  return createHash('sha256')
    .update(String(normalizedSw))
    .update('\0')
    .update(String(manifestText ?? ''))
    .digest('hex')
    .slice(0, 16)
}

/**
 * @param {string} source
 * @returns {string}
 */
export function normalizeServiceWorkerSource(source) {
  const normalized = source.replace(
    /const CACHE_BUILD = '[^']*'/,
    `const CACHE_BUILD = '${CACHE_BUILD_TOKEN}'`
  )
  if (!normalized.includes(`const CACHE_BUILD = '${CACHE_BUILD_TOKEN}'`)) {
    throw new Error('public/sw.js is missing CACHE_BUILD')
  }
  return normalized
}

/**
 * @param {string} source
 * @param {string} manifestText
 * @returns {string}
 */
export function stampServiceWorker(source, manifestText) {
  const normalized = normalizeServiceWorkerSource(source)
  const key = cacheBuildKey(normalized, manifestText)
  return normalized.replace(
    `const CACHE_BUILD = '${CACHE_BUILD_TOKEN}'`,
    `const CACHE_BUILD = '${key}'`
  )
}

/**
 * Turn Next build manifest entries into same-origin `/_next/static/...` URLs.
 * The service worker precaches this list. It does not hard-code chunk hashes.
 *
 * @param {{
 *   rootMainFiles?: string[],
 *   polyfillFiles?: string[],
 *   routeChunkPaths?: string[],
 *   fontFiles?: string[],
 *   cssFiles?: string[],
 *   staticFiles?: string[],
 * }} input
 * @returns {string[]}
 */
export function collectPrecacheUrls(input) {
  const urls = new Set()
  const add = (value) => {
    if (typeof value !== 'string' || value.length === 0) return
    const trimmed = value.split('?')[0].split('#')[0]
    let path = trimmed
    if (path.startsWith('/_next/static/')) {
      urls.add(path)
      return
    }
    if (path.startsWith('.next/static/')) {
      urls.add(`/_next/${path.slice('.next/'.length)}`)
      return
    }
    if (path.startsWith('static/')) {
      urls.add(`/_next/${path}`)
      return
    }
    if (path.startsWith('/static/')) {
      urls.add(`/_next${path}`)
    }
  }

  for (const file of input.rootMainFiles ?? []) add(file)
  for (const file of input.polyfillFiles ?? []) add(file)
  for (const file of input.routeChunkPaths ?? []) add(file)
  for (const file of input.fontFiles ?? []) add(file)
  for (const file of input.cssFiles ?? []) add(file)
  for (const file of input.staticFiles ?? []) add(file)

  return [...urls].sort()
}

/**
 * How large the uncapped precache list is. `bytesByUrl` is file size by URL.
 * Missing sizes count toward `count` and add nothing to `bytes`.
 *
 * @param {string[]} urls
 * @param {Record<string, number>} [bytesByUrl]
 * @returns {{ count: number, bytes: number }}
 */
export function precacheSizeReport(urls, bytesByUrl) {
  let bytes = 0
  for (const url of urls) {
    const size = bytesByUrl?.[url]
    if (typeof size === 'number' && Number.isFinite(size) && size > 0) bytes += size
  }
  return { count: urls.length, bytes }
}
