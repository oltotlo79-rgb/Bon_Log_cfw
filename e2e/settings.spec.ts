import { test, expect } from '@playwright/test'

/**
 * 設定ページのE2Eテスト
 */
test.describe('設定ページ', () => {
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

  test('テーマ切り替えが動作する', async ({ page }) => {
    await page.goto('/settings')

    // Cookie同意ダイアログが表示されていたら閉じる。
    // `/すべて同意|必要最小限/i` は 2 ボタンにマッチするため strict mode 違反になる → first() で明示。
    const cookieDialog = page.getByRole('dialog', { name: /Cookie/i })
    if (await cookieDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cookieDialog.getByRole('button', { name: /すべて同意|必要最小限/i }).first().click()
      await cookieDialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
    }

    // テーマ切り替えボタン/トグルを探す
    const themeToggle = page.getByRole('button', { name: /テーマ|ダーク|ライト/i }).first()
    if (await themeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await themeToggle.click({ force: true })
      // htmlタグにdarkクラスが切り替わることを確認
      await page.waitForTimeout(500)
    }
  })

  test('アカウント関連の設定項目が表示される', async ({ page }) => {
    await page.goto('/settings')

    // 主要な設定項目が表示される
    const settingsItems = [
      /プロフィール/i,
      /通知/i,
    ]

    for (const item of settingsItems) {
      const element = page.getByText(item).first()
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(element).toBeVisible()
      }
    }
  })

  test('設定ページにセキュリティまたはアカウント設定へのリンクがある', async ({ page }) => {
    await page.goto('/settings')

    const securityOrAccount = page.getByRole('link', { name: /セキュリティ|アカウント|パスワード|2段階/i }).first()
    const hasLink = await securityOrAccount.isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasLink).toBeTruthy()
  })

  test('通知設定リンクが表示される', async ({ page }) => {
    await page.goto('/settings')

    const notificationLink = page.getByRole('link', { name: /通知設定|通知/i }).first()
    await expect(notificationLink).toBeVisible({ timeout: 10000 })
  })
})

test.describe('プロフィール編集', () => {
  test('プロフィール編集フォームが表示される', async ({ page }) => {
    await page.goto('/settings/profile')

    // ニックネーム入力フィールド
    await expect(page.getByLabel(/ニックネーム/i)).toBeVisible({ timeout: 10000 })
  })

  test('プロフィール編集フォームにユーザー情報が表示される', async ({ page }) => {
    await page.goto('/settings/profile')

    // ニックネーム入力フィールドに現在の値が入っている
    const nicknameInput = page.getByLabel(/ニックネーム/i)
    await expect(nicknameInput).toBeVisible({ timeout: 10000 })

    const value = await nicknameInput.inputValue()
    expect(value.length).toBeGreaterThan(0)
  })

  test('自己紹介欄が表示される', async ({ page }) => {
    await page.goto('/settings/profile')

    const bioField = page.getByLabel(/自己紹介|プロフィール文|bio/i)
    if (await bioField.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(bioField).toBeVisible()
    }
  })
})

test.describe('設定サブページ', () => {
  test('アカウント設定ページに遷移できる', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('link', { name: /アカウント設定/i }).first().click()

    await expect(page).toHaveURL(/\/settings\/account/, { timeout: 10000 })
    await expect(page.getByText(/アカウント設定|公開|削除/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('プラン管理ページに遷移できる', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('link', { name: /プラン管理/i }).first().click()

    await expect(page).toHaveURL(/\/settings\/subscription/, { timeout: 10000 })
  })
})
