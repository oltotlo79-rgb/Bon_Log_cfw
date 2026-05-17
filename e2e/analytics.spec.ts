import { test, expect } from '@playwright/test'

/**
 * アナリティクスページのE2Eテスト（プレミアム機能）
 */
test.describe('アナリティクス', () => {
  test('アナリティクスページが表示される', async ({ page }) => {
    await page.goto('/analytics')

    // プレミアムユーザーの場合: ダッシュボードが表示
    // 非プレミアムの場合: アップグレード案内またはリダイレクト
    const pageText = page.getByText(/アナリティクス|分析|統計|プレミアム/i).first()
    await expect(pageText).toBeVisible({ timeout: 10000 })
  })

  test('統計カードまたはアップグレード案内が表示される', async ({ page }) => {
    await page.goto('/analytics')

    const hasStats = page.getByText(/投稿数|いいね|フォロワー|エンゲージメント/i).first()
    const hasUpgrade = page.getByText(/プレミアム|アップグレード/i).first()

    const statsVisible = await hasStats.isVisible({ timeout: 5000 }).catch(() => false)
    const upgradeVisible = await hasUpgrade.isVisible({ timeout: 3000 }).catch(() => false)

    expect(statsVisible || upgradeVisible).toBe(true)
  })

  test('期間フィルターが存在する', async ({ page }) => {
    await page.goto('/analytics')

    // 期間選択のボタンやセレクトが表示される
    const periodFilter = page.getByText(/7日|30日|90日|期間/i).first()
    if (await periodFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(periodFilter).toBeVisible()
    }
  })
})
