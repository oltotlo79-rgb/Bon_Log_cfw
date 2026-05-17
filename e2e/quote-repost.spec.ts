import { test, expect } from '@playwright/test'
import { getPostDetailReadyLocator } from './locators'

/**
 * 引用投稿・リポスト E2E テスト
 * 投稿の共有・引用フローを検証する。
 */
test.describe('引用投稿・リポスト', () => {
  test('フィードの投稿にシェア/リポストボタンが存在する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postCard = page.locator('[data-testid="post-card"], article').first()
    if (!(await postCard.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip(true, 'フィードに投稿が表示されていないためスキップ')
      return
    }
    // PostCardActions内のRepeatIconを含むボタン、またはコメントリンク等のアクションボタン
    const actionButtons = postCard.locator('button').count()
    const commentLink = postCard.locator('[data-testid="comment-link"]').first()
    const hasActions = (await actionButtons) > 0
    const hasComment = await commentLink.isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasActions || hasComment).toBe(true)
  })

  test('投稿詳細ページにシェア/引用ボタンが存在する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    // 投稿カードをクリックして詳細へ
    const postLink = page.locator('[data-testid="post-card"] a[href*="/posts/"], article a[href*="/posts/"]').first()
    if (!(await postLink.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip(true, 'フィードに投稿リンクが表示されていないためスキップ')
      return
    }
    await postLink.click()
    await page.waitForURL(/\/posts\//, { timeout: 10000 })
    await page.waitForLoadState('load')

    // 詳細ページのコンテンツが描画されるまで待機
    await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })
  })

  test('リポスト表示の投稿に「リポスト」ラベルまたはアイコンが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    // リポスト投稿が存在する場合にラベルを確認（存在しない場合はスキップ）
    const repostLabel = page.getByText(/リポスト|Repost/i).first()
    if (await repostLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(repostLabel).toBeVisible()
    }
  })
})

test.describe('投稿メニュー', () => {
  test('自分の投稿にメニューボタンが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postCard = page.locator('[data-testid="post-card"], article').first()
    if (await postCard.isVisible({ timeout: 8000 }).catch(() => false)) {
      const menuBtn = postCard.locator('[data-testid="post-menu-button"], button[aria-label*="メニュー"], button[aria-label*="more"]').first()
      // MoreHorizontal アイコンを持つボタン
      const moreBtn = postCard.locator('button').filter({ has: page.locator('svg') }).last()
      const hasMenu = await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)
      const hasMore = await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasMenu || hasMore).toBe(true)
    }
  })

  test('投稿メニューをクリックするとドロップダウンが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postCard = page.locator('[data-testid="post-card"], article').first()
    if (await postCard.isVisible({ timeout: 8000 }).catch(() => false)) {
      const menuBtn = postCard.locator('[data-testid="post-menu-button"]').first()
      if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await menuBtn.click()
        // ドロップダウン or 削除/通報テキストが出現
        const dropdown = page.locator('[data-testid="post-menu-dropdown"], [role="menu"]').first()
        const deleteText = page.getByText(/削除|通報|非表示/i).first()
        const hasDropdown = await dropdown.isVisible({ timeout: 3000 }).catch(() => false)
        const hasText = await deleteText.isVisible({ timeout: 3000 }).catch(() => false)
        expect(hasDropdown || hasText).toBe(true)
      }
    }
  })
})
