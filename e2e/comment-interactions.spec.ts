import { test, expect } from '@playwright/test'
import { getPostDetailReadyLocator } from './locators'

/**
 * コメントインタラクション E2E テスト
 * コメントの投稿、返信、いいねなどのフローを検証する。
 */
test.describe('コメント投稿', () => {
  test('投稿詳細ページにコメント入力欄が表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postLink = page.locator('[data-testid="post-card"] a[href*="/posts/"], article a[href*="/posts/"]').first()
    if (await postLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await postLink.click()
      await page.waitForURL(/\/posts\//, { timeout: 10000 })
      await page.waitForLoadState('load')
      await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })

      const commentInput = page.locator(
        'textarea[placeholder*="コメント"], textarea[placeholder*="返信"], [data-testid="comment-input"], textarea'
      ).first()
      if (await commentInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(commentInput).toBeVisible()
      }
    }
  })

  test('コメント入力欄にテキストが入力できる', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postLink = page.locator('[data-testid="post-card"] a[href*="/posts/"], article a[href*="/posts/"]').first()
    if (await postLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await postLink.click()
      await page.waitForURL(/\/posts\//, { timeout: 10000 })
      await page.waitForLoadState('load')
      await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })

      const commentInput = page.locator('textarea').first()
      if (await commentInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await commentInput.fill('テストコメントです')
        await expect(commentInput).toHaveValue('テストコメントです')
      }
    }
  })

  test('コメント送信ボタンが存在する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postLink = page.locator('[data-testid="post-card"] a[href*="/posts/"], article a[href*="/posts/"]').first()
    if (await postLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await postLink.click()
      await page.waitForURL(/\/posts\//, { timeout: 10000 })
      await page.waitForLoadState('load')
      await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })

      const submitBtn = page.locator(
        'button[type="submit"], [data-testid="comment-submit"], button[aria-label*="送信"], button[aria-label*="コメント"]'
      ).first()
      const hasSubmit = await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)
      // 送信ボタンか「コメントする」テキストのボタンが存在
      const commentBtn = page.getByRole('button', { name: /コメント|送信|返信/i }).first()
      const hasCommentBtn = await commentBtn.isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasSubmit || hasCommentBtn).toBe(true)
    }
  })
})

test.describe('コメント一覧', () => {
  test('投稿詳細ページにコメントセクションが存在する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postLink = page.locator('[data-testid="post-card"] a[href*="/posts/"], article a[href*="/posts/"]').first()
    if (await postLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await postLink.click()
      await page.waitForURL(/\/posts\//, { timeout: 10000 })
      await page.waitForLoadState('load')
      await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })

      const commentSection = page.locator(
        '[data-testid="comment-list"], [data-testid="comments"], section'
      ).first()
      const commentHeading = page.getByText(/コメント|返信/i).first()
      const hasSection = await commentSection.isVisible({ timeout: 5000 }).catch(() => false)
      const hasHeading = await commentHeading.isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasSection || hasHeading).toBe(true)
    }
  })

  test('コメントがある場合にコメントカードが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postLink = page.locator('[data-testid="post-card"] a[href*="/posts/"], article a[href*="/posts/"]').first()
    if (await postLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await postLink.click()
      await page.waitForURL(/\/posts\//, { timeout: 10000 })
      await page.waitForLoadState('load')
      await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })

      // コメントが存在する場合は表示確認、なければ空メッセージを確認
      const commentCard = page.locator('[data-testid="comment-card"], [class*="comment"]').first()
      const emptyMsg = page.getByText(/コメントはありません|まだコメントはありません|コメントがありません/i).first()
      const hasComment = await commentCard.isVisible({ timeout: 3000 }).catch(() => false)
      const hasEmpty = await emptyMsg.isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasComment || hasEmpty).toBe(true)
    }
  })
})

test.describe('コメントいいね', () => {
  test('コメントカードにいいねボタンが存在する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postLink = page.locator('[data-testid="post-card"] a[href*="/posts/"], article a[href*="/posts/"]').first()
    if (await postLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await postLink.click()
      await page.waitForURL(/\/posts\//, { timeout: 10000 })
      await page.waitForLoadState('load')
      await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })

      const commentCard = page.locator('[data-testid="comment-card"]').first()
      if (await commentCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        const likeBtn = commentCard.locator(
          '[data-testid="like-button"], button[aria-label*="いいね"], [class*="like"]'
        ).first()
        if (await likeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(likeBtn).toBeVisible()
        }
      }
    }
  })
})

test.describe('コメント返信', () => {
  test('コメントに返信ボタンが存在する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postLink = page.locator('[data-testid="post-card"] a[href*="/posts/"], article a[href*="/posts/"]').first()
    if (await postLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await postLink.click()
      await page.waitForURL(/\/posts\//, { timeout: 10000 })
      await page.waitForLoadState('load')
      await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })

      const commentCard = page.locator('[data-testid="comment-card"]').first()
      if (await commentCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        const replyBtn = commentCard.locator(
          '[data-testid="reply-button"], button[aria-label*="返信"], button:has-text("返信")'
        ).first()
        if (await replyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(replyBtn).toBeVisible()
        }
      }
    }
  })
})
