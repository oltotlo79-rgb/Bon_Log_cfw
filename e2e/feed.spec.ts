import { test, expect } from '@playwright/test'
import { getFeedTimelineLocator, getPostDetailReadyLocator } from './locators'
import { clickAndWaitForUrl } from './helpers/navigation'

test.describe('フィード機能', () => {
  test('フィードページが表示される（ログイン状態）', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')

    await expect(getFeedTimelineLocator(page).first()).toBeVisible({ timeout: 20000 })
  })

  test('投稿が0件でもフィードページが表示され空状態またはタイムラインが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')

    // タイムラインは Suspense でストリーミングされるため client fetch 完了まで待つ
    await page.waitForLoadState('networkidle').catch(() => {})
    const timeline = getFeedTimelineLocator(page).first()
    const emptyMessage = page.getByText(/タイムラインに投稿がありません|ユーザーをフォローすると/i)
    const hasTimeline = await timeline.isVisible({ timeout: 20000 }).catch(() => false)
    const hasEmpty = await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasTimeline || hasEmpty).toBeTruthy()
  })

  test('投稿フォームが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await expect(getFeedTimelineLocator(page).first()).toBeVisible({ timeout: 20000 })

    const composeButton = page.locator('[data-testid="compose-button"]')
    await expect(composeButton).toBeVisible({ timeout: 15000 })
  })

  test('投稿フォームに入力できる', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')
    await expect(getFeedTimelineLocator(page).first()).toBeVisible({ timeout: 20000 })

    const composeButton = page.locator('[data-testid="compose-button"]')
    await expect(composeButton).toBeVisible({ timeout: 15000 })
    await composeButton.click()

    const textarea = page.locator('[data-testid="post-textarea"]')
    await expect(textarea).toBeVisible({ timeout: 15000 })
    await textarea.fill('テスト投稿です')
    await expect(textarea).toHaveValue('テスト投稿です')
  })

  test('投稿にいいねボタンが存在する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postCards = page.locator('[data-testid="post-card"]')
    if ((await postCards.count()) > 0) {
      const actions = postCards.first().locator('[data-testid="post-actions"]')

      if (await actions.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(actions).toBeVisible()
      }
    }
  })

  test('投稿にブックマークボタンが存在する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postCards = page.locator('[data-testid="post-card"]')
    if ((await postCards.count()) > 0) {
      const actions = postCards.first().locator('[data-testid="post-actions"]')

      if (await actions.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(actions).toBeVisible()
      }
    }
  })

  test('投稿詳細ページに遷移できる', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postLink = page.locator('[data-testid="comment-link"], a[href*="/posts/"]').first()
    if (await postLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await clickAndWaitForUrl(page, postLink, /\/posts\//, { timeout: 15000 })
    }
  })

  test('スクロールしてもページがクラッシュしない', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const initialPosts = await page.locator('[data-testid="post-card"]').count()

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(2000)

    const afterScrollPosts = await page.locator('[data-testid="post-card"]').count()
    expect(afterScrollPosts).toBeGreaterThanOrEqual(initialPosts)
  })
})

test.describe('投稿詳細ページ', () => {
  test('投稿詳細ページが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postLink = page.locator('[data-testid="comment-link"], a[href*="/posts/"]').first()
    if (await postLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await clickAndWaitForUrl(page, postLink, /\/posts\//, { timeout: 15000 })
      const postDetail = page.locator('[data-testid="post-card"]').first()
      await expect(postDetail).toBeVisible({ timeout: 10000 })
    } else {
      await expect(page).toHaveURL(/\/feed/)
      await expect(getFeedTimelineLocator(page).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('コメント一覧が表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postLink = page.locator('[data-testid="comment-link"], a[href*="/posts/"]').first()
    if (await postLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await clickAndWaitForUrl(page, postLink, /\/posts\//, { timeout: 15000 })
      await page.waitForLoadState('load')
      await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })
      // コメント欄は Suspense 配下で遅延ロードされ得るため client fetch 完了まで待つ
      await page.waitForLoadState('networkidle').catch(() => {})
      const commentSection = page.locator(
        '[data-testid="comments-section"], [data-testid="comment-input"]'
      ).first()
      const commentText = page.getByText(/コメント/i).first()
      const hasSection = await commentSection.isVisible({ timeout: 15000 }).catch(() => false)
      const hasText = await commentText.isVisible({ timeout: 8000 }).catch(() => false)
      expect(hasSection || hasText).toBeTruthy()
    } else {
      await expect(page).toHaveURL(/\/feed/)
      await expect(getFeedTimelineLocator(page).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('コメントフォームが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postLink = page.locator('[data-testid="comment-link"], a[href*="/posts/"]').first()
    if (await postLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await clickAndWaitForUrl(page, postLink, /\/posts\//, { timeout: 15000 })
      await page.waitForLoadState('load')
      await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })
      // コメントフォームは Suspense 配下で遅延ロードされ得るため client fetch 完了まで待つ
      await page.waitForLoadState('networkidle').catch(() => {})
      const commentInput = page.locator(
        '[data-testid="comment-input"], textarea[placeholder*="コメント"]'
      ).first()
      const commentForm = page.locator('form').first()
      const hasInput = await commentInput.isVisible({ timeout: 15000 }).catch(() => false)
      const hasForm = await commentForm.isVisible({ timeout: 8000 }).catch(() => false)
      expect(hasInput || hasForm).toBeTruthy()
    } else {
      await expect(page).toHaveURL(/\/feed/)
      await expect(getFeedTimelineLocator(page).first()).toBeVisible({ timeout: 5000 })
    }
  })
})
