import { test, expect } from '@playwright/test'

/**
 * ブックマークページのE2Eテスト
 */
test.describe('ブックマークページ', () => {
  test('ブックマークページが表示される', async ({ page }) => {
    await page.goto('/bookmarks')

    await expect(page.getByText('ブックマーク', { exact: true }).first()).toBeVisible({ timeout: 10000 })
  })

  test('ブックマーク一覧または空メッセージが表示される', async ({ page }) => {
    await page.goto('/bookmarks')

    // ブックマーク投稿または空メッセージのいずれかが表示される
    const postCard = page.locator('[data-testid="post-card"]').first()
    const emptyMessage = page.getByText(/ブックマークした投稿はありません|まだブックマークがありません|ブックマークはありません/i)

    const hasPosts = (await postCard.count()) > 0
    const hasEmptyMessage = await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasPosts || hasEmptyMessage).toBeTruthy()
  })
})
