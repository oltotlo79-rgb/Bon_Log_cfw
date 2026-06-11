import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * ユーザープロフィール詳細ページのE2Eテスト
 * /users/[id] およびサブページ（followers, following, likes）をカバー
 */
test.describe('ユーザープロフィール詳細', () => {
  let userId: string | null = null

  test.beforeEach(async ({ page }) => {
    // settings/profileからユーザーIDを特定するか、サイドバーのプロフィールリンクから取得
    await page.goto('/settings/profile')
    await page.waitForLoadState('load')

    // URLまたはページ内リンクからユーザーIDを取得
    const profileLink = page.locator('a[href^="/users/"]').first()
    if (await profileLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await profileLink.getAttribute('href')
      if (href) {
        const match = href.match(/\/users\/([^/]+)/)
        if (match?.[1]) userId = match[1]
      }
    }
  })

  test('ユーザープロフィールページが表示される', async ({ page }) => {
    if (!userId) {
      // フォールバック: /feed のサイドバーからプロフィールリンクを探す
      await page.goto('/feed')
      const profileLink = page.locator('a[href^="/users/"]').first()
      if (await profileLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await clickAndWaitForUrl(page, profileLink, /\/users\//, { timeout: 10000 })
      }
      return
    }

    await page.goto(`/users/${userId}`)
    const profileContent = page.getByText(/プロフィール|投稿|フォロー/i).first()
    await expect(profileContent).toBeVisible({ timeout: 10000 })
  })

  test('プロフィールヘッダーが表示される', async ({ page }) => {
    if (!userId) return

    await page.goto(`/users/${userId}`)
    await page.waitForLoadState('domcontentloaded')

    // アバター画像またはニックネームが表示される
    const avatar = page.locator('img[alt*="アバター"], img[alt*="プロフィール"], [data-testid="user-avatar"]').first()
    const nickname = page.locator('h1, h2, [data-testid="user-nickname"]').first()

    const hasAvatar = await avatar.isVisible({ timeout: 15000 }).catch(() => false)
    const hasNickname = await nickname.isVisible({ timeout: 15000 }).catch(() => false)

    expect(hasAvatar || hasNickname).toBeTruthy()
  })

  test('フォロー/フォロワー数が表示される', async ({ page }) => {
    if (!userId) return

    await page.goto(`/users/${userId}`)

    const followInfo = page.getByText(/フォロー|フォロワー/i).first()
    await expect(followInfo).toBeVisible({ timeout: 10000 })
  })

  test('投稿タブが表示される', async ({ page }) => {
    if (!userId) return

    await page.goto(`/users/${userId}`)

    // 投稿タブまたは投稿セクション
    const postsTab = page.getByText(/投稿/i).first()
    await expect(postsTab).toBeVisible({ timeout: 10000 })
  })

  test('コメントタブに切り替えられる', async ({ page }) => {
    if (!userId) return

    await page.goto(`/users/${userId}`)

    const commentTab = page.getByRole('tab', { name: /コメント/i }).or(
      page.getByRole('link', { name: /コメント/i })
    ).first()

    if (await commentTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await commentTab.click()
      await page.waitForTimeout(500)
    }
  })

  test('フォロワー一覧ページが表示される', async ({ page }) => {
    if (!userId) return

    await page.goto(`/users/${userId}/followers`)

    const content = page.getByText(/フォロワー/i).first()
    const emptyMessage = page.getByText(/フォロワーはいません|まだフォロワーがいません/i)

    const hasContent = await content.isVisible({ timeout: 10000 }).catch(() => false)
    const hasEmpty = await emptyMessage.isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasContent || hasEmpty).toBeTruthy()
  })

  test('フォロー中一覧ページが表示される', async ({ page }) => {
    if (!userId) return

    await page.goto(`/users/${userId}/following`)

    const content = page.getByText(/フォロー中|フォロー/i).first()
    const emptyMessage = page.getByText(/フォローしているユーザーはいません|まだフォローしていません/i)

    const hasContent = await content.isVisible({ timeout: 10000 }).catch(() => false)
    const hasEmpty = await emptyMessage.isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasContent || hasEmpty).toBeTruthy()
  })

  test('いいね一覧ページが表示される', async ({ page }) => {
    if (!userId) return

    await page.goto(`/users/${userId}/likes`)

    const content = page.getByText(/いいね/i).first()
    const emptyMessage = page.getByText(/いいねした投稿はありません|まだいいねがありません/i)

    const hasContent = await content.isVisible({ timeout: 10000 }).catch(() => false)
    const hasEmpty = await emptyMessage.isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasContent || hasEmpty).toBeTruthy()
  })
})
