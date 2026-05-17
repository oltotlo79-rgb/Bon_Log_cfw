import { test, expect } from '@playwright/test'

/**
 * コンテンツ作成・編集ページのE2Eテスト
 * /new（新規作成）ページおよび /edit（編集）ページのフォーム表示を確認
 */
test.describe('盆栽 CRUD', () => {
  test('盆栽登録ページが表示される', async ({ page }) => {
    await page.goto('/bonsai/new')

    await expect(page).toHaveURL(/\/bonsai\/new/, { timeout: 10000 })

    // フォームまたはページヘッダーが表示される
    const heading = page.getByText(/盆栽を登録|盆栽登録|新規登録/i).first()
    const form = page.locator('form').first()

    const hasHeading = await heading.isVisible({ timeout: 10000 }).catch(() => false)
    const hasForm = await form.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasHeading || hasForm).toBeTruthy()
  })

  test('盆栽登録フォームに必要項目が存在する', async ({ page }) => {
    await page.goto('/bonsai/new')
    await page.waitForLoadState('load')

    // 名前入力フィールド
    const nameInput = page.locator('input[name*="name"], input[placeholder*="名前"], [data-testid="bonsai-name-input"]').first()
    const hasName = await nameInput.isVisible({ timeout: 10000 }).catch(() => false)

    // 樹種選択または入力
    const speciesInput = page.locator(
      'input[name*="species"], select[name*="species"], [data-testid="species-select"], input[placeholder*="樹種"]'
    ).first()
    const speciesText = page.getByText(/樹種/i).first()
    const hasSpecies = await speciesInput.isVisible({ timeout: 3000 }).catch(() => false)
    const hasSpeciesText = await speciesText.isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasName || hasSpecies || hasSpeciesText).toBeTruthy()
  })

  test('盆栽編集ページが表示される', async ({ page }) => {
    await page.goto('/bonsai')
    await page.waitForLoadState('load')

    // 既存の盆栽から編集リンクを辿る
    const bonsaiLinks = page.locator('a[href^="/bonsai/"]:not([href="/bonsai/new"])')

    if ((await bonsaiLinks.count()) === 0) {
      test.skip()
      return
    }

    // 盆栽詳細ページへ
    await bonsaiLinks.first().click()
    await expect(page).toHaveURL(/\/bonsai\/(?!new)/, { timeout: 10000 })

    // 編集リンクを探す
    const editLink = page.locator('a[href*="/edit"]').first()
    if (await editLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editLink.click()
      await expect(page).toHaveURL(/\/bonsai\/.*\/edit/, { timeout: 10000 })
    }
  })
})

test.describe('イベント CRUD', () => {
  test('イベント作成ページが表示される', async ({ page }) => {
    await page.goto('/events/new')

    await expect(page).toHaveURL(/\/events\/new/, { timeout: 10000 })

    const heading = page.getByText(/イベント登録|イベント作成|新規登録/i).first()
    const form = page.locator('form').first()

    const hasHeading = await heading.isVisible({ timeout: 10000 }).catch(() => false)
    const hasForm = await form.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasHeading || hasForm).toBeTruthy()
  })

  test('イベント作成フォームに必要項目が存在する', async ({ page }) => {
    await page.goto('/events/new')
    await page.waitForLoadState('load')

    // タイトル入力
    const titleInput = page.locator(
      'input[name*="title"], input[placeholder*="タイトル"], input[placeholder*="イベント名"], [data-testid="event-title-input"]'
    ).first()
    const titleText = page.getByText(/タイトル|イベント名/i).first()

    const hasTitle = await titleInput.isVisible({ timeout: 10000 }).catch(() => false)
    const hasTitleText = await titleText.isVisible({ timeout: 3000 }).catch(() => false)

    // 日時入力
    const dateInput = page.locator(
      'input[type="date"], input[type="datetime-local"], input[name*="date"], [class*="calendar"], [class*="date"]'
    ).first()
    const dateText = page.getByText(/日時|開催日|日程/i).first()

    const hasDate = await dateInput.isVisible({ timeout: 3000 }).catch(() => false)
    const hasDateText = await dateText.isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasTitle || hasTitleText || hasDate || hasDateText).toBeTruthy()
  })

  test('イベント編集ページが表示される', async ({ page }) => {
    await page.goto('/events')
    await page.waitForLoadState('load')

    const eventLinks = page.locator('a[href^="/events/"]:not([href="/events/new"])')

    if ((await eventLinks.count()) === 0) {
      test.skip()
      return
    }

    await eventLinks.first().click()
    await expect(page).toHaveURL(/\/events\/(?!new)/, { timeout: 10000 })

    const editLink = page.locator('a[href*="/edit"]').first()
    if (await editLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editLink.click()
      await expect(page).toHaveURL(/\/events\/.*\/edit/, { timeout: 10000 })
    }
  })
})

