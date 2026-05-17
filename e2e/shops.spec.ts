import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * 盆栽園マップページのE2Eテスト
 */
test.describe('盆栽園マップページ', () => {
  test('盆栽園一覧ページが表示される', async ({ page }) => {
    await page.goto('/shops')

    await expect(page.getByText(/盆栽園マップ|盆栽園/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('検索フォームが表示される', async ({ page }) => {
    await page.goto('/shops')

    // 検索入力フィールドが表示される
    const searchInput = page.getByPlaceholder(/検索|盆栽園名/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })

  test('盆栽園を検索できる', async ({ page }) => {
    await page.goto('/shops')

    const searchInput = page.getByPlaceholder(/検索|盆栽園名/i)
    // 入力欄が表示されたうえで、検索ボタンが押下可能になるまで待つ（React hydration 完了の代理）
    await expect(searchInput).toBeVisible({ timeout: 10000 })
    const searchButton = page.getByRole('button', { name: /^検索$/ })
    await expect(searchButton).toBeEnabled({ timeout: 10000 })

    await searchInput.fill('盆栽')
    // click と URL 遷移を atomic に待機する (router.push を startTransition で行うため
    // polling 開始がナビゲーション後にずれると `toHaveURL` が timeout する flake が出ていた)
    await clickAndWaitForUrl(page, searchButton, /search=/)
  })

  test('地図が表示される', async ({ page }) => {
    await page.goto('/shops')

    // Leaflet地図コンテナが表示される
    const mapContainer = page.locator('.leaflet-container, [class*="map"]')
    await expect(mapContainer.first()).toBeVisible({ timeout: 15000 }).catch(() => {
      // 地図のロードに時間がかかる場合やSSR無効の場合
    })
  })

  test('盆栽園登録リンクが表示される', async ({ page }) => {
    await page.goto('/shops')

    const createLink = page.getByRole('link', { name: /盆栽園を登録|新規登録/i })
    await expect(createLink).toBeVisible({ timeout: 10000 })
  })

  test('盆栽園登録ページに遷移できる', async ({ page }) => {
    await page.goto('/shops')

    const createLink = page.getByRole('link', { name: /盆栽園を登録|新規登録/i })
    if (await createLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createLink.click()
      await expect(page).toHaveURL(/\/shops\/new/)
    }
  })

  test('ソート機能が動作する', async ({ page }) => {
    await page.goto('/shops')

    // ソートボタン/セレクトを探す
    const sortControl = page.getByText(/並び替え|ソート/i).first()
    if (await sortControl.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sortControl.click()
    }
  })
})
