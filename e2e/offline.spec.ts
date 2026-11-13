import { createHash } from 'node:crypto'
import { type Dirent, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { LINK_PREVIEW } from '../lib/pure/linkPreview'

const COVER_SHA256 = '728775ceb03974599c3acd8b27f01c604eb5f6812f1ac7bf2e57c323ffbb6554'

async function enter(page: Page, id: string, value: string) {
  await page.locator(id).fill(value)
  await page.locator(id).blur()
}

async function tenKmInFifty(page: Page) {
  await enter(page, '#distanceInput', '10')
  await enter(page, '#speedInput', '12')
  await expect(page.locator('#timeInput')).toHaveValue('00:50:00')
  await expect(page.locator('#speedInput')).toHaveValue('12.00')
  await expect(page.locator('#paceInput')).toHaveValue('05:00')
}

async function controlled(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration('/sw.js')
          return Boolean(reg?.active && navigator.serviceWorker.controller)
        }),
      { timeout: 20_000 },
    )
    .toBe(true)
}

test('10 km in 50 minutes gives 12 km/h and 5:00 min/km', async ({ page }) => {
  await page.goto('/')
  await tenKmInFifty(page)
})

test('saved values survive a reload', async ({ page }) => {
  await page.goto('/')
  await tenKmInFifty(page)
  await page.reload()
  await expect(page.locator('#timeInput')).toHaveValue('00:50:00')
  await expect(page.locator('#distanceInput')).toHaveValue('10.00')
  const saved = await page.evaluate(() => localStorage.getItem('pace-calculator-state'))
  expect(saved).toBe(
    '{"target":"TIME","unitSystem":"METRIC","values":{"time":"00:50:00","distance":"10.00","speed":"12.00","pace":"05:00"}}',
  )
})

test('an install that had Multi saved loads Single and clears the two old keys, keeping the saved calculator state', async ({ page }) => {
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })
  await page.goto('/')
  await tenKmInFifty(page)
  await page.evaluate(() => {
    localStorage.setItem('pace-mode', 'multi')
    localStorage.setItem('multi-pace-state', '{"zones":[]}')
  })
  await page.reload()
  await expect(page.locator('#timeInput')).toHaveValue('00:50:00')
  await expect(page.locator('#singlePaceApp')).toBeVisible()
  await expect(page.locator('#modeSingle, #modeMulti')).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() => [
        localStorage.getItem('pace-mode'),
        localStorage.getItem('multi-pace-state'),
        localStorage.getItem('pace-calculator-state') !== null,
      ]),
    )
    .toEqual([null, null, true])
  expect(problems).toEqual([])
})

test('the app loads from the service worker with the network off and still calculates', async ({ page, context }) => {
  await page.goto('/')
  await controlled(page)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.ctds-header-label')).toHaveText('DTS-Calc')
  await tenKmInFifty(page)
})

test('offline, every file under /assets still loads, and the font is the real one', async ({ page, context }) => {
  await page.goto('/')
  await controlled(page)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.ctds-header-label')).toHaveText('DTS-Calc')
  // The list comes from the files on disk, not from the worker's own list, so a file the worker forgets fails here.
  const assets = (readdirSync('public/assets', { recursive: true, withFileTypes: true }) as Dirent[])
    .filter((entry) => entry.isFile() && !entry.name.endsWith('.txt'))
    .map((entry) => `/assets/${path.relative('public/assets', path.join(entry.parentPath, entry.name)).split(path.sep).join('/')}`)
  expect(assets.length).toBeGreaterThan(5)
  const failed = await page.evaluate(async (urls) => {
    const bad: string[] = []
    for (const url of urls) {
      try {
        const response = await fetch(url)
        if (!response.ok) bad.push(url)
      } catch {
        bad.push(url)
      }
    }
    return bad
  }, assets)
  expect(failed).toEqual([])
  const faces = await page.evaluate(() => document.fonts.load('400 16px "JetBrains Mono"').then((list) => list.length))
  expect(faces).toBeGreaterThan(0)
})

test('the page head carries the approved link-preview tags', async ({ page }) => {
  await page.goto('/')
  const meta = (attr: 'name' | 'property', key: string) =>
    page.locator(`meta[${attr}="${key}"]`).getAttribute('content')
  expect(await page.title()).toBe('DTS-Calc')
  expect(await meta('name', 'description')).toBe(LINK_PREVIEW.description)
  expect(await meta('property', 'og:title')).toBe(LINK_PREVIEW.title)
  expect(await meta('property', 'og:url')).toBe(LINK_PREVIEW.url)
  expect(await meta('property', 'og:site_name')).toBe(LINK_PREVIEW.siteName)
  expect(await meta('property', 'og:image')).toBe(LINK_PREVIEW.image)
  expect(await meta('property', 'og:image:alt')).toBe(LINK_PREVIEW.imageAlt)
  expect(await meta('name', 'twitter:card')).toBe('summary_large_image')
  expect(await meta('name', 'twitter:image')).toBe(LINK_PREVIEW.image)
  expect(await meta('name', 'theme-color')).toBe('#c20707')
  expect(await meta('name', 'apple-mobile-web-app-title')).toBe('DTS-Calc')
})

test('og.png is the approved cover, served at /og.png and kept out of the offline shell', async ({ request }) => {
  const response = await request.get('/og.png')
  expect(response.status()).toBe(200)
  const body = await response.body()
  expect(body.length).toBe(3767)
  expect(createHash('sha256').update(body).digest('hex')).toBe(COVER_SHA256)
  const precache = JSON.parse(readFileSync('public/sw-precache.json', 'utf8')) as string[]
  expect(precache.includes('/og.png')).toBe(false)
})
