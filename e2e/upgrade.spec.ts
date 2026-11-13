import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AddressInfo } from 'node:net'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/**
 * Upgrade from the plain-JS DTS-Calc that is in production to this build, on one origin.
 * e2e/fixtures/old-prod-build is that production build (DTS-Calc main at ac56c30, `npm run build`).
 * One small server plays "the host": it serves either the old build or this build, and can be told
 * to break the new build's static files to prove a failed install changes nothing.
 */
const OLD_BUILD = fileURLToPath(new URL('./fixtures/old-prod-build', import.meta.url))
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}
const SAVED =
  '{"target":"TIME","unitSystem":"METRIC","values":{"time":"00:50:00","distance":"10.00","speed":"12.00","pace":"05:00"}}'

type Mode = 'old' | 'new' | 'new-broken'

async function serveOld(pathname: string, res: ServerResponse) {
  // The old host rewrote /b/<hash>/<file> to /<file>, and / to /index.html.
  let path = pathname.replace(/^\/b\/[0-9a-f]+/, '')
  if (path === '/' || path === '') path = '/index.html'
  const file = normalize(join(OLD_BUILD, path))
  if (!file.startsWith(OLD_BUILD)) return res.writeHead(403).end()
  try {
    const body = await readFile(file)
    const headers: Record<string, string> = { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }
    if (path === '/sw.js') headers['cache-control'] = 'no-cache'
    res.writeHead(200, headers).end(body)
  } catch {
    res.writeHead(404).end()
  }
}

async function proxyNew(base: string, req: IncomingMessage, res: ServerResponse, breakStatic: boolean) {
  if (breakStatic && req.url?.startsWith('/_next/static/')) return res.writeHead(503).end('broken on purpose')
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || ['host', 'connection', 'accept-encoding', 'content-length'].includes(key)) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  const upstream = await fetch(base + req.url, { method: req.method, headers, redirect: 'manual' })
  const out: Record<string, string> = {}
  upstream.headers.forEach((value, key) => {
    if (!['content-encoding', 'transfer-encoding', 'content-length', 'connection'].includes(key)) out[key] = value
  })
  res.writeHead(upstream.status, out).end(Buffer.from(await upstream.arrayBuffer()))
}

async function startHost(newBase: string) {
  const state = { mode: 'old' as Mode }
  const server: Server = createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://x').pathname
    const done = state.mode === 'old' ? serveOld(pathname, res) : proxyNew(newBase, req, res, state.mode === 'new-broken')
    done.catch(() => res.writeHead(502).end())
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://localhost:${(server.address() as AddressInfo).port}`
  return { state, origin, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}

const cacheNames = (page: Page) => page.evaluate(() => caches.keys())

async function installOldAndSaveValues(page: Page, origin: string) {
  await page.goto(origin + '/', { waitUntil: 'load' })
  await expect
    .poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active)), { timeout: 20_000 })
    .toBe(true)
  await page.goto(origin + '/', { waitUntil: 'load' })
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 20_000 }).toBe(true)
  // The old build, recognisable by its shell marker.
  await expect(page.locator('meta[name="dts-shell"]')).toHaveCount(1)
  for (const [id, value] of [['#distanceInput', '10'], ['#speedInput', '12']] as const) {
    await page.locator(id).fill(value)
    await page.locator(id).blur()
  }
  await expect(page.locator('#timeInput')).toHaveValue('00:50:00')
  expect(await page.evaluate(() => localStorage.getItem('pace-calculator-state'))).toBe(SAVED)
  const names = await cacheNames(page)
  expect(names).toContain('dts-calc-meta')
  expect(names.some((name) => /^dts-calc-[0-9a-f]{20}$/.test(name))).toBe(true)
}

async function checkForNewWorker(page: Page) {
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update().catch(() => undefined)
  })
}

async function expectNewShellOffline(context: BrowserContext, page: Page) {
  await context.setOffline(true)
  await page.reload({ waitUntil: 'load' })
  await expect(page.locator('meta[name="dts-shell"]')).toHaveCount(0) // not the old shell
  await expect(page.locator('.ctds-header-label')).toHaveText('DTS-Calc')
  await expect(page.locator('#timeInput')).toHaveValue('00:50:00')
  await expect(page.locator('#distanceInput')).toHaveValue('10.00')
  await expect(page.locator('#speedInput')).toHaveValue('12.00')
  await expect(page.locator('#paceInput')).toHaveValue('05:00')
  expect(await page.evaluate(() => localStorage.getItem('pace-calculator-state'))).toBe(SAVED)
}

test('upgrading from the old production build keeps saved values, works offline and clears the old caches', async ({ browser, baseURL }) => {
  test.setTimeout(120_000)
  const host = await startHost(baseURL ?? 'http://localhost:3000')
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    await installOldAndSaveValues(page, host.origin)

    // Deploy the new build. The open tab keeps running the old shell, as a real tab would.
    host.state.mode = 'new'
    await checkForNewWorker(page)
    await expect
      .poll(
        async () => {
          const names = await cacheNames(page)
          const live = names.some((name) => /^dts-calc-v8-[0-9a-f]+$/.test(name))
          const legacy = names.filter((name) => name === 'dts-calc-meta' || /^dts-calc-[0-9a-f]{20}$/.test(name))
          return live && legacy.length === 0
        },
        { timeout: 40_000, intervals: [500] },
      )
      .toBe(true)
    await expect(page.locator('meta[name="dts-shell"]')).toHaveCount(1) // this tab was not swapped under the user

    // Next launch, with the network off: the new shell, from its own cache, with the saved values.
    await expectNewShellOffline(context, page)
    const names = await cacheNames(page)
    expect(names.filter((name) => name === 'dts-calc-meta' || /^dts-calc-[0-9a-f]{20}$/.test(name))).toEqual([])
    expect(names.some((name) => /^dts-calc-v8-[0-9a-f]+$/.test(name))).toBe(true)
  } finally {
    await context.close()
    await host.close()
  }
})

test('a failed install of the new build leaves the old offline app and its caches untouched', async ({ browser, baseURL }) => {
  test.setTimeout(120_000)
  const host = await startHost(baseURL ?? 'http://localhost:3000')
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    await installOldAndSaveValues(page, host.origin)

    host.state.mode = 'new-broken'
    await checkForNewWorker(page)
    await page.waitForTimeout(4_000) // long enough for the new worker to try, fail and clean up its staging cache
    const names = await cacheNames(page)
    expect(names).toContain('dts-calc-meta')
    expect(names.some((name) => /^dts-calc-[0-9a-f]{20}$/.test(name))).toBe(true)
    expect(names.some((name) => /^dts-calc-v8-[0-9a-f]+$/.test(name) && !name.endsWith('-staging'))).toBe(false)

    await context.setOffline(true)
    await page.reload({ waitUntil: 'load' })
    await expect(page.locator('meta[name="dts-shell"]')).toHaveCount(1) // still the old shell, offline
    await expect(page.locator('#timeInput')).toHaveValue('00:50:00')
  } finally {
    await context.close()
    await host.close()
  }
})
