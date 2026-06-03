import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

test.describe('盆栽用語辞典', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dictionary')
    await page.waitForLoadState('networkidle')
  })

  test('辞典ページが表示される', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '盆栽用語辞典' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/樹形・技術・管理/)).toBeVisible()
  })

  test('用語カードが表示される', async ({ page }) => {
    // 用語が1件以上ある場合はリンクカードが表示される
    const termCards = page.locator('a[href^="/dictionary/"]')
    const count = await termCards.count()

    if (count > 0) {
      // 最初のカードにカテゴリバッジがある
      const firstCard = termCards.first()
      await expect(firstCard).toBeVisible()
    } else {
      // 0件の場合はメッセージが表示される
      await expect(page.getByText('用語が登録されていません')).toBeVisible()
    }
  })

  test('用語カードをクリックすると詳細ページに遷移する', async ({ page }) => {
    const termCards = page.locator('a[href^="/dictionary/"]')
    const count = await termCards.count()

    if (count > 0) {
      const href = await termCards.first().getAttribute('href')

      if (href) {
        await clickAndWaitForUrl(page, termCards.first(), new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 10000 })
      } else {
        await termCards.first().click()
      }
    }
  })
})
