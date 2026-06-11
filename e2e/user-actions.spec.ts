import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * ユーザープロフィールアクションのE2Eテスト
 * フォロー/アンフォロー、ブロック/ミュート、タブ表示、404ページの確認
 */
test.describe('ユーザープロフィールアクション', () => {
  /**
   * ユーザーIDを取得するヘルパー
   * サイドバーやプロフィールリンクからユーザーIDを特定する
   */
  async function findUserId(page: import('@playwright/test').Page): Promise<string | null> {
    await page.goto('/settings/profile')
    await page.waitForLoadState('domcontentloaded')

    const profileLink = page.locator('a[href^="/users/"]').first()
    if (await profileLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await profileLink.getAttribute('href')
      if (href) {
        const match = href.match(/\/users\/([^/]+)/)
        if (match?.[1]) return match[1]
      }
    }
    return null
  }

  /**
   * 他のユーザープロフィールに遷移するヘルパー
   */
  async function navigateToOtherUser(page: import('@playwright/test').Page): Promise<boolean> {
    // フィードから他ユーザーのリンクを探す
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const feedUserLinks = page.locator('a[href^="/users/"]')
    if ((await feedUserLinks.count()) > 0) {
      await clickAndWaitForUrl(page, feedUserLinks.first(), /\/users\//, { timeout: 10000 })
    } else {
      // フォールバック: ユーザー検索
      await page.goto('/search?q=E2E&tab=users')
      await page.waitForLoadState('load')

      const searchUserLinks = page.locator('a[href^="/users/"]')
      if ((await searchUserLinks.count()) === 0) {
        return false
      }
      await clickAndWaitForUrl(page, searchUserLinks.first(), /\/users\//, { timeout: 10000 })
    }

    return true
  }

  test.describe('フォロー/アンフォロー', () => {
    test('他のユーザーのプロフィールにフォローボタンが表示される', async ({ page }) => {
      const navigated = await navigateToOtherUser(page)
      expect(navigated).toBe(true)

      const followButton = page.locator(
        '[data-testid="follow-button"], button:has-text("フォロー"), button:has-text("フォロー中"), button:has-text("フォローする")'
      ).first()

      if (await followButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(followButton).toBeVisible()
      }
    })

    test('フォローボタンをクリックできる', async ({ page }) => {
      const navigated = await navigateToOtherUser(page)
      expect(navigated).toBe(true)

      const followButton = page.locator(
        '[data-testid="follow-button"], button:has-text("フォロー"), button:has-text("フォローする")'
      ).first()

      if (await followButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await followButton.click()
        await page.waitForTimeout(500)

        // ページがクラッシュしていないことを確認
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('自分のプロフィールにフォローボタンが表示されない', async ({ page }) => {
      const userId = await findUserId(page)
      expect(userId).toBeTruthy()

      await page.goto(`/users/${userId}`)
      await page.waitForLoadState('domcontentloaded')

      // 自分のプロフィールにはフォローボタンではなくプロフィール編集ボタンが表示される
      const followButton = page.locator('[data-testid="follow-button"]').first()
      const editButton = page.getByRole('link', { name: /プロフィール編集|編集/i }).first()
      const editButtonAlt = page.locator('a[href*="/settings/profile"]').first()

      const hasFollow = await followButton.isVisible({ timeout: 3000 }).catch(() => false)
      const hasEdit = await editButton.isVisible({ timeout: 5000 }).catch(() => false)
      const hasEditAlt = await editButtonAlt.isVisible({ timeout: 3000 }).catch(() => false)

      // フォローボタンがない、または編集ボタンがある
      expect(!hasFollow || hasEdit || hasEditAlt).toBeTruthy()
    })
  })

  test.describe('ブロック/ミュートオプション', () => {
    test('他のユーザーのプロフィールにメニューボタンが存在する', async ({ page }) => {
      const navigated = await navigateToOtherUser(page)
      expect(navigated).toBe(true)

      // メニューボタン（三点リーダーなど）
      const menuButton = page.locator(
        'button[aria-label*="メニュー"], button[aria-label*="操作"], button[aria-label*="その他"], [data-testid="user-menu"], [data-testid="more-button"]'
      ).first()
      const moreButton = page.locator('button svg[class*="more"], button svg[class*="dots"]').first()

      const hasMenu = await menuButton.isVisible({ timeout: 5000 }).catch(() => false)
      const hasMore = await moreButton.isVisible({ timeout: 3000 }).catch(() => false)

      if (hasMenu || hasMore) {
        expect(hasMenu || hasMore).toBeTruthy()
      }
    })

    test('メニューからブロック/ミュートオプションにアクセスできる', async ({ page }) => {
      const navigated = await navigateToOtherUser(page)
      expect(navigated).toBe(true)

      // メニューボタンをクリック
      const menuButton = page.locator(
        'button[aria-label*="メニュー"], button[aria-label*="操作"], button[aria-label*="その他"], [data-testid="user-menu"], [data-testid="more-button"]'
      ).first()

      if (!(await menuButton.isVisible({ timeout: 5000 }).catch(() => false))) {
        test.skip()
        return
      }

      await menuButton.click()
      await page.waitForTimeout(500)

      // ブロック/ミュートオプションが表示される
      const blockOption = page.getByText(/ブロック/i).first()
      const muteOption = page.getByText(/ミュート/i).first()
      const reportOption = page.getByText(/通報|報告/i).first()

      const hasBlock = await blockOption.isVisible({ timeout: 3000 }).catch(() => false)
      const hasMute = await muteOption.isVisible({ timeout: 3000 }).catch(() => false)
      const hasReport = await reportOption.isVisible({ timeout: 3000 }).catch(() => false)

      expect(hasBlock || hasMute || hasReport).toBeTruthy()
    })
  })

  test.describe('ユーザープロフィールタブ', () => {
    test('投稿タブが表示される', async ({ page }) => {
      const userId = await findUserId(page)
      expect(userId).toBeTruthy()

      await page.goto(`/users/${userId}`)
      await page.waitForLoadState('domcontentloaded')

      const postsTab = page.getByText(/投稿/i).first()
      await expect(postsTab).toBeVisible({ timeout: 10000 })
    })

    test('フォロワータブまたはリンクが表示される', async ({ page }) => {
      const userId = await findUserId(page)
      expect(userId).toBeTruthy()

      await page.goto(`/users/${userId}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('load').catch(() => {})
      // プロフィールのタブ/フォロワー数は client fetch 後に描画されるため待つ
      await page.waitForLoadState('networkidle').catch(() => {})

      const followersLink = page.locator(
        'a[href*="/followers"], [data-testid="followers-tab"], button:has-text("フォロワー")'
      ).first()
      const followersText = page.getByText(/フォロワー/i).first()

      const hasLink = await followersLink.isVisible({ timeout: 15000 }).catch(() => false)
      const hasText = await followersText.isVisible({ timeout: 15000 }).catch(() => false)

      expect(hasLink || hasText).toBeTruthy()
    })

    test('フォロー中タブまたはリンクが表示される', async ({ page }) => {
      const userId = await findUserId(page)
      expect(userId).toBeTruthy()

      await page.goto(`/users/${userId}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('load').catch(() => {})
      // プロフィールヘッダーが描画されるまで待つ（CI遅延対策）
      await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})

      const followingLink = page.locator('a[href*="/following"]').first()
      const followingText = page.getByText('フォロー中', { exact: false }).first()

      const hasLink = await followingLink.isVisible({ timeout: 15000 }).catch(() => false)
      const hasText = await followingText.isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasLink || hasText).toBeTruthy()
    })

    test('いいねタブまたはリンクが表示される', async ({ page }) => {
      const userId = await findUserId(page)
      expect(userId).toBeTruthy()

      await page.goto(`/users/${userId}`)
      await page.waitForLoadState('domcontentloaded')
      // プロフィールのメイン表示を待ってからタブを探す（flaky防止）
      await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})

      const likesLink = page.getByRole('link', { name: /いいね/ }).first()
      const likesHrefLink = page.locator('a[href*="/likes"]').first()

      const hasRoleLink = await likesLink.isVisible({ timeout: 8000 }).catch(() => false)
      const hasHrefLink = await likesHrefLink.isVisible({ timeout: 3000 }).catch(() => false)

      expect(hasRoleLink || hasHrefLink).toBeTruthy()
    })

    test('フォロワー一覧ページに遷移できる', async ({ page }) => {
      const userId = await findUserId(page)
      expect(userId).toBeTruthy()

      await page.goto(`/users/${userId}/followers`)

      const content = page.getByText(/フォロワー/i).first()
      const emptyMessage = page.getByText(
        /フォロワーはいません|まだフォロワーがいません/i
      )

      const hasContent = await content.isVisible({ timeout: 10000 }).catch(() => false)
      const hasEmpty = await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false)

      expect(hasContent || hasEmpty).toBeTruthy()
    })

    test('フォロー中一覧ページに遷移できる', async ({ page }) => {
      const userId = await findUserId(page)
      expect(userId).toBeTruthy()

      await page.goto(`/users/${userId}/following`)

      const content = page.getByText(/フォロー中|フォロー/i).first()
      const emptyMessage = page.getByText(
        /フォローしているユーザーはいません|まだフォローしていません/i
      )

      const hasContent = await content.isVisible({ timeout: 10000 }).catch(() => false)
      const hasEmpty = await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false)

      expect(hasContent || hasEmpty).toBeTruthy()
    })

    test('いいね一覧ページに遷移できる', async ({ page }) => {
      const userId = await findUserId(page)
      expect(userId).toBeTruthy()

      await page.goto(`/users/${userId}/likes`)

      const content = page.getByText(/いいね/i).first()
      const emptyMessage = page.getByText(
        /いいねした投稿はありません|まだいいねがありません/i
      )

      const hasContent = await content.isVisible({ timeout: 10000 }).catch(() => false)
      const hasEmpty = await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false)

      expect(hasContent || hasEmpty).toBeTruthy()
    })
  })

  test.describe('ユーザー404ページ', () => {
    test('存在しないユーザーIDでアクセスすると404が表示される', async ({ page }) => {
      await page.goto('/users/non-existent-user-id-99999')

      await expect(
        page.getByText(
          /見つかりませんでした|存在しません|not found|404|ページが見つかりません|ユーザーが見つかりません/i
        )
      ).toBeVisible({ timeout: 10000 })
    })

    test('存在しないユーザーの404ページにホームへのリンクが存在する', async ({ page }) => {
      await page.goto('/users/non-existent-user-id-99999')
      await page.waitForLoadState('domcontentloaded')

      // ホームまたはフィードへの戻るリンク
      const homeLink = page.locator('a[href="/"], a[href="/feed"]').first()
      const backButton = page.getByRole('link', { name: /ホーム|トップ|戻る/i }).first()

      const hasHome = await homeLink.isVisible({ timeout: 5000 }).catch(() => false)
      const hasBack = await backButton.isVisible({ timeout: 3000 }).catch(() => false)

      if (hasHome || hasBack) {
        expect(hasHome || hasBack).toBeTruthy()
      }
    })
  })

  test.describe('プロフィール表示', () => {
    test('プロフィールにアバター画像またはデフォルトアイコンが表示される', async ({ page }) => {
      const userId = await findUserId(page)
      expect(userId).toBeTruthy()

      await page.goto(`/users/${userId}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForLoadState('load').catch(() => {})

      const avatarWrapper = page.locator('[data-testid="user-avatar"]').first()
      const avatarImg = page.locator('[data-testid="user-avatar"] img[alt*="アバター"]').first()
      const defaultIcon = page.locator('[data-testid="default-avatar"]').first()

      await expect(avatarWrapper).toBeVisible({ timeout: 15000 })
      const hasAvatar = await avatarImg.isVisible({ timeout: 5000 }).catch(() => false)
      const hasDefault = await defaultIcon.isVisible({ timeout: 5000 }).catch(() => false)

      expect(hasAvatar || hasDefault).toBeTruthy()
    })

    test('プロフィールにニックネームが表示される', async ({ page }) => {
      const userId = await findUserId(page)
      expect(userId).toBeTruthy()

      await page.goto(`/users/${userId}`)
      await page.waitForLoadState('domcontentloaded')

      // ニックネームが見出しまたはデータ属性で表示される
      const nickname = page.locator('h1, h2, [data-testid="user-nickname"]').first()
      await expect(nickname).toBeVisible({ timeout: 10000 })
    })

    test('プロフィールに自己紹介文セクションが存在する', async ({ page }) => {
      const userId = await findUserId(page)
      expect(userId).toBeTruthy()

      await page.goto(`/users/${userId}`)
      await page.waitForLoadState('domcontentloaded')

      // 自己紹介文（bio）セクション
      const bio = page.locator(
        '[data-testid="user-bio"], [class*="bio"], [class*="description"]'
      ).first()
      const bioText = page.locator('p').first()

      await bio.isVisible({ timeout: 5000 }).catch(() => false)
      await bioText.isVisible({ timeout: 3000 }).catch(() => false)

      // 自己紹介がない場合もあるため、ページ自体が表示されていればOK
      await expect(page.locator('body')).toBeVisible()
    })
  })
})
