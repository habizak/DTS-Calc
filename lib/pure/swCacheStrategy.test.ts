import { describe, expect, it } from 'vitest'
import {
  SW_SHELL_ASSETS,
  classifySwRequest,
  isFlightRequest,
  isHashedNextStatic,
  isShellStaticAsset,
  shouldBypassSwCache,
} from './swCacheStrategy'

describe('swCacheStrategy (APP-77)', () => {
  it('exposes the precached shell asset list', () => {
    expect(SW_SHELL_ASSETS).toEqual([
      '/',
      '/assets/dts-calc-favicon.svg',
      '/manifest.json',
    ])
  })

  it('treats navigations as stale-while-revalidate (cached shell, refresh in the background)', () => {
    expect(classifySwRequest('/', true)).toBe('stale-while-revalidate')
    expect(classifySwRequest('/about', true)).toBe('stale-while-revalidate')
    expect(classifySwRequest('/any/path', true)).toBe('stale-while-revalidate')
  })

  it('cache-first only for content-hashed Next static chunks', () => {
    expect(isHashedNextStatic('/_next/static/chunks/app-abc123.js')).toBe(true)
    expect(classifySwRequest('/_next/static/chunks/app-abc123.js', false)).toBe(
      'cache-first'
    )
    expect(classifySwRequest('/_next/static/css/app.css', false)).toBe('cache-first')
  })

  it('does not cache-first non-hashed Next paths', () => {
    expect(isHashedNextStatic('/_next/data/build-id/index.json')).toBe(false)
    expect(classifySwRequest('/_next/data/build-id/index.json', false)).toBe(
      'network-first'
    )
  })

  it('uses stale-while-revalidate for shell static assets', () => {
    expect(isShellStaticAsset('/assets/dts-calc-favicon.svg')).toBe(true)
    expect(isShellStaticAsset('/manifest.json')).toBe(true)
    expect(classifySwRequest('/assets/dts-calc-favicon.svg', false)).toBe('stale-while-revalidate')
    expect(classifySwRequest('/manifest.json', false)).toBe(
      'stale-while-revalidate'
    )
  })

  it('defaults other same-origin GETs to network-first', () => {
    expect(classifySwRequest('/robots.txt', false)).toBe('network-first')
    expect(classifySwRequest('/about', false)).toBe('network-first')
  })

  it('treats Next flight requests as uncacheable', () => {
    const headers = new Headers({ RSC: '1' })
    expect(isFlightRequest({ url: 'http://localhost/about?edit=note-1&_rsc=abc' })).toBe(true)
    expect(isFlightRequest({ url: 'http://localhost/about?edit=note-1', headers })).toBe(true)
    expect(
      isFlightRequest({
        url: 'http://localhost/about',
        headers: new Headers({ 'Next-Router-Prefetch': '1' }),
      })
    ).toBe(true)
    expect(
      isFlightRequest({
        url: 'http://localhost/about',
        headers: new Headers({ 'Next-Router-State-Tree': '%5B%5D' }),
      })
    ).toBe(true)
    expect(isFlightRequest({ url: 'http://localhost/about?edit=note-1', mode: 'navigate' })).toBe(
      false
    )
  })

  it('does not let a note id on a non-navigation GET become a cache key', () => {
    expect(shouldBypassSwCache({ url: 'http://localhost/about?edit=note-1' })).toBe(true)
    expect(
      shouldBypassSwCache({ url: 'http://localhost/about?edit=note-1', mode: 'navigate' })
    ).toBe(false)
    expect(shouldBypassSwCache({ url: 'http://localhost/about', mode: 'navigate' })).toBe(false)
  })
})
