import { test, expect } from '@playwright/test'

/**
 * ゲスト時の設定ページ制限 E2E
 * - 未認証でトップの「のぞいてみる」からゲストログインし、/settings/profile 等で案内が表示されることを確認する。
 * - CI では GUEST_PASSWORD / ゲストユーザーが無いためスキップする。
 */
test.describe('ゲスト時の設定ページ制限', () => {
  // CI standalone環境ではランディングページの「のぞいてみる」ボタンのコンパイルが遅く不安定
  // また chromium-noauth プロジェクトでは未ログインのため /settings がリダイレクトされる
  test.skip(!!process.env.CI || !process.env.GUEST_PASSWORD, 'CI環境またはGUEST_PASSWORD未設定のためスキップ')

  test('ゲストでプロフィール編集にアクセスすると案内が表示される', async ({ page }) => {
    await page.goto('/')
    const guestButton = page.getByRole('button', { name: 'のぞいてみる' }).first()
    await guestButton.click({ timeout: 10000 })
    await expect(page).toHaveURL(/\/(feed|)\/?/, { timeout: 15000 })

    await page.goto('/settings/profile')
    await expect(page).toHaveURL(/\/settings\/profile/, { timeout: 10000 })
    await expect(page.getByText(/プロフィール編集は新規登録後にご利用いただけます|投稿やコメントなどの作成は新規登録後にご利用いただけます/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('link', { name: /新規登録する/ })).toBeVisible({ timeout: 5000 })
    await expect(page.getByLabel(/ニックネーム/)).not.toBeVisible()
  })

  test('ゲストでアカウント設定にアクセスすると案内が表示される', async ({ page }) => {
    await page.goto('/')
    const guestButton = page.getByRole('button', { name: 'のぞいてみる' }).first()
    await guestButton.click({ timeout: 10000 })
    await expect(page).toHaveURL(/\/(feed|)\/?/, { timeout: 15000 })

    await page.goto('/settings/account')
    await expect(page).toHaveURL(/\/settings\/account/, { timeout: 10000 })
    await expect(page.getByText(/投稿やコメントなどの作成は新規登録後にご利用いただけます/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('link', { name: /新規登録する/ })).toBeVisible({ timeout: 5000 })
  })
})
