import { test, expect } from '@playwright/test'

/**
 * マイ盆栽ページのE2Eテスト
 */
test.describe('マイ盆栽ページ', () => {
  test('マイ盆栽ページが表示される', async ({ page }) => {
    await page.goto('/bonsai')

    await expect(page.getByText(/マイ盆栽|盆栽コレクション/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('盆栽一覧または空メッセージが表示される', async ({ page }) => {
    await page.goto('/bonsai')

    // 盆栽アイテムまたは空メッセージのいずれか
    // 盆栽カードはLinkコンポーネント（/bonsai/[id]へのリンク）
    const bonsaiItem = page.locator('a[href^="/bonsai/"]:not([href="/bonsai/new"])').first()
    const emptyMessage = page.getByText(/まだ盆栽が登録されていません|盆栽が登録されていません|まだ盆栽がありません|盆栽を登録/i).first()

    const hasBonsai = (await bonsaiItem.count()) > 0
    const hasEmptyMessage = await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasBonsai || hasEmptyMessage).toBeTruthy()
  })

  test('盆栽登録リンクが存在する', async ({ page }) => {
    await page.goto('/bonsai')
    await page.waitForLoadState('domcontentloaded')

    // 「盆栽を追加」リンクまたは「最初の盆栽を登録」リンク（空の場合）
    const addLink = page.locator('a[href="/bonsai/new"]').first()
    await expect(addLink).toBeVisible({ timeout: 15000 })
  })

  test('盆栽登録ページに遷移できる', async ({ page }) => {
    await page.goto('/bonsai')

    const registerLink = page.getByRole('link', { name: /盆栽を登録|盆栽を追加|新規登録|追加/i })
    if (await registerLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await registerLink.click()
      await expect(page).toHaveURL(/\/bonsai\/new/)
    }
  })
})
