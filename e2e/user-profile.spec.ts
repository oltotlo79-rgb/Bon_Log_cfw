import { test, expect } from '@playwright/test'

test.describe('ユーザー設定ページ', () => {
  test('設定ページが表示される', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText(/設定/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('プロフィール編集リンクが表示される', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText(/プロフィール編集/i)).toBeVisible({ timeout: 10000 })
  })

  test('プロフィール編集ページに遷移できる', async ({ page }) => {
    await page.goto('/settings/profile')
    await expect(page).toHaveURL(/\/settings\/profile/, { timeout: 10000 })
    await expect(page.getByText(/ニックネーム/i)).toBeVisible({ timeout: 10000 })
  })
})

test.describe('存在しないユーザー', () => {
  test('存在しないユーザーにアクセスすると404ページが表示される', async ({ page }) => {
    await page.goto('/users/non-existent-user-id-12345')
    await expect(page.getByText(/見つかりません|存在しません|not found|404/i).first()).toBeVisible({ timeout: 15000 })
  })
})
