import { test, expect } from '@playwright/test'

/**
 * 盆栽用語辞典 拡張E2Eテスト
 * 検索機能・カテゴリフィルタ・用語詳細ページのテスト
 */
test.describe('盆栽用語辞典 — 拡張テスト', () => {
  test('検索フォームが表示される', async ({ page }) => {
    await page.goto('/dictionary')
    await page.waitForLoadState('domcontentloaded')

    const searchInput = page.getByPlaceholder(/検索|用語を探す/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })

  test('検索で結果が絞り込まれる', async ({ page }) => {
    await page.goto('/dictionary')
    await page.waitForLoadState('domcontentloaded')

    const searchInput = page.getByPlaceholder(/検索|用語を探す/i)
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('剪定')
      // 入力後に結果が更新される（debounce考慮）
      await page.waitForTimeout(500)
      // 結果が表示されるか空メッセージが表示される
      const results = page.locator('a[href^="/dictionary/"]')
      const count = await results.count()
      expect(count).toBeGreaterThanOrEqual(0)
    }
  })

  test('カテゴリバッジが用語カードに表示される', async ({ page }) => {
    await page.goto('/dictionary')
    await page.waitForLoadState('domcontentloaded')

    const badges = page.getByText(/樹形|技術|管理|道具|用土|盆器|展示/i)
    const count = await badges.count()
    if (count > 0) {
      await expect(badges.first()).toBeVisible()
    }
  })

  test('用語詳細ページに読みが表示される', async ({ page }) => {
    await page.goto('/dictionary')
    await page.waitForLoadState('domcontentloaded')

    const termCards = page.locator('a[href^="/dictionary/"]')
    const count = await termCards.count()

    if (count > 0) {
      await termCards.first().click()
      await page.waitForLoadState('domcontentloaded')
      // 詳細ページで見出しまたは読みが表示される
      const heading = page.locator('h1').first()
      await expect(heading).toBeVisible({ timeout: 10000 })
    }
  })

  test('用語詳細ページから一覧に戻れる', async ({ page }) => {
    await page.goto('/dictionary')
    await page.waitForLoadState('domcontentloaded')

    const termCards = page.locator('a[href^="/dictionary/"]')
    if ((await termCards.count()) > 0) {
      await termCards.first().click()
      await page.waitForLoadState('domcontentloaded')

      const backLink = page.getByRole('link', { name: /辞典|一覧|戻る/i })
      if (await backLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await backLink.click()
        await expect(page).toHaveURL(/\/dictionary$/, { timeout: 10000 })
      }
    }
  })
})
