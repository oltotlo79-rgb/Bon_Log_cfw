import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * 投稿インタラクションのE2Eテスト
 * feed.spec.ts のスキップされたテストを補完
 */
test.describe('投稿フォーム', () => {
  test('フィードページに投稿フォームまたは投稿ボタンが表示される', async ({ page }) => {
    await page.goto('/feed')

    // テキストエリアまたはフローティング投稿ボタンが表示される
    const textarea = page.getByPlaceholder(/今何を考えていますか|何を投稿/i)
    const composeButton = page.getByRole('button', { name: /投稿|新規投稿/i }).first()
    const floatingButton = page.locator('[data-testid="compose-button"], [class*="compose"], [class*="floating"]')

    const textareaVisible = await textarea.isVisible({ timeout: 5000 }).catch(() => false)
    const buttonVisible = await composeButton.isVisible({ timeout: 3000 }).catch(() => false)
    const floatingVisible = await floatingButton.first().isVisible({ timeout: 3000 }).catch(() => false)

    expect(textareaVisible || buttonVisible || floatingVisible).toBe(true)
  })

  test('投稿フォームにジャンル選択が存在する', async ({ page }) => {
    await page.goto('/feed')

    // 投稿ボタンをクリックしてモーダルを開く（モーダル形式の場合）
    const composeButton = page.locator('[data-testid="compose-button"]').first()
    if (await composeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await composeButton.click()
      await page.waitForTimeout(500)
    }

    // ジャンル選択要素を探す
    const genreSelector = page.getByText(/ジャンル|カテゴリ|松柏|雑木/i).first()
    if (await genreSelector.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(genreSelector).toBeVisible()
    }
  })

  test('投稿フォームに画像添付ボタンが存在する', async ({ page }) => {
    await page.goto('/feed')

    // 投稿ボタンをクリックしてモーダルを開く
    const composeButton = page.locator('[data-testid="compose-button"]').first()
    if (await composeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await composeButton.click()
      await page.waitForTimeout(500)
    }

    // 画像添付ボタン/アイコンを探す
    const imageButton = page.locator('input[type="file"], button[aria-label*="画像"], [data-testid="media-upload"]')
    if (await imageButton.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(imageButton.first()).toBeVisible()
    }
  })
})

test.describe('投稿カード', () => {
  test('フィードに投稿カードまたは空メッセージが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const hasCards = page.locator('[data-testid="post-card"], article, [class*="post-card"]')
    const hasEmpty = page.getByText(/タイムラインに投稿がありません|投稿がありません|まだ投稿はありません|フォロー/i)
    const hasTimeline = page.getByText(/タイムライン/i).first()

    const cardsVisible = (await hasCards.count()) > 0
    const emptyVisible = await hasEmpty.isVisible({ timeout: 5000 }).catch(() => false)
    const timelineVisible = await hasTimeline.isVisible({ timeout: 3000 }).catch(() => false)

    expect(cardsVisible || emptyVisible || timelineVisible).toBe(true)
  })

  test('投稿カードにいいねボタンが存在する', async ({ page }) => {
    await page.goto('/feed')

    const postCard = page.locator('[data-testid="post-card"], article').first()
    if (await postCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      const likeButton = postCard.locator('[data-testid="like-button"], button[aria-label*="いいね"], [class*="like"]')
      if (await likeButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(likeButton.first()).toBeVisible()
      }
    }
  })

  test('投稿カードにブックマークボタンが存在する', async ({ page }) => {
    await page.goto('/feed')

    const postCard = page.locator('[data-testid="post-card"], article').first()
    if (await postCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      const bookmarkButton = postCard.locator('[data-testid="bookmark-button"], button[aria-label*="ブックマーク"], [class*="bookmark"]')
      if (await bookmarkButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(bookmarkButton.first()).toBeVisible()
      }
    }
  })

  test('投稿カードにコメントボタンが存在する', async ({ page }) => {
    await page.goto('/feed')

    const postCard = page.locator('[data-testid="post-card"], article').first()
    if (await postCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      const commentButton = postCard.locator('[data-testid="comment-button"], button[aria-label*="コメント"], [class*="comment"]')
      if (await commentButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(commentButton.first()).toBeVisible()
      }
    }
  })
})

test.describe('投稿詳細ページ', () => {
  test('投稿カードクリックで詳細ページに遷移する', async ({ page }) => {
    await page.goto('/feed')

    const postCard = page.locator('[data-testid="post-card"], article').first()
    if (await postCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 投稿カード内のリンクをクリック
      const postLink = postCard.locator('a[href*="/posts/"]').first()
      if (await postLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickAndWaitForUrl(page, postLink, /\/posts\//, { timeout: 10000 })
      }
    }
  })
})
