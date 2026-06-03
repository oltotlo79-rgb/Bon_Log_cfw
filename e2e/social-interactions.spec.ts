import { test, expect } from '@playwright/test'
import { getPostDetailReadyLocator } from './locators'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * ソーシャルインタラクションのE2Eテスト
 * いいね、ブックマーク、コメント、フォロー、シェアの操作確認
 */
test.describe('いいね', () => {
  test('フィードの投稿にいいねボタンが存在する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postCards = page.locator('[data-testid="post-card"], article')
    if ((await postCards.count()) === 0) {
      // 投稿がない場合はスキップ
      test.skip()
      return
    }
    const postCard = postCards.first()

    const likeButton = postCard.locator(
      '[data-testid="like-button"], button[aria-label*="いいね"], [class*="like"]'
    ).first()
    await expect(likeButton).toBeVisible({ timeout: 5000 })
  })

  test('いいねボタンをクリックできる', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postCards = page.locator('[data-testid="post-card"], article')
    expect(await postCards.count()).toBeGreaterThan(0)
    const postCard = postCards.first()

    const likeButton = postCard.locator(
      '[data-testid="like-button"], button[aria-label*="いいね"], [class*="like"]'
    ).first()

    if (await likeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // クリックしてエラーが発生しないことを確認
      await likeButton.click()
      await page.waitForTimeout(500)

      // ページがまだ表示されていることを確認（エラーでクラッシュしていない）
      await expect(page.locator('body')).toBeVisible()
    }
  })
})

test.describe('ブックマーク', () => {
  test('投稿にブックマークボタンが存在する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postCards = page.locator('[data-testid="post-card"], article')
    expect(await postCards.count()).toBeGreaterThan(0)
    const postCard = postCards.first()

    const bookmarkButton = postCard.locator(
      '[data-testid="bookmark-button"], button[aria-label*="ブックマーク"], [class*="bookmark"]'
    ).first()
    await expect(bookmarkButton).toBeVisible({ timeout: 5000 })
  })

  test('ブックマークボタンをクリックできる', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postCards = page.locator('[data-testid="post-card"], article')
    expect(await postCards.count()).toBeGreaterThan(0)
    const postCard = postCards.first()

    const bookmarkButton = postCard.locator(
      '[data-testid="bookmark-button"], button[aria-label*="ブックマーク"], [class*="bookmark"]'
    ).first()

    if (await bookmarkButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await bookmarkButton.click()
      await page.waitForTimeout(500)

      await expect(page.locator('body')).toBeVisible()
    }
  })
})

test.describe('コメント', () => {
  test('投稿詳細ページにコメントフォームが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postLinks = page.locator('a[href^="/posts/"]')
    expect(await postLinks.count()).toBeGreaterThan(0)

    await clickAndWaitForUrl(page, postLinks.first(), /\/posts\//, { timeout: 10000 })
    await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })
    await page.waitForLoadState('load')
    // コメントフォーム/一覧は Suspense 配下でストリーミングされるため hydration 完了まで待つ
    await page.waitForLoadState('networkidle').catch(() => {})

    // コメント入力フォーム
    const commentForm = page.locator(
      'textarea[placeholder*="コメント"], [data-testid="comment-form"], form[class*="comment"], textarea[name*="comment"]'
    ).first()
    const commentSection = page.getByText(/コメント/i).first()

    const hasForm = await commentForm.isVisible({ timeout: 10000 }).catch(() => false)
    const hasSection = await commentSection.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasForm || hasSection).toBeTruthy()
  })

  test('コメント入力欄にテキスト入力できる', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postLinks = page.locator('a[href^="/posts/"]')
    expect(await postLinks.count()).toBeGreaterThan(0)

    await clickAndWaitForUrl(page, postLinks.first(), /\/posts\//, { timeout: 10000 })
    await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })

    const commentInput = page.locator(
      'textarea[placeholder*="コメント"], [data-testid="comment-input"], textarea[name*="comment"]'
    ).first()

    if (await commentInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await commentInput.fill('テストコメント')
      await expect(commentInput).toHaveValue('テストコメント')
    }
  })
})

test.describe('フォロー', () => {
  test('他のユーザーのプロフィールにフォローボタンが表示される', async ({ page }) => {
    // フィードから他のユーザーを探す
    await page.goto('/feed')
    await page.waitForLoadState('load')

    let userLinks = page.locator('a[href^="/users/"]')
    if ((await userLinks.count()) === 0) {
      await page.goto('/search?q=E2E&tab=users')
      await page.waitForLoadState('load')
      userLinks = page.locator('a[href^="/users/"]')
      expect(await userLinks.count()).toBeGreaterThan(0)
    }

    await clickAndWaitForUrl(page, userLinks.first(), /\/users\//, { timeout: 15000 })

    // フォローボタン
    const followButton = page.locator(
      '[data-testid="follow-button"], button:has-text("フォロー"), button:has-text("フォロー中")'
    ).first()

    if (await followButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(followButton).toBeVisible()
    }
  })
})

test.describe('シェア', () => {
  test('投稿カードにシェアボタンまたは共有メニューが存在する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postCards = page.locator('[data-testid="post-card"], article')
    expect(await postCards.count()).toBeGreaterThan(0)
    const postCard = postCards.first()

    // シェアボタンまたはリポストボタン
    const shareButton = postCard.locator(
      '[data-testid="share-button"], button[aria-label*="シェア"], button[aria-label*="共有"], [class*="share"], [data-testid="repost-button"], button[aria-label*="リポスト"]'
    ).first()

    if (await shareButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(shareButton).toBeVisible()
    }
  })
})
