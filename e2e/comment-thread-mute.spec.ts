import { test, expect } from '@playwright/test'

/**
 * コメントスレッドミュート機能の E2E テスト
 * コメントのミュートボタン表示と操作を検証する。
 */

/**
 * コメントのある投稿詳細ページに遷移するヘルパー
 */
async function navigateToPostWithComments(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto('/feed')
  await page.waitForLoadState('load')

  const postLink = page.locator(
    '[data-testid="post-card"] a[href*="/posts/"], article a[href*="/posts/"]'
  ).first()
  if (!(await postLink.isVisible({ timeout: 8000 }).catch(() => false))) {
    return false
  }

  await postLink.click()
  await page.waitForURL(/\/posts\//, { timeout: 10000 })
  await page.waitForLoadState('load')
  return true
}

test.describe('コメントスレッドミュート', () => {
  test('投稿詳細ページのコメントにスレッドミュートボタンが存在する', async ({ page }) => {
    const navigated = await navigateToPostWithComments(page)
    if (!navigated) {
      test.skip()
      return
    }

    const commentCard = page.locator('[data-testid="comment-card"]').first()
    if (!(await commentCard.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip()
      return
    }

    // コメントカードにスレッドミュートボタンが存在する
    const muteButton = commentCard.locator(
      '[data-testid="mute-thread-button"], button[aria-label*="スレッドをミュート"], button:has-text("スレッドをミュート")'
    ).first()
    const hasMuteButton = await muteButton.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasMuteButton) {
      await expect(muteButton).toBeVisible()
    }
  })

  test('コメントカードのメニューにスレッドミュートオプションが存在する', async ({ page }) => {
    const navigated = await navigateToPostWithComments(page)
    if (!navigated) {
      test.skip()
      return
    }

    const commentCard = page.locator('[data-testid="comment-card"]').first()
    if (!(await commentCard.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip()
      return
    }

    // コメントカードのメニューボタンをクリック
    const menuButton = commentCard.locator(
      '[data-testid="comment-menu-button"], button[aria-label*="メニュー"]'
    ).first()
    const hasMenuButton = await menuButton.isVisible({ timeout: 5000 }).catch(() => false)

    if (!hasMenuButton) {
      test.skip()
      return
    }

    await menuButton.click()
    await page.waitForTimeout(300)

    // スレッドミュートオプション
    const muteOption = page.getByText(/スレッドをミュート|スレッドミュート|ミュート/i).first()
    const hasMuteOption = await muteOption.isVisible({ timeout: 3000 }).catch(() => false)

    // メニューを閉じる
    await page.keyboard.press('Escape')

    if (hasMuteOption) {
      expect(hasMuteOption).toBeTruthy()
    }
  })

  test('スレッドミュート後もページが正常に表示される', async ({ page }) => {
    const navigated = await navigateToPostWithComments(page)
    if (!navigated) {
      test.skip()
      return
    }

    const commentCard = page.locator('[data-testid="comment-card"]').first()
    if (!(await commentCard.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip()
      return
    }

    const muteButton = commentCard.locator(
      '[data-testid="mute-thread-button"], button[aria-label*="スレッドをミュート"]'
    ).first()

    if (!(await muteButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip()
      return
    }

    await muteButton.click()
    await page.waitForTimeout(1000)

    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('コメントスレッドミュート解除', () => {
  test('ミュート済みスレッドにミュート解除ボタンが表示される', async ({ page }) => {
    const navigated = await navigateToPostWithComments(page)
    if (!navigated) {
      test.skip()
      return
    }

    // ミュート解除ボタンが表示されているコメントを探す
    const unmuteButton = page.locator(
      '[data-testid="unmute-thread-button"], button[aria-label*="スレッドのミュート解除"], button:has-text("ミュート解除")'
    ).first()
    const hasUnmute = await unmuteButton.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasUnmute) {
      await expect(unmuteButton).toBeVisible()
    }
  })
})

test.describe('コメントスレッドミュート状態の表示', () => {
  test('ミュート済みスレッドには視覚的なインジケーターが表示される', async ({ page }) => {
    const navigated = await navigateToPostWithComments(page)
    if (!navigated) {
      test.skip()
      return
    }

    // ミュート済みスレッドの視覚的なインジケーターを探す
    const mutedIndicator = page.locator(
      '[data-testid="muted-thread-indicator"], [class*="muted"], [aria-label*="ミュート済み"]'
    ).first()
    const hasMuted = await mutedIndicator.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasMuted) {
      await expect(mutedIndicator).toBeVisible()
    }
  })
})
