import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * 農薬・病害虫ページのE2Eテスト
 * ログインユーザーで /pesticides 系ページにアクセスできることを確認する
 */
test.describe('農薬・病害虫ページ', () => {
  test('ログインユーザーが/pesticidesにアクセスすると農薬トップが表示される', async ({
    page,
  }) => {
    await page.goto('/pesticides')
    await expect(page).toHaveURL(/\/pesticides/, { timeout: 20000 })
    await expect(page.getByRole('heading', { name: /農薬・病害虫/i })).toBeVisible({ timeout: 10000 })
  })

  test('農薬トップにメニューリンクが表示される', async ({ page }) => {
    await page.goto('/pesticides')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /農薬・病害虫/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('link', { name: /病害虫.*図鑑/i })).toBeVisible({ timeout: 5000 })
  })

  test('展着剤ボタンをクリックすると type=spreader で展着剤一覧が表示される', async ({
    page,
  }) => {
    await page.goto('/pesticides')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: /農薬・病害虫/i })).toBeVisible({ timeout: 10000 })
    const spreaderBtn = page.getByRole('button', { name: '展着剤' })
    await spreaderBtn.click({ timeout: 5000 })
    await expect(page).toHaveURL(/\/pesticides\?type=spreader/, { timeout: 5000 })
    await expect(
      page.getByRole('heading', { name: /展着剤一覧/i }).or(page.getByText(/展着剤データはまだ登録されていません/))
    ).toBeVisible({ timeout: 5000 })
  })

  test('薬剤名で検索すると search クエリで結果が表示される', async ({ page }) => {
    await page.goto('/pesticides')
    await page.waitForLoadState('domcontentloaded')
    const input = page.getByPlaceholder(/薬剤名・登録番号で検索/)
    await input.fill('テスト')
    await page.getByRole('button', { name: '検索' }).click()
    await expect(page).toHaveURL(/\/pesticides\?search=/, { timeout: 5000 })
  })

  test('病害虫から探すで病害虫をクリックすると diseasePest クエリで結果が表示される', async ({
    page,
  }) => {
    await page.goto('/pesticides')
    await page.waitForLoadState('domcontentloaded')
    const diseasePestLink = page.locator('a[href^="/pesticides?diseasePest="]').first()
    const count = await diseasePestLink.count()
    if (count > 0) {
      await diseasePestLink.click()
      await expect(page).toHaveURL(/\/pesticides\?diseasePest=/, { timeout: 5000 })
      await expect(
        page.getByText(/に効く薬剤|該当する薬剤が見つかりませんでした|検索結果/)
      ).toBeVisible({ timeout: 5000 })
    }
  })

  test('クリアボタンで検索条件がリセットされトップ表示に戻る', async ({ page }) => {
    await page.goto('/pesticides?type=spreader')
    await page.waitForLoadState('domcontentloaded')
    const clearBtn = page.getByRole('button', { name: 'クリア' })
    await clearBtn.click({ timeout: 5000 })
    await expect(page).toHaveURL(/\/pesticides\/?$/, { timeout: 5000 })
  })
})

