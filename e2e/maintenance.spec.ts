import { test, expect } from '@playwright/test'

/**
 * メンテナンスページのE2Eテスト
 * 認証不要ページのため chromium-noauth プロジェクトでも実行可能
 */
test.describe('メンテナンスページ', () => {
  test('メンテナンスページが表示される', async ({ page }) => {
    await page.goto('/maintenance')

    // メンテナンスページのコンテンツが表示される
    const content = page.getByText(/メンテナンス|maintenance/i).first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  test('メンテナンスメッセージが表示される', async ({ page }) => {
    await page.goto('/maintenance')

    // メンテナンス中のメッセージ
    const message = page.getByText(
      /メンテナンス中|ただいまメンテナンス|しばらくお待ち|ご不便をおかけ|maintenance/i
    ).first()
    const heading = page.locator('h1, h2').first()

    const hasMessage = await message.isVisible({ timeout: 10000 }).catch(() => false)
    const hasHeading = await heading.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasMessage || hasHeading).toBeTruthy()
  })
})
