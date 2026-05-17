import { test, expect } from '@playwright/test'

/**
 * 植物ホルモンガイドページのE2Eテスト
 * ログインユーザーで /hormones 系ページにアクセスできることを確認する
 */
test.describe('植物ホルモン機能', () => {
  test.describe('ホルモンガイドトップ', () => {
    test('ログインユーザーが/hormonesにアクセスするとホルモンガイドトップが表示される', async ({
      page,
    }) => {
      await page.goto('/hormones')
      await expect(page).toHaveURL(/\/hormones/, { timeout: 20000 })
      await expect(
        page.getByRole('heading', { name: /植物ホルモン/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('五大ホルモンセクションが表示される', async ({ page }) => {
      await page.goto('/hormones')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /五大ホルモン/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('二次ホルモンセクションが表示される', async ({ page }) => {
      await page.goto('/hormones')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /二次ホルモン/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('相互作用リンクをクリックすると相互作用ページへ遷移する', async ({
      page,
    }) => {
      await page.goto('/hormones')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /植物ホルモン/i })
      ).toBeVisible({ timeout: 10000 })
      await page.getByRole('link', { name: /ホルモン相互作用/i }).click()
      await expect(page).toHaveURL(/\/hormones\/interactions/, {
        timeout: 10000,
      })
    })

    test('コラムリンクをクリックするとコラムページへ遷移する', async ({
      page,
    }) => {
      await page.goto('/hormones')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /植物ホルモン/i })
      ).toBeVisible({ timeout: 10000 })
      await page.getByRole('link', { name: /コラム・読みもの/i }).click()
      await expect(page).toHaveURL(/\/hormones\/columns/, {
        timeout: 10000,
      })
    })
  })

  test.describe('ホルモン詳細ページ', () => {
    test('オーキシンの詳細ページが表示される', async ({ page }) => {
      await page.goto('/hormones/auxin')
      await expect(page).toHaveURL(/\/hormones\/auxin/, { timeout: 20000 })
      await expect(
        page.getByRole('heading', { name: /オーキシン/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('効果一覧が表示される', async ({ page }) => {
      await page.goto('/hormones/auxin')
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByText(/頂芽優勢/i).first()).toBeVisible({
        timeout: 10000,
      })
      await expect(page.getByText(/発根促進/i).first()).toBeVisible({
        timeout: 5000,
      })
    })

    test('月別活性チャートが表示される', async ({ page }) => {
      await page.goto('/hormones/auxin')
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByText(/月別活性/i)).toBeVisible({
        timeout: 10000,
      })
    })

    test('盆栽での役割が表示される', async ({ page }) => {
      await page.goto('/hormones/auxin')
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByText(/盆栽での役割/i)).toBeVisible({
        timeout: 10000,
      })
    })

    test('活性化方法が表示される', async ({ page }) => {
      await page.goto('/hormones/auxin')
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByText(/活性化.*方法/i)).toBeVisible({
        timeout: 10000,
      })
    })

    test('ホルモンガイドトップへの戻りリンクが存在する', async ({ page }) => {
      await page.goto('/hormones/auxin')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('link', { name: /植物ホルモン一覧/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('存在しないスラッグで404ページが表示される', async ({ page }) => {
      await page.goto('/hormones/nonexistent-hormone')
      // Next.js の notFound() はソフト404（HTTP 200）でnot-foundページを描画する。
      // body の見出しを target にする（generateMetadata の <title> も同じ regex に
      // マッチしてしまい、<head> 内の <title> は hidden 扱いで toBeVisible が失敗するため）。
      await expect(
        page.getByRole('heading', { name: /見つかりません|not found|404/i })
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('相互作用ページ', () => {
    test('/hormones/interactionsで相互作用一覧が表示される', async ({
      page,
    }) => {
      await page.goto('/hormones/interactions')
      await expect(page).toHaveURL(/\/hormones\/interactions/, {
        timeout: 20000,
      })
      await expect(
        page.getByRole('heading', { name: /相互作用/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('オーキシン/サイトカイニンの拮抗関係が表示される', async ({
      page,
    }) => {
      await page.goto('/hormones/interactions')
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByText(/オーキシン/i).first()).toBeVisible({
        timeout: 10000,
      })
      await expect(page.getByText(/サイトカイニン/i).first()).toBeVisible({
        timeout: 5000,
      })
    })
  })

  test.describe('コラムページ', () => {
    test('/hormones/columnsでコラム一覧が表示される', async ({ page }) => {
      await page.goto('/hormones/columns')
      await expect(page).toHaveURL(/\/hormones\/columns/, {
        timeout: 20000,
      })
      await expect(
        page.getByRole('heading', { name: /コラム/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('コラムタイトルをクリックすると詳細ページへ遷移する', async ({
      page,
    }) => {
      await page.goto('/hormones/columns')
      await page.waitForLoadState('domcontentloaded')
      // 最初のコラムリンクをクリック
      const firstColumn = page
        .getByRole('link', { name: /オーキシン.*サイトカイニン|休眠.*覚醒|ストレス応答/i })
        .first()
      await expect(firstColumn).toBeVisible({ timeout: 10000 })
      await firstColumn.click()
      await expect(page).toHaveURL(/\/hormones\/columns\//, {
        timeout: 10000,
      })
    })

    test('コラム詳細ページにコンテンツが表示される', async ({ page }) => {
      await page.goto('/hormones/columns/auxin-cytokinin-ratio')
      await expect(page).toHaveURL(/\/hormones\/columns\/auxin-cytokinin-ratio/, {
        timeout: 20000,
      })
      await expect(
        page.getByRole('heading', { name: /オーキシン.*サイトカイニン/i })
      ).toBeVisible({ timeout: 10000 })
      // コラム本文が表示される
      await expect(page.getByText(/摘芯/i).first()).toBeVisible({
        timeout: 5000,
      })
    })
  })

  test.describe('技法とホルモンページ', () => {
    test('/hormones/techniquesで技法ページが表示される', async ({ page }) => {
      await page.goto('/hormones/techniques')
      await expect(page).toHaveURL(/\/hormones\/techniques/, { timeout: 20000 })
      await expect(
        page.getByRole('heading', { name: /技法とホルモン/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('技法カードが表示される', async ({ page }) => {
      await page.goto('/hormones/techniques')
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByText(/摘芯/i).first()).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(/剪定/i).first()).toBeVisible({ timeout: 5000 })
    })

    test('トップページから技法ページへ遷移できる', async ({ page }) => {
      await page.goto('/hormones')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /植物ホルモン/i })
      ).toBeVisible({ timeout: 10000 })
      await page.getByRole('link', { name: /技法とホルモン/i }).click()
      await expect(page).toHaveURL(/\/hormones\/techniques/, { timeout: 10000 })
    })
  })

  test.describe('相互作用ダイアグラムページ', () => {
    test('/hormones/diagramでダイアグラムページが表示される', async ({ page }) => {
      await page.goto('/hormones/diagram')
      await expect(page).toHaveURL(/\/hormones\/diagram/, { timeout: 20000 })
      await expect(
        page.getByRole('heading', { name: /相互作用ダイアグラム/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('SVG要素が描画される', async ({ page }) => {
      await page.goto('/hormones/diagram')
      await page.waitForLoadState('domcontentloaded')
      // Lucideアイコン（aria-hidden）ではなく、コンテンツ領域内の可視SVGを対象にする
      await expect(page.locator('main svg:not([aria-hidden="true"])').first()).toBeVisible({ timeout: 10000 })
    })

    test('相互作用ページからダイアグラムへのリンクが存在する', async ({ page }) => {
      await page.goto('/hormones/interactions')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('link', { name: /ダイアグラム/i })
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('年間活性カレンダーページ', () => {
    test('/hormones/calendarでカレンダーページが表示される', async ({ page }) => {
      await page.goto('/hormones/calendar')
      await expect(page).toHaveURL(/\/hormones\/calendar/, { timeout: 20000 })
      await expect(
        page.getByRole('heading', { name: /年間ホルモン活性カレンダー/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('ホルモン名が表示される', async ({ page }) => {
      await page.goto('/hormones/calendar')
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByText(/オーキシン/i).first()).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('ホルモンバランスシミュレーターページ', () => {
    test('/hormones/simulatorでシミュレーターページが表示される', async ({ page }) => {
      await page.goto('/hormones/simulator')
      await expect(page).toHaveURL(/\/hormones\/simulator/, { timeout: 20000 })
      await expect(
        page.getByRole('heading', { name: /ホルモンバランスシミュレーター/i })
      ).toBeVisible({ timeout: 10000 })
    })

    test('月セレクターが表示される', async ({ page }) => {
      await page.goto('/hormones/simulator')
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByRole('button', { name: '1月', exact: true })).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('button', { name: '12月' })).toBeVisible({ timeout: 5000 })
    })

    test('技法セレクターが表示される', async ({ page }) => {
      await page.goto('/hormones/simulator')
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByRole('button', { name: /摘芯/i })).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('button', { name: /剪定/i })).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('ナビゲーション', () => {
    test('サイドバーに植物ホルモンリンクが表示される', async ({ page }) => {
      await page.goto('/feed')
      await page.waitForLoadState('domcontentloaded')
      // デスクトップサイドバーで確認
      const hormoneLink = page.getByRole('link', { name: /植物ホルモン/i })
      // モバイルでは非表示の場合があるのでvisibleチェックはスキップ
      const count = await hormoneLink.count()
      expect(count).toBeGreaterThanOrEqual(1)
    })

    test('トップページに4つの新ナビカードが表示される', async ({ page }) => {
      await page.goto('/hormones')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: /植物ホルモン/i })
      ).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('link', { name: /技法とホルモン/i })).toBeVisible({ timeout: 5000 })
      await expect(page.getByRole('link', { name: /相互作用ダイアグラム/i })).toBeVisible({ timeout: 5000 })
      await expect(page.getByRole('link', { name: /年間活性カレンダー/i })).toBeVisible({ timeout: 5000 })
      await expect(page.getByRole('link', { name: /バランスシミュレーター/i })).toBeVisible({ timeout: 5000 })
    })
  })
})
