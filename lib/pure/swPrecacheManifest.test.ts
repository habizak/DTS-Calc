import { describe, expect, it } from 'vitest'
import {
  CACHE_BUILD_TOKEN,
  cacheBuildKey,
  collectPrecacheUrls,
  precacheSizeReport,
  stampServiceWorker,
} from './swPrecacheManifest'

describe('stampServiceWorker', () => {
  const source = `const CACHE_BUILD = '${CACHE_BUILD_TOKEN}'\nconst body = 1\n`

  it('stamps a hash of the worker and the precache manifest', () => {
    const first = stampServiceWorker(source, '["/a.js"]')
    const second = stampServiceWorker(first, '["/a.js"]')
    expect(first).toBe(second)
    expect(first).toContain(`const CACHE_BUILD = '${cacheBuildKey(source, '["/a.js"]')}'`)
    expect(stampServiceWorker(source, '["/b.js"]')).not.toBe(first)
    expect(stampServiceWorker(`${source}\nconst extra = 2\n`, '["/a.js"]')).not.toBe(first)
  })
})

describe('collectPrecacheUrls', () => {
  it('normalizes build-manifest, route, font, and css paths into /_next/static URLs', () => {
    const urls = collectPrecacheUrls({
      rootMainFiles: ['static/chunks/runtime.js'],
      polyfillFiles: ['static/chunks/polyfill.js'],
      routeChunkPaths: ['.next/static/chunks/app.js', '/_next/static/chunks/already.js'],
      fontFiles: ['static/media/JetBrainsMono.woff2'],
      cssFiles: ['.next/static/chunks/app.css'],
    })

    expect(urls).toEqual([
      '/_next/static/chunks/already.js',
      '/_next/static/chunks/app.css',
      '/_next/static/chunks/app.js',
      '/_next/static/chunks/polyfill.js',
      '/_next/static/chunks/runtime.js',
      '/_next/static/media/JetBrainsMono.woff2',
    ])
  })

  it('includes lazy static files such as the pairing worker', () => {
    expect(
      collectPrecacheUrls({
        staticFiles: [
          'static/chunks/turbopack-worker-abc.js',
          'static/media/rendezvous.worker.abc.ts',
          'static/chunks/router-bfcache.js',
        ],
      })
    ).toEqual([
      '/_next/static/chunks/router-bfcache.js',
      '/_next/static/chunks/turbopack-worker-abc.js',
      '/_next/static/media/rendezvous.worker.abc.ts',
    ])
  })

  it('keeps every static url and reports the byte size', () => {
    const staticFiles = Array.from({ length: 80 }, (_, index) => `static/chunks/c${index}.js`)
    const urls = collectPrecacheUrls({ staticFiles })
    expect(urls).toHaveLength(80)
    expect(urls).toContain('/_next/static/chunks/c0.js')
    expect(urls).toContain('/_next/static/chunks/c63.js')
    expect(urls).toContain('/_next/static/chunks/c79.js')
    const bytesByUrl = Object.fromEntries(urls.map((url, index) => [url, 1000 + index]))
    expect(precacheSizeReport(urls, bytesByUrl)).toEqual({
      count: 80,
      bytes: urls.reduce((sum, _url, index) => sum + 1000 + index, 0),
    })
  })

  it('drops query strings and ignores files outside the static output', () => {
    expect(
      collectPrecacheUrls({
        rootMainFiles: ['static/chunks/a.js?dpl=1', 'pages/index.js', ''],
        cssFiles: ['/static/chunks/from-root.css'],
      })
    ).toEqual([
      '/_next/static/chunks/a.js',
      '/_next/static/chunks/from-root.css',
    ])
  })
})
