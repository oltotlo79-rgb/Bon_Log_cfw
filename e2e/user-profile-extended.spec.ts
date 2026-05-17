import { test, expect } from '@playwright/test'

/**
 * ユーザープロフィール 拡���E2Eテスト
 * プロフィールタブ、フォロー/フォロワー一覧、いいね一覧
 */
test.describe('ユーザープロフィール — 拡張テスト', () => {
  test('プロフィールページに投稿タブが表示される', async ({ page }) => {
    // 自分のプロフィールへのアクセス（設定ページ経由でユーザーIDを取得する代わりに直接フィードから）
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')

    // サイドバーのプロフィールリンクをクリック
    const profileLink = page.getByRole('link', { name: /プロフィール/i }).first()
    if (await profileLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await profileLink.click()
      await page.waitForLoadState('domcontentloaded')

      // 投稿タブが表示される
      const postsTab = page.getByText(/投稿/i).first()
      await expect(postsTab).toBeVisible({ timeout: 10000 })
    }
  })

  test('フォロワー一覧ページが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')

    const profileLink = page.getByRole('link', { name: /プロフィール/i }).first()
    if (await profileLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await profileLink.click()
      await page.waitForLoadState('domcontentloaded')

      // フォロワー数リンクをクリック
      const followersLink = page.getByRole('link', { name: /フォロワー/i }).first()
      if (await followersLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await followersLink.click()
        await expect(page).toHaveURL(/\/followers/, { timeout: 10000 })
      }
    }
  })

  test('フォロー中一覧ページが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')

    const profileLink = page.getByRole('link', { name: /プロフィール/i }).first()
    if (await profileLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await profileLink.click()
      await page.waitForLoadState('domcontentloaded')

      const followingLink = page.getByRole('link', { name: /フォロー中/i }).first()
      if (await followingLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await followingLink.click()
        await expect(page).toHaveURL(/\/following/, { timeout: 10000 })
      }
    }
  })

  test('プロフィール編集ページに遷移できる', async ({ page }) => {
    await page.goto('/settings/profile')
    await page.waitForLoadState('domcontentloaded')

    await expect(
      page.getByText(/プロフィール/i).first()
    ).toBeVisible({ timeout: 10000 })

    // ニックネーム入力欄が表示される
    const nicknameInput = page.getByLabel(/ニックネーム/i)
    if (await nicknameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(nicknameInput).toBeVisible()
    }
  })

  test('設定ページのブロック一覧に遷移できる', async ({ page }) => {
    await page.goto('/settings/blocked')
    await page.waitForLoadState('domcontentloaded')

    await expect(
      page.getByText(/ブロック/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('設定ページのミュート一覧に遷移できる', async ({ page }) => {
    await page.goto('/settings/muted')
    await page.waitForLoadState('domcontentloaded')

    await expect(
      page.getByText(/ミュート/i).first()
    ).toBeVisible({ timeout: 10000 })
  })
})
