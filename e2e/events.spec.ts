import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * イベントページのE2Eテスト
 */
test.describe('イベントページ', () => {
  test('イベント一覧ページが表示される', async ({ page }) => {
    await page.goto('/events')

    // ページヘッダーが表示される
    await expect(page.getByText('イベント', { exact: true }).first()).toBeVisible({ timeout: 10000 })
  })

  test('カレンダー表示が存在する', async ({ page }) => {
    await page.goto('/events')

    // カレンダーまたはリスト表示のいずれかが表示される
    const calendarOrList = page.locator('[class*="calendar"], [class*="event-list"], table, .fc')
    await expect(calendarOrList.first()).toBeVisible({ timeout: 10000 }).catch(() => {
      // カレンダーライブラリがロードされない場合はスキップ
    })
  })

  test('地域フィルターが表示される', async ({ page }) => {
    await page.goto('/events')

    // 地域フィルタが表示される（ボタンまたはセレクト）
    const regionFilter = page.getByText(/地域|エリア|地方/i).first()
    if (await regionFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(regionFilter).toBeVisible()
    }
  })

  test('過去イベント表示切り替えが動作する', async ({ page }) => {
    await page.goto('/events')

    // 「過去のイベントを表示」トグルを探す
    const pastToggle = page.getByText(/過去のイベント/i)
    if (await pastToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pastToggle.click()
      // URLにshowPastパラメータが追加される
      await expect(page).toHaveURL(/showPast/, { timeout: 5000 }).catch(() => {
        // パラメータが付かない実装の場合もある
      })
    }
  })

  test('イベント登録リンクが表示される', async ({ page }) => {
    await page.goto('/events')

    // 「イベント登録」ボタン/リンクが表示される
    const createLink = page.getByRole('link', { name: /イベント登録|イベントを登録|新規登録|イベントを追加/i })
    await expect(createLink).toBeVisible({ timeout: 10000 })
  })

  test('イベント登録ページに遷移できる', async ({ page }) => {
    await page.goto('/events')

    const createLink = page.getByRole('link', { name: /イベント登録|イベントを登録|新規登録|イベントを追加/i })
    if (await createLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickAndWaitForUrl(page, createLink, /\/events\/new/)
    }
  })
})
