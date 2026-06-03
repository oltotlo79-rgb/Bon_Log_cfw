import { test } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

test.describe('サイドバーナビゲーション', () => {
  test('ホーム（フィード）リンクが動作する', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
    await clickAndWaitForUrl(page, page.locator('[data-testid="nav-home"]'), '/feed', { timeout: 15000 })
  })

  test('検索リンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await clickAndWaitForUrl(page, page.locator('[data-testid="nav-search"]'), '/search', { timeout: 15000 })
  })

  test('通知リンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await clickAndWaitForUrl(page, page.locator('[data-testid="nav-notifications"]'), '/notifications', { timeout: 15000 })
  })

  test('ブックマークリンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await clickAndWaitForUrl(page, page.locator('[data-testid="nav-bookmarks"]'), '/bookmarks', { timeout: 15000 })
  })

  test('盆栽園マップリンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await clickAndWaitForUrl(page, page.locator('[data-testid="nav-shops"]'), '/shops', { timeout: 15000 })
  })

  test('イベントリンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await clickAndWaitForUrl(page, page.locator('[data-testid="nav-events"]'), '/events', { timeout: 15000 })
  })

  test('設定リンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await clickAndWaitForUrl(page, page.locator('[data-testid="nav-settings"]'), '/settings', { timeout: 15000 })
  })

  test('マイ盆栽リンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await clickAndWaitForUrl(page, page.locator('[data-testid="nav-bonsai"]'), '/bonsai', { timeout: 15000 })
  })

  test('メッセージリンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await clickAndWaitForUrl(page, page.locator('[data-testid="nav-messages"]'), '/messages', { timeout: 15000 })
  })
})
