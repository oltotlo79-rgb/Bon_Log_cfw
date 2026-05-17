import { test, expect } from '@playwright/test'

test.describe('サイドバーナビゲーション', () => {
  test('ホーム（フィード）リンクが動作する', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
    await page.locator('[data-testid="nav-home"]').click()
    await expect(page).toHaveURL('/feed', { timeout: 15000 })
  })

  test('検索リンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await page.locator('[data-testid="nav-search"]').click()
    await expect(page).toHaveURL('/search', { timeout: 15000 })
  })

  test('通知リンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await page.locator('[data-testid="nav-notifications"]').click()
    await expect(page).toHaveURL('/notifications', { timeout: 15000 })
  })

  test('ブックマークリンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await page.locator('[data-testid="nav-bookmarks"]').click()
    await expect(page).toHaveURL('/bookmarks', { timeout: 15000 })
  })

  test('盆栽園マップリンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await page.locator('[data-testid="nav-shops"]').click()
    await expect(page).toHaveURL('/shops', { timeout: 15000 })
  })

  test('イベントリンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await page.locator('[data-testid="nav-events"]').click()
    await expect(page).toHaveURL('/events', { timeout: 15000 })
  })

  test('設定リンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await page.locator('[data-testid="nav-settings"]').click()
    await expect(page).toHaveURL('/settings', { timeout: 15000 })
  })

  test('マイ盆栽リンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await page.locator('[data-testid="nav-bonsai"]').click()
    await expect(page).toHaveURL('/bonsai', { timeout: 15000 })
  })

  test('メッセージリンクが動作する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await page.locator('[data-testid="nav-messages"]').click()
    await expect(page).toHaveURL('/messages', { timeout: 15000 })
  })
})
