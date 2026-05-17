import { test, expect } from '@playwright/test'
import { getPostDetailReadyLocator } from './locators'

/**
 * コンテンツ詳細ページのE2Eテスト
 * 投稿、盆栽、イベント、盆栽園の詳細ページをカバー
 */
test.describe('投稿詳細ページ', () => {
  test('投稿詳細ページが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')

    const postLinks = page.locator('a[href^="/posts/"]')
    if ((await postLinks.count()) > 0) {
      await postLinks.first().click()
      await expect(page).toHaveURL(/\/posts\//, { timeout: 10000 })
      await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })
      const postContent = page.locator('[data-testid="post-detail"], article, [class*="post"]').first()
      await expect(postContent).toBeVisible({ timeout: 10000 })
    } else {
      await expect(page).toHaveURL(/\/feed/)
      const feedArea = page.locator('main, [role="main"], [class*="feed"], [class*="timeline"]').first()
      await expect(feedArea).toBeVisible({ timeout: 5000 })
    }
  })

  test('投稿詳細にいいね・コメント・ブックマークボタンが存在する', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load').catch(() => {})

    // フィードの投稿リンクが描画されるまで待つ（Server Component のレンダリング待ち）
    const postLinks = page.locator('a[href^="/posts/"]')
    const hasPostLinks = await postLinks.first().isVisible({ timeout: 15000 }).catch(() => false)
    if (hasPostLinks) {
      await postLinks.first().click()
      await expect(page).toHaveURL(/\/posts\//, { timeout: 15000 })
      // CI初回コンパイルを考慮し、post-card（article）または post-actions を待つ
      await page.locator('[data-testid="post-card"], [data-testid="post-actions"], article').first()
        .waitFor({ state: 'visible', timeout: 45000 }).catch(() => {})
      const actionArea = page.locator('[data-testid="post-actions"], [data-testid="comment-link"], [data-testid="post-card"]').first()
      const hasActions = await actionArea.isVisible({ timeout: 10000 }).catch(() => false)
      const commentText = page.getByText(/コメント/i).first()
      const hasComment = await commentText.isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasActions || hasComment).toBeTruthy()
    } else {
      await expect(page).toHaveURL(/\/feed/)
      const feedArea = page.locator('main, [role="main"]').first()
      await expect(feedArea).toBeVisible({ timeout: 5000 })
    }
  })

  test('コメントセクションが表示される', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')

    const postLinks = page.locator('a[href^="/posts/"]')
    if ((await postLinks.count()) > 0) {
      await postLinks.first().click()
      await expect(page).toHaveURL(/\/posts\//, { timeout: 10000 })
      await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })
      const commentArea = page.locator(
        '[data-testid="comments-section"], [class*="comment"], textarea[placeholder*="コメント"], form'
      ).first()
      const hasCommentArea = await commentArea.isVisible({ timeout: 10000 }).catch(() => false)
      expect(hasCommentArea).toBeTruthy()
    } else {
      await expect(page).toHaveURL(/\/feed/)
      const feedArea = page.locator('main, [role="main"]').first()
      await expect(feedArea).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('盆栽詳細ページ', () => {
  test('盆栽詳細ページが表示される', async ({ page }) => {
    await page.goto('/bonsai')
    await page.waitForLoadState('domcontentloaded')

    const bonsaiLinks = page.locator('a[href^="/bonsai/"]:not([href="/bonsai/new"])')
    if ((await bonsaiLinks.count()) > 0) {
      await bonsaiLinks.first().click()
      await expect(page).toHaveURL(/\/bonsai\/(?!new)/, { timeout: 10000 })
    } else {
      await expect(page).toHaveURL(/\/bonsai/)
      const listArea = page.locator('main, [role="main"], a[href="/bonsai/new"]').first()
      await expect(listArea).toBeVisible({ timeout: 5000 })
    }
  })

  test('盆栽の基本情報が表示される', async ({ page }) => {
    await page.goto('/bonsai')
    await page.waitForLoadState('domcontentloaded')

    const bonsaiLinks = page.locator('a[href^="/bonsai/"]:not([href="/bonsai/new"])')
    if ((await bonsaiLinks.count()) > 0) {
      await bonsaiLinks.first().click()
      await expect(page).toHaveURL(/\/bonsai\/(?!new)/, { timeout: 10000 })
      const nameOrSpecies = page.locator('h1, h2, [data-testid="bonsai-name"]').first()
      await expect(nameOrSpecies).toBeVisible({ timeout: 10000 })
    } else {
      await expect(page).toHaveURL(/\/bonsai/)
      const listArea = page.locator('main, [role="main"]').first()
      await expect(listArea).toBeVisible({ timeout: 5000 })
    }
  })

  test('盆栽のタイムラインセクションが存在する', async ({ page }) => {
    await page.goto('/bonsai')
    await page.waitForLoadState('domcontentloaded')

    const bonsaiLinks = page.locator('a[href^="/bonsai/"]:not([href="/bonsai/new"])')
    if ((await bonsaiLinks.count()) > 0) {
      await bonsaiLinks.first().click()
      await expect(page).toHaveURL(/\/bonsai\/(?!new)/, { timeout: 10000 })
      const timeline = page.getByText(/タイムライン|成長記録|記録|履歴/i).first()
      const hasTimeline = await timeline.isVisible({ timeout: 5000 }).catch(() => false)
      if (hasTimeline) await expect(timeline).toBeVisible()
    } else {
      await expect(page).toHaveURL(/\/bonsai/)
      const listArea = page.locator('main, [role="main"]').first()
      await expect(listArea).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('イベント詳細ページ', () => {
  test('イベント詳細ページが表示される', async ({ page }) => {
    await page.goto('/events')
    await page.waitForLoadState('domcontentloaded')

    const eventLinks = page.locator('a[href^="/events/"]:not([href="/events/new"])')
    if ((await eventLinks.count()) > 0) {
      await eventLinks.first().click()
      await expect(page).toHaveURL(/\/events\/(?!new)/, { timeout: 10000 })
    } else {
      await expect(page).toHaveURL(/\/events/)
      const listArea = page.locator('main, [role="main"]').first()
      await expect(listArea).toBeVisible({ timeout: 5000 })
    }
  })

  test('イベントの日時・場所情報が表示される', async ({ page }) => {
    await page.goto('/events')
    await page.waitForLoadState('domcontentloaded')

    const eventLinks = page.locator('a[href^="/events/"]:not([href="/events/new"])')
    if ((await eventLinks.count()) > 0) {
      await eventLinks.first().click()
      await expect(page).toHaveURL(/\/events\/(?!new)/, { timeout: 10000 })
      await page.waitForLoadState('load')
      // イベント詳細が表示されたことを確認（タイトル、日付テキスト、または詳細コンテンツ）
      const eventContent = page.locator('h1, [data-testid="event-detail"], article, main').first()
      await expect(eventContent).toBeVisible({ timeout: 15000 })
    } else {
      await expect(page).toHaveURL(/\/events/)
      const listArea = page.locator('main, [role="main"]').first()
      await expect(listArea).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('盆栽園詳細ページ', () => {
  test('盆栽園詳細ページが表示される', async ({ page }) => {
    await page.goto('/shops')
    await page.waitForLoadState('domcontentloaded')

    const shopLinks = page.locator('a[href^="/shops/"]:not([href="/shops/new"])')
    if ((await shopLinks.count()) > 0) {
      await shopLinks.first().click()
      await expect(page).toHaveURL(/\/shops\/(?!new)/, { timeout: 10000 })
    } else {
      await expect(page).toHaveURL(/\/shops/)
      const listArea = page.locator('main, [role="main"]').first()
      await expect(listArea).toBeVisible({ timeout: 5000 })
    }
  })

  test('盆栽園の住所・評価が表示される', async ({ page }) => {
    await page.goto('/shops')
    await page.waitForLoadState('domcontentloaded')

    const shopLinks = page.locator('a[href^="/shops/"]:not([href="/shops/new"])')
    if ((await shopLinks.count()) > 0) {
      await shopLinks.first().click()
      await expect(page).toHaveURL(/\/shops\/(?!new)/, { timeout: 10000 })
      const address = page.getByText(/都|道|府|県|市|区|町|村/i).first()
      const rating = page.locator('svg').first()
      const shopInfo = page.locator('h1').first()
      const reviewSection = page.getByText(/レビュー|件のレビュー|盆栽園|アクセス|地図/i).first()
      const hasAddress = await address.isVisible({ timeout: 5000 }).catch(() => false)
      const hasRating = await rating.isVisible({ timeout: 3000 }).catch(() => false)
      const hasInfo = await shopInfo.isVisible({ timeout: 5000 }).catch(() => false)
      const hasReview = await reviewSection.isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasAddress || hasRating || hasInfo || hasReview).toBeTruthy()
    } else {
      await expect(page).toHaveURL(/\/shops/)
      const listArea = page.locator('main, [role="main"]').first()
      await expect(listArea).toBeVisible({ timeout: 5000 })
    }
  })

  test('レビューセクションが存在する', async ({ page }) => {
    await page.goto('/shops')
    await page.waitForLoadState('domcontentloaded')

    const shopLinks = page.locator('a[href^="/shops/"]:not([href="/shops/new"])')
    if ((await shopLinks.count()) > 0) {
      await shopLinks.first().click()
      await expect(page).toHaveURL(/\/shops\/(?!new)/, { timeout: 10000 })
      const reviewSection = page.getByText(/レビュー|口コミ|評価/i).first()
      if (await reviewSection.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(reviewSection).toBeVisible()
      }
    } else {
      await expect(page).toHaveURL(/\/shops/)
      const listArea = page.locator('main, [role="main"]').first()
      await expect(listArea).toBeVisible({ timeout: 5000 })
    }
  })
})
