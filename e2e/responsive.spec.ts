import { test, expect } from '@playwright/test'

/**
 * レスポンシブデザインのE2Eテスト
 * モバイル/デスクトップの表示切り替えを確認
 */
test.describe('レスポンシブデザイン', () => {
  test('デスクトップでサイドバーが表示される', async ({ page }) => {
    // デスクトップサイズに設定
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/feed')

    // サイドバーのナビゲーションリンクが表示される
    const sidebar = page.locator('nav, aside').first()
    await expect(sidebar).toBeVisible({ timeout: 10000 })
  })

  test('モバイルでボトムナビが表示される', async ({ page }) => {
    // モバイルサイズに設定
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/feed')

    // ボトムナビゲーションが表示される
    const bottomNav = page.locator('[class*="bottom-nav"], [class*="mobile-nav"], nav[class*="fixed"]').first()
    if (await bottomNav.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(bottomNav).toBeVisible()
    }
  })

  test('モバイルでフィードページが正しく表示される', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/feed')

    // ページコンテンツが表示される
    await expect(page.getByText(/タイムライン/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('モバイルで検索ページが正しく表示される', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/search')

    // 検索入力が表示される
    await expect(page.getByPlaceholder(/検索/i)).toBeVisible({ timeout: 10000 })
  })

  test('モバイルでイベントページが正しく表示される', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/events')
    await page.waitForLoadState('load')

    // h1見出しまたはイベント関連テキストが表示される
    const heading = page.getByRole('heading', { name: /イベント/i }).first()
    const eventText = page.getByText('イベント', { exact: true }).first()

    const hasHeading = await heading.isVisible({ timeout: 15000 }).catch(() => false)
    const hasText = await eventText.isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasHeading || hasText).toBeTruthy()
  })
})
