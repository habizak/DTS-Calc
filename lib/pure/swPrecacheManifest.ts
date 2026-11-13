import {
  collectPrecacheUrls as collect,
  precacheSizeReport as report,
  cacheBuildKey as buildKey,
  stampServiceWorker as stamp,
  CACHE_BUILD_TOKEN as token,
} from './swPrecacheManifest.mjs'

export type PrecacheManifestInput = {
  rootMainFiles?: string[]
  polyfillFiles?: string[]
  routeChunkPaths?: string[]
  fontFiles?: string[]
  cssFiles?: string[]
  staticFiles?: string[]
}

/** Same-origin URLs the shell needs. Hashes come from the build, not this list. */
export function collectPrecacheUrls(input: PrecacheManifestInput): string[] {
  return collect(input)
}

/** Count and byte size of the precache list. The list itself is not capped. */
export const CACHE_BUILD_TOKEN: string = token

/** sha256 prefix of the placeholder worker plus the precache manifest text. */
export function cacheBuildKey(normalizedSw: string, manifestText: string): string {
  return buildKey(normalizedSw, manifestText)
}

/** Replace CACHE_BUILD in sw.js with cacheBuildKey(normalized source, manifest). */
export function stampServiceWorker(source: string, manifestText: string): string {
  return stamp(source, manifestText)
}

export function precacheSizeReport(
  urls: string[],
  bytesByUrl?: Record<string, number>
): { count: number; bytes: number } {
  return report(urls, bytesByUrl)
}
