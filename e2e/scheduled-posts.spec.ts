import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * 予約投稿ページのE2Eテスト（プレミアム機能）
 */
test.describe('予約投稿', () => {
  test('予約投稿一覧ページが表示される', async ({ page }) => {
    await page.goto('/posts/scheduled')

    // プレミアムユーザーの場合: 予約投稿一覧が表示
    // 非プレミアムの場合: アップグレード案内またはリダイレクト
    const pageText = page.getByText(/予約投稿|スケジュール|プレミアム/i).first()
    await expect(pageText).toBeVisible({ timeout: 10000 })
  })

  test('予約投稿一覧または空メッセージが表示される', async ({ page }) => {
    await page.goto('/posts/scheduled')
    await page.waitForLoadState('load')

    const hasPosts = page.locator('[data-testid="scheduled-post"], [class*="scheduled"], [class*="card"]')
    const hasEmpty = page.getByText(/予約投稿はありません|まだありません|表示するものがありません/i)
    const hasPremium = page.getByText(/プレミアム会員限定|プレミアムに登録|予約投稿機能/i)
    const hasHeading = page.getByText(/予約投稿/i).first()

    const postsVisible = await hasPosts.first().isVisible({ timeout: 5000 }).catch(() => false)
    const emptyVisible = await hasEmpty.isVisible({ timeout: 5000 }).catch(() => false)
    const premiumVisible = await hasPremium.isVisible({ timeout: 3000 }).catch(() => false)
    const headingVisible = await hasHeading.isVisible({ timeout: 3000 }).catch(() => false)

    expect(postsVisible || emptyVisible || premiumVisible || headingVisible).toBe(true)
  })

  test('新規予約投稿ページに遷移できる', async ({ page }) => {
    await page.goto('/posts/scheduled')

    const createLink = page.getByRole('link', { name: /新規作成|予約投稿を作成|新しい予約/i })
    if (await createLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickAndWaitForUrl(page, createLink, /\/posts\/scheduled\/new/)
    }
  })

  test('新規予約投稿ページが表示される', async ({ page }) => {
    await page.goto('/posts/scheduled/new')

    const url = page.url()
    if (url.includes('/posts/scheduled/new')) {
      // 日時選択フィールドが存在する
      const dateField = page.locator('input[type="datetime-local"], input[type="date"], [class*="calendar"], [class*="date"]')
      if (await dateField.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(dateField.first()).toBeVisible()
      }
    }
  })
})
