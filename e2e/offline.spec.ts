import { expect, test } from '@playwright/test'

test('the demo count survives a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add one' }).click()
  await expect(page.getByTestId('count')).toHaveText('1')
  await page.reload()
  await expect(page.getByTestId('count')).toHaveText('1')
})

test('the app loads from the service worker with the network off', async ({ page, context }) => {
  await page.goto('/')
  await expect
    .poll(() => page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      return Boolean(reg?.active && navigator.serviceWorker.controller)
    }), { timeout: 20_000 })
    .toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Add one' })).toBeVisible()
  await page.getByRole('button', { name: 'Add one' }).click()
  await expect(page.getByTestId('count')).not.toHaveText('0')
})

test('the theme boot script follows the saved choice', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('starter_theme', 'dark'))
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/theme-dark/)
})