test.describe('薬剤製品詳細ページ', () => {
  test('農薬トップから製品リンクをクリックすると製品詳細ページへ遷移する', async ({
    page,
  }) => {
    await page.goto('/pesticides')
    await page.waitForLoadState('domcontentloaded')
    const productLink = page.locator('a[href^="/pesticides/products/"]').first()
    const count = await productLink.count()
    if (count > 0) {
      await productLink.click()
      await expect(page).toHaveURL(/\/pesticides\/products\/[^/]+$/, { timeout: 5000 })
      await expect(
        page.getByRole('heading', { level: 1 }).or(page.getByText(/基本情報|登録番号|剤型/)).first()
      ).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('剤型ページ', () => {
  test('/pesticides/formulations で剤型の違いが表示される', async ({ page }) => {
    await page.goto('/pesticides/formulations')
    await expect(page).toHaveURL(/\/pesticides\/formulations/, { timeout: 20000 })
    await expect(
      page.getByRole('heading', { name: /剤型の違い|剤型/i })
    ).toBeVisible({ timeout: 10000 })
  })

  test('剤型をクリックすると該当剤型の薬剤一覧URLに遷移する', async ({ page }) => {
    await page.goto('/pesticides/formulations')
    await page.waitForLoadState('networkidle')
    const formulationLink = page.locator('a[href*="?formulation="]').first()
    const count = await formulationLink.count()
    if (count > 0) {
      await formulationLink.click()
      await page.waitForURL(/\?formulation=/, { timeout: 15000 })
      await expect(
        page.getByRole('heading', { name: /薬剤一覧|剤型/i })
      ).toBeVisible({ timeout: 15000 })
    }
  })
})

test.describe('展着剤ページ', () => {
  test('/pesticides/spreaders で展着剤ページが表示される', async ({ page }) => {
    await page.goto('/pesticides/spreaders')
    await expect(page).toHaveURL(/\/pesticides\/spreaders/, { timeout: 20000 })
    await expect(page.getByRole('heading', { name: /展着剤/i })).toBeVisible({ timeout: 10000 })
  })

  test('型をクリックすると該当型の展着剤一覧が表示される', async ({ page }) => {
    await page.goto('/pesticides/spreaders')
    await page.waitForLoadState('domcontentloaded')
    const typeLink = page.locator('a[href*="/pesticides/spreaders?type="]').first()
    const count = await typeLink.count()
    if (count > 0) {
      await typeLink.click()
      await expect(page).toHaveURL(/\?type=/, { timeout: 5000 })
      await expect(
        page.getByRole('heading', { name: /展着剤/i })
      ).toBeVisible({ timeout: 5000 })
    }
  })

  test('展着剤型から製品リンクをクリックすると製品詳細ページへ直接遷移する', async ({ page }) => {
    await page.goto('/pesticides/spreaders')
    await page.waitForLoadState('domcontentloaded')
    const typeLink = page.locator('a[href*="/pesticides/spreaders?type="]').first()
    const count = await typeLink.count()
    if (count > 0) {
      await typeLink.click()
      await page.waitForLoadState('domcontentloaded')
      const productLink = page.locator('a[href^="/pesticides/products/"]').first()
      const productCount = await productLink.count()
      if (productCount > 0) {
        await productLink.click()
        await expect(page).toHaveURL(/\/pesticides\/products\/[^/]+$/, { timeout: 5000 })
        await expect(
          page.getByRole('heading', { level: 1 }).or(page.getByText(/基本情報|登録番号|剤型/)).first()
        ).toBeVisible({ timeout: 5000 })
      }
    }
  })
})

test.describe('原体一覧ページ', () => {
  test('/pesticides/ingredients で原体一覧が表示される', async ({ page }) => {
    await page.goto('/pesticides/ingredients')
    await expect(page).toHaveURL(/\/pesticides\/ingredients/, { timeout: 20000 })
    await expect(
      page.getByRole('heading', { name: /原体一覧|原体/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('原体一覧から原体詳細へ遷移できる', async ({ page }) => {
    await page.goto('/pesticides/ingredients')
    await page.waitForLoadState('domcontentloaded')
    const ingredientLink = page.locator('a[href^="/pesticides/ingredients/"]').first()
    const count = await ingredientLink.count()
    if (count > 0) {
      await ingredientLink.click()
      await expect(page).toHaveURL(/\/pesticides\/ingredients\/[^/]+$/, { timeout: 5000 })
      await expect(
        page.getByRole('heading', { level: 1 }).or(page.getByText(/原体|FRAC|IRAC/)).first()
      ).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('病害虫図鑑ページ', () => {
  test('/pesticides/diseases-pests で病害虫図鑑が表示される', async ({ page }) => {
    await page.goto('/pesticides/diseases-pests')
    await expect(page).toHaveURL(/\/pesticides\/diseases-pests/, { timeout: 20000 })
    await expect(
      page.getByRole('heading', { name: /病害虫図鑑|病害虫/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('病害虫一覧から病害虫詳細へ遷移できる', async ({ page }) => {
    await page.goto('/pesticides/diseases-pests')
    // networkidle で hydration を含む client side fetch まで完了させる。
    // load イベントだけだと Next.js の onClick handler 登録前に click が走り flake する。
    await page.waitForLoadState('networkidle').catch(() => {})
    const detailLink = page.locator('a[href^="/pesticides/diseases-pests/"]').first()
    const count = await detailLink.count()
    if (count > 0) {
      // click と URL 遷移を atomic に待つ (hydration 遅延への耐性)
      await clickAndWaitForUrl(page, detailLink, /\/pesticides\/diseases-pests\/[^/]+$/)
      await expect(
        page.getByRole('heading', { level: 1 }).or(page.getByText(/病害虫|に効く薬剤/)).first()
      ).toBeVisible({ timeout: 10000 })
    }
  })
})

test.describe('コラムページ', () => {
  test('/pesticides/columns でコラムページが表示される', async ({ page }) => {
    await page.goto('/pesticides/columns')
    await expect(page).toHaveURL(/\/pesticides\/columns/, { timeout: 20000 })
    await expect(
      page.getByRole('heading', { name: /コラム/i }).or(page.getByText(/コラム/)).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('コラム一覧からコラム詳細へ遷移できる', async ({ page }) => {
    await page.goto('/pesticides/columns')
    await page.waitForLoadState('domcontentloaded')
    const columnLink = page.locator('a[href^="/pesticides/columns/"]').first()
    const count = await columnLink.count()
    if (count > 0) {
      await columnLink.click()
      await expect(page).toHaveURL(/\/pesticides\/columns\/[^/]+$/, { timeout: 5000 })
      await expect(
        page.getByRole('heading', { level: 1 }).or(page.getByText(/コラム|農薬/)).first()
      ).toBeVisible({ timeout: 5000 })
    }
  })
})
