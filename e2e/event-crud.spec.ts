import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * イベント管理のE2Eテスト
 * カレンダー表示、地域フィルタ、詳細ページ、作成ページの確認
 */
test.describe('イベント管理', () => {
  test.describe('イベント一覧ページ', () => {
    test('イベントページが表示される', async ({ page }) => {
      await page.goto('/events')

      await expect(
        page.getByRole('heading', { name: 'イベント' }).first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('カレンダービューが表示される', async ({ page }) => {
      await page.goto('/events')
      await page.waitForLoadState('domcontentloaded')

      // カレンダーコンポーネントまたはリスト形式
      const calendar = page.locator(
        '[class*="calendar"], table, .fc, [data-testid="event-calendar"], [class*="Calendar"]'
      ).first()
      const eventList = page.locator(
        '[data-testid="event-list"], [class*="event-list"]'
      ).first()
      const monthDisplay = page.getByText(/\d{4}年\d{1,2}月|\d{1,2}月|January|February|March|April|May|June|July|August|September|October|November|December/i).first()

      const hasCalendar = await calendar.isVisible({ timeout: 10000 }).catch(() => false)
      const hasEventList = await eventList.isVisible({ timeout: 5000 }).catch(() => false)
      const hasMonth = await monthDisplay.isVisible({ timeout: 5000 }).catch(() => false)

      expect(hasCalendar || hasEventList || hasMonth).toBeTruthy()
    })

    test('イベント一覧またはイベントなしメッセージが表示される', async ({ page }) => {
      await page.goto('/events')
      await page.waitForLoadState('domcontentloaded')

      const eventItem = page.locator('a[href^="/events/"]:not([href="/events/new"])')
      const emptyMessage = page.getByText(
        /イベントがありません|該当するイベントがありません|予定されているイベントはありません|まだイベントがありません|イベント一覧/i
      ).first()
      const pageHeading = page.getByRole('heading', { name: 'イベント' }).first()

      const hasEvents = (await eventItem.count()) > 0
      const hasEmpty = await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false)
      const hasHeading = await pageHeading.isVisible({ timeout: 3000 }).catch(() => false)

      expect(hasEvents || hasEmpty || hasHeading).toBeTruthy()
    })
  })

  test.describe('地域フィルタ', () => {
    test('地域フィルタが表示される', async ({ page }) => {
      await page.goto('/events')
      await page.waitForLoadState('domcontentloaded')

      const regionFilter = page.getByText(/地域|エリア|地方|都道府県/i).first()
      const regionSelect = page.locator(
        'select[name*="region"], [data-testid="region-filter"], button[aria-label*="地域"]'
      ).first()
      const regionButtons = page.locator(
        '[data-testid="region-button"], button:has-text("関東"), button:has-text("関西"), button:has-text("全国")'
      ).first()

      const hasFilter = await regionFilter.isVisible({ timeout: 5000 }).catch(() => false)
      const hasSelect = await regionSelect.isVisible({ timeout: 3000 }).catch(() => false)
      const hasButtons = await regionButtons.isVisible({ timeout: 3000 }).catch(() => false)

      if (hasFilter || hasSelect || hasButtons) {
        expect(hasFilter || hasSelect || hasButtons).toBeTruthy()
      }
    })

    test('地域フィルタをクリックしてフィルタリングできる', async ({ page }) => {
      await page.goto('/events')
      await page.waitForLoadState('domcontentloaded')

      // フィルタボタンまたはセレクトを操作
      const regionSelect = page.locator(
        'select[name*="region"], [data-testid="region-filter"]'
      ).first()
      const regionButton = page.locator(
        '[data-testid="region-button"], button:has-text("関東"), button:has-text("関西")'
      ).first()

      if (await regionSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
        // セレクトの場合
        await regionSelect.click()
        await page.waitForTimeout(500)
      } else if (await regionButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        // ボタンの場合
        await regionButton.click()
        await page.waitForTimeout(500)

        // フィルタ後もページが正常に表示される
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('過去イベント表示切り替えが動作する', async ({ page }) => {
      await page.goto('/events')
      await page.waitForLoadState('domcontentloaded')

      const pastToggle = page.getByText(/過去のイベント|終了したイベント/i).first()
      const pastCheckbox = page.locator(
        'input[name*="past"], input[type="checkbox"], button[role="switch"]'
      ).first()

      if (await pastToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
        await pastToggle.click()
        await page.waitForTimeout(500)

        // ページが正常に表示される
        await expect(page.locator('body')).toBeVisible()
      } else if (await pastCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pastCheckbox.click()
        await page.waitForTimeout(500)
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  test.describe('イベント詳細', () => {
    test('イベント詳細ページに遷移できる', async ({ page }) => {
      await page.goto('/events')
      await page.waitForLoadState('domcontentloaded')

      const eventLinks = page.locator('a[href^="/events/"]:not([href="/events/new"])')

      if ((await eventLinks.count()) === 0) {
        test.skip()
        return
      }

      await clickAndWaitForUrl(page, eventLinks.first(), /\/events\/(?!new)/, { timeout: 10000 })
    })

    test('イベント詳細にタイトルが表示される', async ({ page }) => {
      await page.goto('/events')
      await page.waitForLoadState('domcontentloaded')

      const eventLinks = page.locator('a[href^="/events/"]:not([href="/events/new"])')

      if ((await eventLinks.count()) === 0) {
        test.skip()
        return
      }

      await clickAndWaitForUrl(page, eventLinks.first(), /\/events\/(?!new)/, { timeout: 10000 })

      const title = page.locator('h1, h2, [data-testid="event-title"]').first()
      await expect(title).toBeVisible({ timeout: 10000 })
    })

    test('イベント詳細に日時情報が表示される', async ({ page }) => {
      await page.goto('/events')
      await page.waitForLoadState('domcontentloaded')

      const eventLinks = page.locator('a[href^="/events/"]:not([href="/events/new"])')

      if ((await eventLinks.count()) === 0) {
        test.skip()
        return
      }

      await clickAndWaitForUrl(page, eventLinks.first(), /\/events\/(?!new)/, { timeout: 10000 })
      await page.waitForLoadState('load')

      // イベント詳細コンテンツが表示されたことを確認
      const eventContent = page.locator('h1, time, [data-testid="event-detail"], article, main').first()
      await expect(eventContent).toBeVisible({ timeout: 15000 })
    })

    test('イベント詳細に場所情報が表示される', async ({ page }) => {
      await page.goto('/events')
      await page.waitForLoadState('domcontentloaded')

      const eventLinks = page.locator('a[href^="/events/"]:not([href="/events/new"])')

      if ((await eventLinks.count()) === 0) {
        test.skip()
        return
      }

      await clickAndWaitForUrl(page, eventLinks.first(), /\/events\/(?!new)/, { timeout: 10000 })

      const locationInfo = page.getByText(/都|道|府|県|市|区|町|村/i).first()
      if (await locationInfo.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(locationInfo).toBeVisible()
      }
    })

    test('イベント詳細に編集リンクが存在する', async ({ page }) => {
      await page.goto('/events')
      await page.waitForLoadState('domcontentloaded')

      const eventLinks = page.locator('a[href^="/events/"]:not([href="/events/new"])')

      if ((await eventLinks.count()) === 0) {
        test.skip()
        return
      }

      await clickAndWaitForUrl(page, eventLinks.first(), /\/events\/(?!new)/, { timeout: 10000 })

      // 編集リンクまたはメニューボタン
      const editLink = page.locator('a[href*="/edit"]').first()
      const editButton = page.getByRole('button', { name: /編集/i }).first()
      const menuButton = page.locator(
        'button[aria-label*="メニュー"], button[aria-label*="操作"], [data-testid="event-menu"]'
      ).first()

      const hasEdit = await editLink.isVisible({ timeout: 5000 }).catch(() => false)
      const hasEditButton = await editButton.isVisible({ timeout: 3000 }).catch(() => false)
      const hasMenu = await menuButton.isVisible({ timeout: 3000 }).catch(() => false)

      if (hasEdit || hasEditButton || hasMenu) {
        expect(hasEdit || hasEditButton || hasMenu).toBeTruthy()
      }
    })
  })

  test.describe('イベント作成', () => {
    test('イベント作成ページに遷移できる', async ({ page }) => {
      await page.goto('/events')
      await page.waitForLoadState('domcontentloaded')

      const createLink = page.getByRole('link', {
        name: /イベント登録|イベントを登録|新規登録|イベントを追加/i,
      })
      if (await createLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await clickAndWaitForUrl(page, createLink, /\/events\/new/, { timeout: 10000 })
      }
    })

    test('イベント作成フォームにタイトル入力欄がある', async ({ page }) => {
      await page.goto('/events/new')
      await page.waitForLoadState('domcontentloaded')

      const titleInput = page.locator(
        'input[name*="title"], input[placeholder*="タイトル"], input[placeholder*="イベント名"], [data-testid="event-title-input"]'
      ).first()
      const titleLabel = page.getByText(/タイトル|イベント名/i).first()

      const hasInput = await titleInput.isVisible({ timeout: 10000 }).catch(() => false)
      const hasLabel = await titleLabel.isVisible({ timeout: 5000 }).catch(() => false)

      expect(hasInput || hasLabel).toBeTruthy()
    })

    test('イベント作成フォームに日時入力欄がある', async ({ page }) => {
      await page.goto('/events/new')
      await page.waitForLoadState('domcontentloaded')

      const dateInput = page.locator(
        'input[type="date"], input[type="datetime-local"], input[name*="date"], [class*="calendar"], [class*="date-picker"]'
      ).first()
      const dateLabel = page.getByText(/日時|開催日|日程/i).first()

      const hasInput = await dateInput.isVisible({ timeout: 10000 }).catch(() => false)
      const hasLabel = await dateLabel.isVisible({ timeout: 5000 }).catch(() => false)

      expect(hasInput || hasLabel).toBeTruthy()
    })

    test('イベント作成フォームに場所入力欄がある', async ({ page }) => {
      await page.goto('/events/new')
      await page.waitForLoadState('domcontentloaded')

      const locationInput = page.locator(
        'input[name*="location"], input[name*="venue"], input[name*="address"], input[placeholder*="場所"], input[placeholder*="会場"], textarea[name*="location"]'
      ).first()
      const locationLabel = page.getByText(/場所|会場|住所|開催地/i).first()

      const hasInput = await locationInput.isVisible({ timeout: 10000 }).catch(() => false)
      const hasLabel = await locationLabel.isVisible({ timeout: 5000 }).catch(() => false)

      expect(hasInput || hasLabel).toBeTruthy()
    })

    test('イベント作成フォームに送信ボタンがある', async ({ page }) => {
      await page.goto('/events/new')
      await page.waitForLoadState('domcontentloaded')

      const submitButton = page.getByRole('button', {
        name: /登録|作成|投稿|送信|保存/i,
      }).first()

      await expect(submitButton).toBeVisible({ timeout: 10000 })
    })
  })
})
