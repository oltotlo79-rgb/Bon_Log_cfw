import { test, expect } from '@playwright/test'

/**
 * 法的ページ・情報ページ（認証不要）のE2Eテスト
 */
test.describe('法的ページ・情報ページ', () => {
  test('利用規約ページが表示される', async ({ page }) => {
    await page.goto('/terms')

    await expect(page.getByText(/利用規約/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('プライバシーポリシーページが表示される', async ({ page }) => {
    await page.goto('/privacy')

    await expect(page.getByText(/プライバシーポリシー|個人情報/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('特定商取引法に基づく表記ページが表示される', async ({ page }) => {
    await page.goto('/tokushoho')

    await expect(page.getByText(/特定商取引法|特商法/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('お問い合わせページが表示される', async ({ page }) => {
    await page.goto('/contact')

    await expect(page.getByText(/お問い合わせ|問い合わせ/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('お問い合わせフォームの必須項目が存在する', async ({ page }) => {
    await page.goto('/contact')

    // メールアドレスまたは名前の入力フィールドが存在する
    const formField = page.locator('input[type="email"], input[name="email"], textarea')
    await expect(formField.first()).toBeVisible({ timeout: 10000 })
  })

  test('ヘルプページが表示される', async ({ page }) => {
    await page.goto('/help')

    await expect(page.getByText(/ヘルプ|よくある質問|FAQ/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('Aboutページが表示される', async ({ page }) => {
    await page.goto('/about')

    await expect(page.getByText(/BON-LOG|盆栽|について/i).first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('法的ページのメタデータ', () => {
  test('利用規約のtitleが設定されている', async ({ page }) => {
    await page.goto('/terms')

    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('プライバシーポリシーのtitleが設定されている', async ({ page }) => {
    await page.goto('/privacy')

    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })
})
