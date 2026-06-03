import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * 肥料（施肥ガイド）ページのE2Eテスト
 * ログインユーザーで /fertilizers 系ページにアクセスできることを確認する
 */
test.describe('肥料機能', () => {
  test.describe('施肥ガイドトップ', () => {
    test('ログインユーザーが/fertilizersにアクセスすると施肥ガイドトップが表示される', async ({
      page,
    }) => {
      await page.goto('/fertilizers')
      await expect(page).toHaveURL(/\/fertilizers/, { timeout: 20000 })
      await expect(
        page.getByRole('heading', { name: /施肥ガイド/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('施肥ガイドトップにナビゲーションリンクが表示される', async ({ page }) => {
      await page.goto('/fertilizers')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /施肥ガイド/i })
      ).toBeVisible({ timeout: 10000 })
      await expect(
        page.getByRole('link', { name: /栄養素辞典/i })
      ).toBeVisible({ timeout: 5000 })
      await expect(
        page.getByRole('link', { name: /肥料カテゴリ比較/i })
      ).toBeVisible({ timeout: 5000 })
      await expect(
        page.getByRole('link', { name: /樹種別施肥スケジュール/i })
      ).toBeVisible({ timeout: 5000 })
      await expect(
        page.getByRole('link', { name: /コラム/i })
      ).toBeVisible({ timeout: 5000 })
    })

    test('三大栄養素セクションが表示される', async ({ page }) => {
      await page.goto('/fertilizers')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /三大栄養素/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('栄養素一覧リンクをクリックすると栄養素ページへ遷移する', async ({ page }) => {
      await page.goto('/fertilizers')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /施肥ガイド/i })
      ).toBeVisible({ timeout: 10000 })
      await clickAndWaitForUrl(page, page.getByRole('link', { name: /栄養素辞典/i }), /\/fertilizers\/nutrients/, { timeout: 10000 })
    })

    test('肥料カテゴリ比較リンクをクリックするとカテゴリページへ遷移する', async ({
      page,
    }) => {
      await page.goto('/fertilizers')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /施肥ガイド/i })
      ).toBeVisible({ timeout: 10000 })
      await clickAndWaitForUrl(page, page.getByRole('link', { name: /肥料カテゴリ比較/i }), /\/fertilizers\/categories/, { timeout: 10000 })
    })

    test('樹種別施肥スケジュールリンクをクリックするとスケジュールページへ遷移する', async ({
      page,
    }) => {
      await page.goto('/fertilizers')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /施肥ガイド/i })
      ).toBeVisible({ timeout: 10000 })
      await clickAndWaitForUrl(page, page.getByRole('link', { name: /樹種別施肥スケジュール/i }), /\/fertilizers\/schedules/, { timeout: 10000 })
    })

    test('コラムリンクをクリックするとコラムページへ遷移する', async ({ page }) => {
      await page.goto('/fertilizers')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /施肥ガイド/i })
      ).toBeVisible({ timeout: 10000 })
      await clickAndWaitForUrl(page, page.getByRole('link', { name: /コラム/i }), /\/fertilizers\/columns/, { timeout: 10000 })
    })
  })

  test.describe('肥料カテゴリ比較ページ', () => {
    test('/fertilizers/categoriesで肥料カテゴリ比較が表示される', async ({
      page,
    }) => {
      await page.goto('/fertilizers/categories')
      await expect(page).toHaveURL(/\/fertilizers\/categories/, {
        timeout: 20000,
      })
      await expect(
        page.getByRole('heading', { name: /肥料カテゴリ比較/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('施肥ガイドトップへの戻りリンクが表示される', async ({ page }) => {
      await page.goto('/fertilizers/categories')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /肥料カテゴリ比較/i })
      ).toBeVisible({ timeout: 10000 })
      await expect(
        page.getByRole('link', { name: /施肥ガイドトップ/i })
      ).toBeVisible({ timeout: 5000 })
    })

    test('施肥ガイドトップへの戻りリンクをクリックするとトップへ遷移する', async ({
      page,
    }) => {
      await page.goto('/fertilizers/categories')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /肥料カテゴリ比較/i })
      ).toBeVisible({ timeout: 10000 })
      await clickAndWaitForUrl(page, page.getByRole('link', { name: /施肥ガイドトップ/i }), /\/fertilizers\/?$/, { timeout: 10000 })
    })
  })

  test.describe('栄養素一覧ページ', () => {
    test('/fertilizers/nutrientsで栄養素一覧が表示される', async ({ page }) => {
      await page.goto('/fertilizers/nutrients')
      await expect(page).toHaveURL(/\/fertilizers\/nutrients/, {
        timeout: 20000,
      })
      await expect(
        page.getByRole('heading', { name: /栄養素一覧/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('栄養素カテゴリ見出しが表示される', async ({ page }) => {
      await page.goto('/fertilizers/nutrients')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /栄養素一覧/i })
      ).toBeVisible({ timeout: 10000 })
      // 三大要素・二次要素・微量要素のいずれかが表示される（データがある場合）
      const categoryHeading = page
        .getByRole('heading', { name: /三大要素|二次要素|微量要素/i })
        .first()
      const count = await categoryHeading.count()
      if (count > 0) {
        await expect(categoryHeading).toBeVisible({ timeout: 5000 })
      }
    })

    test('栄養素一覧から栄養素詳細へ遷移できる', async ({ page }) => {
      await page.goto('/fertilizers/nutrients')
      await page.waitForLoadState('domcontentloaded')
      const nutrientLink = page
        .locator('a[href^="/fertilizers/nutrients/"]')
        .first()
      const count = await nutrientLink.count()
      if (count > 0) {
        await clickAndWaitForUrl(page, nutrientLink, /\/fertilizers\/nutrients\/[^/]+$/, { timeout: 10000 })
        await expect(
          page
            .getByRole('heading', { level: 1 })
            .or(page.getByText(/概要|盆栽での役割|欠乏症状/))
            .first()
        ).toBeVisible({ timeout: 10000 })
      }
    })
  })

  test.describe('栄養素詳細ページ', () => {
    test('栄養素詳細ページからコラム一覧への戻りリンクが機能する', async ({
      page,
    }) => {
      await page.goto('/fertilizers/nutrients')
      await page.waitForLoadState('domcontentloaded')
      const nutrientLink = page
        .locator('a[href^="/fertilizers/nutrients/"]')
        .first()
      const count = await nutrientLink.count()
      if (count > 0) {
        await clickAndWaitForUrl(page, nutrientLink, /\/fertilizers\/nutrients\/[^/]+$/, { timeout: 10000 })
        await clickAndWaitForUrl(page, page.getByRole('link', { name: /栄養素一覧/i }), /\/fertilizers\/nutrients\/?$/, { timeout: 10000 })
      }
    })
  })

  test.describe('コラムページ', () => {
    test('/fertilizers/columnsでコラムページが表示される', async ({ page }) => {
      await page.goto('/fertilizers/columns')
      await expect(page).toHaveURL(/\/fertilizers\/columns/, {
        timeout: 20000,
      })
      await expect(
        page
          .getByRole('heading', { name: /コラム/i })
          .or(page.getByText(/コラム/))
          .first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('コラムが存在しない場合は空状態メッセージが表示される', async ({
      page,
    }) => {
      await page.goto('/fertilizers/columns')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page
          .getByRole('heading', { name: /コラム/i })
          .or(page.getByText(/コラム/))
          .first()
      ).toBeVisible({ timeout: 10000 })
      // コラムがある場合はリンクが、ない場合は空メッセージが表示される
      const columnLink = page
        .locator('a[href^="/fertilizers/columns/"]')
        .first()
      const emptyMessage = page.getByText(
        /コラム記事はまだ公開されていません/
      )
      await expect(
        columnLink.or(emptyMessage).first()
      ).toBeVisible({ timeout: 5000 })
    })

    test('コラム一覧からコラム詳細へ遷移できる', async ({ page }) => {
      await page.goto('/fertilizers/columns')
      await page.waitForLoadState('domcontentloaded')
      const columnLink = page
        .locator('a[href^="/fertilizers/columns/"]')
        .first()
      const count = await columnLink.count()
      if (count > 0) {
        await clickAndWaitForUrl(page, columnLink, /\/fertilizers\/columns\/[^/]+$/, { timeout: 10000 })
        await expect(
          page
            .getByRole('heading', { level: 1 })
            .or(page.getByText(/コラム/))
            .first()
        ).toBeVisible({ timeout: 10000 })
      }
    })

    test('コラム詳細ページからコラム一覧への戻りリンクが機能する', async ({
      page,
    }) => {
      await page.goto('/fertilizers/columns')
      await page.waitForLoadState('domcontentloaded')
      const columnLink = page
        .locator('a[href^="/fertilizers/columns/"]')
        .first()
      const count = await columnLink.count()
      if (count > 0) {
        await clickAndWaitForUrl(page, columnLink, /\/fertilizers\/columns\/[^/]+$/, { timeout: 10000 })
        await clickAndWaitForUrl(page, page.getByRole('link', { name: /コラム一覧/i }), /\/fertilizers\/columns\/?$/, { timeout: 10000 })
      }
    })
  })

  test.describe('樹種別施肥スケジュールページ', () => {
    test('/fertilizers/schedulesで樹種別施肥スケジュールが表示される', async ({
      page,
    }) => {
      await page.goto('/fertilizers/schedules')
      await expect(page).toHaveURL(/\/fertilizers\/schedules/, {
        timeout: 20000,
      })
      await expect(
        page.getByRole('heading', { name: /樹種別施肥スケジュール/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('樹種カテゴリ見出しが表示される', async ({ page }) => {
      await page.goto('/fertilizers/schedules')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /樹種別施肥スケジュール/i })
      ).toBeVisible({ timeout: 10000 })
      // カテゴリの見出しが表示される（データがある場合）
      const categoryHeading = page
        .getByRole('heading', {
          name: /松柏類|雑木類|花物類|実物類|草物類|常緑樹/i,
        })
        .first()
      const count = await categoryHeading.count()
      if (count > 0) {
        await expect(categoryHeading).toBeVisible({ timeout: 5000 })
      }
    })

    test('樹種一覧から樹種詳細（スケジュール）へ遷移できる', async ({
      page,
    }) => {
      await page.goto('/fertilizers/schedules')
      await page.waitForLoadState('domcontentloaded')
      const speciesLink = page
        .locator('a[href^="/fertilizers/schedules/"]')
        .first()
      const count = await speciesLink.count()
      if (count > 0) {
        await clickAndWaitForUrl(page, speciesLink, /\/fertilizers\/schedules\/[^/]+$/, { timeout: 10000 })
        await expect(
          page
            .getByRole('heading', { level: 1 })
            .or(page.getByText(/施肥方針|月別施肥カレンダー/))
            .first()
        ).toBeVisible({ timeout: 10000 })
      }
    })

    test('樹種詳細ページに月別施肥カレンダーが表示される', async ({ page }) => {
      await page.goto('/fertilizers/schedules')
      await page.waitForLoadState('domcontentloaded')
      const speciesLink = page
        .locator('a[href^="/fertilizers/schedules/"]')
        .first()
      const count = await speciesLink.count()
      if (count > 0) {
        await speciesLink.scrollIntoViewIfNeeded().catch(() => {})
        // click が hydration 前/不安定で navigation を起こさないことがあるため、
        // click→URL 検証を toPass で再試行し詳細遷移まで吸収する
        await expect(async () => {
          await speciesLink.click()
          await page.waitForURL(/\/fertilizers\/schedules\/[^/]+$/, { timeout: 4000 })
        }).toPass({ timeout: 25000 })
        await expect(
          page.getByRole('heading', { name: /月別施肥カレンダー/i })
        ).toBeVisible({ timeout: 10000 })
      }
    })

    test('樹種詳細ページから樹種一覧への戻りリンクが機能する', async ({
      page,
    }) => {
      await page.goto('/fertilizers/schedules')
      // load: hydration まで待つ（domcontentloaded だと click が hydrate 前に入り flaky になる）
      await page.waitForLoadState('load')
      const speciesLink = page
        .locator('a[href^="/fertilizers/schedules/"]')
        .first()
      const count = await speciesLink.count()
      if (count > 0) {
        // 要素が安定するまで明示待機（layout shift 対策）
        await speciesLink.waitFor({ state: 'visible', timeout: 10000 })
        await clickAndWaitForUrl(page, speciesLink, /\/fertilizers\/schedules\/[^/]+$/, { timeout: 10000 })
        await clickAndWaitForUrl(page, page.getByRole('link', { name: /樹種一覧/i }), /\/fertilizers\/schedules\/?$/, { timeout: 10000 })
      }
    })
  })
})
