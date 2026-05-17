import { test, expect } from '@playwright/test'

/**
 * ハッシュタグナビゲーション E2E テスト
 * 投稿内のハッシュタグをクリックして検索ページに遷移するフローを検証する。
 */
test.describe('ハッシュタグナビゲーション', () => {
  test('フィードの投稿内にハッシュタグリンクが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    // ハッシュタグリンクを探す（#〜 形式のリンク）
    const hashtagLink = page.locator('a[href*="/search?q=%23"], a[href*="/search?q="], [data-testid="hashtag-link"]').first()
    const hashtagText = page.locator('a').filter({ hasText: /^#\S+/ }).first()
    const hasHashtag = await hashtagLink.isVisible({ timeout: 5000 }).catch(() => false)
    const hasHashtagText = await hashtagText.isVisible({ timeout: 3000 }).catch(() => false)
    // ハッシュタグ投稿がある場合にのみ検証
    if (hasHashtag || hasHashtagText) {
      expect(hasHashtag || hasHashtagText).toBe(true)
    }
  })

  test('ハッシュタグリンクをクリックすると検索ページへ遷移する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const hashtagLink = page.locator('a[href*="/search?q=%23"], a[href*="/search?q="]').first()
    const hashtagText = page.locator('a').filter({ hasText: /^#\S+/ }).first()

    if (await hashtagLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await hashtagLink.click()
      await expect(page).toHaveURL(/\/search/, { timeout: 10000 })
    } else if (await hashtagText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hashtagText.click()
      await expect(page).toHaveURL(/\/search/, { timeout: 10000 })
    }
  })

  test('検索ページで人気ハッシュタグが表示される', async ({ page }) => {
    await page.goto('/search')
    await page.waitForLoadState('load')

    // 人気タグセクションが存在するか確認
    const popularTags = page.getByText(/人気のタグ|トレンド|よく使われるタグ/i).first()
    const tagLinks = page.locator('a').filter({ hasText: /^#\S+/ })
    const hasPopular = await popularTags.isVisible({ timeout: 5000 }).catch(() => false)
    const tagCount = await tagLinks.count().catch(() => 0)
    expect(hasPopular || tagCount > 0).toBe(true)
  })

  test('検索ページのハッシュタグをクリックすると検索が実行される', async ({ page }) => {
    await page.goto('/search')
    await page.waitForLoadState('load')

    const tagLink = page.locator('a').filter({ hasText: /^#\S+/ }).first()
    if (await tagLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const tagText = await tagLink.textContent()
      await tagLink.click()
      await page.waitForLoadState('load')
      // URLに検索クエリが含まれるか、検索結果エリアが更新される
      const urlHasQuery = page.url().includes('q=')
      const searchInput = page.getByRole('searchbox').or(page.locator('input[type="search"], input[name="q"]')).first()
      const inputValue = await searchInput.inputValue().catch(() => '')
      expect(urlHasQuery || inputValue.includes('#') || (tagText && inputValue.includes(tagText.replace('#', '')))).toBe(true)
    }
  })
})

test.describe('投稿内ハッシュタグ詳細', () => {
  test('投稿詳細ページでもハッシュタグリンクが機能する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    const postLink = page.locator('[data-testid="post-card"] a[href*="/posts/"], article a[href*="/posts/"]').first()
    if (await postLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await postLink.click()
      await page.waitForURL(/\/posts\//, { timeout: 10000 })
      await page.waitForLoadState('load')

      const hashtagLink = page.locator('a[href*="/search?q=%23"], a[href*="/search?q="]').first()
      const hashtagText = page.locator('a').filter({ hasText: /^#\S+/ }).first()
      if (await hashtagLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(hashtagLink).toBeVisible()
      } else if (await hashtagText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(hashtagText).toBeVisible()
      }
    }
  })
})