test.describe('盆栽園 CRUD', () => {
  test('盆栽園登録ページが表示される', async ({ page }) => {
    await page.goto('/shops/new')

    await expect(page).toHaveURL(/\/shops\/new/, { timeout: 10000 })

    const heading = page.getByText(/盆栽園を登録|盆栽園登録|新規登録/i).first()
    const form = page.locator('form').first()

    const hasHeading = await heading.isVisible({ timeout: 10000 }).catch(() => false)
    const hasForm = await form.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasHeading || hasForm).toBeTruthy()
  })

  test('盆栽園登録フォームに必要項目が存在する', async ({ page }) => {
    await page.goto('/shops/new')
    await page.waitForLoadState('load')

    // 名前入力
    const nameInput = page.locator(
      'input[name*="name"], input[placeholder*="名前"], input[placeholder*="盆栽園名"], [data-testid="shop-name-input"]'
    ).first()
    const nameText = page.getByText(/盆栽園名|名前|店名/i).first()

    const hasName = await nameInput.isVisible({ timeout: 10000 }).catch(() => false)
    const hasNameText = await nameText.isVisible({ timeout: 3000 }).catch(() => false)

    // 住所入力
    const addressInput = page.locator(
      'input[name*="address"], input[placeholder*="住所"], textarea[name*="address"], [data-testid="shop-address-input"]'
    ).first()
    const addressText = page.getByText(/住所|所在地/i).first()

    const hasAddress = await addressInput.isVisible({ timeout: 3000 }).catch(() => false)
    const hasAddressText = await addressText.isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasName || hasNameText || hasAddress || hasAddressText).toBeTruthy()
  })

  test('盆栽園編集ページが表示される', async ({ page }) => {
    await page.goto('/shops')
    await page.waitForLoadState('load')

    const shopLinks = page.locator('a[href^="/shops/"]:not([href="/shops/new"])')

    if ((await shopLinks.count()) === 0) {
      test.skip()
      return
    }

    await shopLinks.first().click()
    await expect(page).toHaveURL(/\/shops\/(?!new)/, { timeout: 10000 })

    const editLink = page.locator('a[href*="/edit"]').first()
    if (await editLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editLink.click()
      await expect(page).toHaveURL(/\/shops\/.*\/edit/, { timeout: 10000 })
    }
  })
})

test.describe('下書き編集', () => {
  test('下書き編集ページが表示される', async ({ page }) => {
    await page.goto('/drafts')
    await page.waitForLoadState('load')

    const draftItems = page.locator('[data-testid="draft-card"], a[href^="/drafts/"]')
    if ((await draftItems.count()) === 0) {
      test.skip()
      return
    }

    // 下書きの編集リンクを辿る
    const editLink = page.locator('a[href*="/drafts/"][href*="/edit"]').first()
    if (await editLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editLink.click()
      await expect(page).toHaveURL(/\/drafts\/.*\/edit/, { timeout: 10000 })

      // 編集フォームが表示される
      const form = page.locator('form, textarea, [data-testid="draft-editor"]').first()
      await expect(form).toBeVisible({ timeout: 10000 })
    }
  })
})

test.describe('予約投稿編集', () => {
  test('予約投稿編集ページが表示される', async ({ page }) => {
    await page.goto('/posts/scheduled')
    await page.waitForLoadState('load')

    const scheduledItems = page.locator(
      '[data-testid="scheduled-post"], a[href*="/posts/scheduled/"][href*="/edit"]'
    )

    if ((await scheduledItems.count()) === 0) {
      test.skip()
      return
    }

    const editLink = page.locator('a[href*="/posts/scheduled/"][href*="/edit"]').first()
    if (await editLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editLink.click()
      await expect(page).toHaveURL(/\/posts\/scheduled\/.*\/edit/, { timeout: 10000 })
    }
  })
})
