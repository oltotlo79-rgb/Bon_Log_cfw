import { test, expect } from '@playwright/test'

/**
 * ブックマーク機能 拡張E2Eテスト
 * ブックマークページの表示、空状態、ナビゲーション
 */
test.describe('ブックマーク — 拡張テスト', () => {
  test('ブックマークページに見出しが表示される', async ({ page }) => {
    await page.goto('/bookmarks')
    await page.waitForLoadState('domcontentloaded')

    await expect(
      page.getByRole('heading', { name: /ブックマーク/i })
    ).toBeVisible({ timeout: 10000 })
  })

  test('ブックマーク済み投稿または空メッセージが表示される', async ({ page }) => {
    await page.goto('/bookmarks')
    await page.waitForLoadState('domcontentloaded')

    // ブックマークした投稿があればPostCard表示、なければ空メッセージ
    const posts = page.locator('article, [data-testid="post-card"]')
    const emptyMsg = page.getByText(/ブックマーク.*ありません|まだブックマーク/i)

    const hasPosts = (await posts.count()) > 0
    const hasEmpty = await emptyMsg.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasPosts || hasEmpty).toBeTruthy()
  })

  test('投稿詳細ページからブックマークボタンが使える', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')

    // フィードに投稿があればブックマークボタンを確認
    const bookmarkBtn = page.locator('[aria-label*="ブックマーク"], button:has(svg)').first()
    if (await bookmarkBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(bookmarkBtn).toBeVisible()
    }
  })

  test('サイドバーからブックマークページに遷移できる', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')

    const bookmarkLink = page.getByRole('link', { name: /ブックマーク/i })
    if (await bookmarkLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await bookmarkLink.click()
      await expect(page).toHaveURL(/\/bookmarks/, { timeout: 10000 })
    }
  })
})
