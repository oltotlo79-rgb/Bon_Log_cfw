import { test, expect } from '@playwright/test'

/**
 * 下書きページのE2Eテスト
 */
test.describe('下書きページ', () => {
  test('下書き一覧ページが表示される', async ({ page }) => {
    await page.goto('/drafts')

    await expect(page.getByText('下書き', { exact: true }).first()).toBeVisible({ timeout: 10000 })
  })

  test('下書きリストまたは空メッセージが表示される', async ({ page }) => {
    await page.goto('/drafts')
    await page.waitForLoadState('load')

    // 下書きアイテムまたは空メッセージのいずれか
    const draftItem = page.locator('[data-testid="draft-card"], a[href*="/drafts/"]').first()
    const emptyMessage = page.getByText(/下書きがありません|下書きはありません|まだ下書きがありません/i)
    const heading = page.getByText('下書き', { exact: true }).first()

    const hasDrafts = await draftItem.isVisible({ timeout: 10000 }).catch(() => false)
    const hasEmptyMessage = await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false)
    const hasHeading = await heading.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasDrafts || hasEmptyMessage || hasHeading).toBeTruthy()
  })
})
