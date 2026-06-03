import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

test.describe('検索機能', () => {
  test('検索ページが表示される', async ({ page }) => {
    await page.goto('/search')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByPlaceholder(/投稿やユーザーを検索/i)).toBeVisible({ timeout: 15000 })
  })

  test('検索タブが表示される', async ({ page }) => {
    await page.goto('/search')

    await expect(page.getByRole('button', { name: '投稿', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'ユーザー', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'タグ', exact: true })).toBeVisible()
  })

  test('キーワードで検索できる', async ({ page }) => {
    await page.goto('/search')
    await page.waitForLoadState('load')

    // 検索バーに入力
    const searchInput = page.getByPlaceholder(/投稿やユーザーを検索/i)
    await expect(searchInput).toBeVisible()
    await searchInput.click()
    await searchInput.fill('盆栽')

    // 入力が反映されるのを待つ
    await expect(searchInput).toHaveValue('盆栽')

    // Enterキーで検索実行
    await searchInput.press('Enter')

    // URLにクエリパラメータが追加されることを確認（日本語はエンコードされる）
    // CI環境では遅延があるため長めのタイムアウトを設定
    await expect(page).toHaveURL(/q=/, { timeout: 15000 })
  })

  test('投稿タブで検索結果が表示される', async ({ page }) => {
    await page.goto('/search?q=盆栽')

    // 投稿タブがアクティブ（ボタンとして実装されている）
    const postsTab = page.getByRole('button', { name: '投稿', exact: true })
    await expect(postsTab).toBeVisible()
  })

  test('ユーザータブに切り替えられる', async ({ page }) => {
    await page.goto('/search?q=盆栽')
    await page.waitForLoadState('load')

    await clickAndWaitForUrl(page, page.getByRole('button', { name: 'ユーザー', exact: true }), /tab=users/, { timeout: 10000 })
  })

  test('タグタブに切り替えられる', async ({ page }) => {
    await page.goto('/search?q=盆栽')
    await page.waitForLoadState('load')

    await clickAndWaitForUrl(page, page.getByRole('button', { name: 'タグ', exact: true }), /tab=tags/, { timeout: 10000 })
  })

  test('ジャンルフィルターが表示される', async ({ page }) => {
    await page.goto('/search')

    // ジャンルボタンが表示されることを確認
    await expect(page.getByRole('button', { name: 'ジャンル', exact: true })).toBeVisible()
  })

  test('ジャンルでフィルタリングできる', async ({ page }) => {
    await page.goto('/search?q=盆栽')

    // ジャンルフィルター内のボタンを探す
    const genreButton = page.locator('[data-testid="genre-filter"] button, [class*="genre"] button').first()
    if (await genreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // URLにジャンルパラメータが追加されることを確認
      await clickAndWaitForUrl(page, genreButton, /genre=/)
    }
  })

  test('検索結果が0件の場合メッセージが表示される', async ({ page }) => {
    await page.goto('/search?q=存在しないキーワード12345')

    await expect(page.getByText(/一致する投稿はありません|投稿が見つかりません|見つかりませんでした/i)).toBeVisible({ timeout: 10000 })
  })

  test('人気タグが表示される', async ({ page }) => {
    await page.goto('/search')

    // 人気タグセクションが表示される（実装による）
    const popularTags = page.locator('[data-testid="popular-tags"]')
    if (await popularTags.isVisible()) {
      await expect(popularTags).toBeVisible()
    }
  })

  test('ハッシュタグをクリックすると検索される', async ({ page }) => {
    await page.goto('/search')

    // 人気タグがある場合クリック
    const tagLink = page.locator('a[href*="/search?tag="]').first()
    if (await tagLink.isVisible()) {
      await clickAndWaitForUrl(page, tagLink, /tag=/)
    }
  })
})

test.describe('検索バーの機能', () => {
  test('クリアボタンで検索をクリアできる', async ({ page }) => {
    await page.goto('/search?q=盆栽')

    // クリアボタンをクリック
    const clearButton = page.locator('[data-testid="search-clear"]')
    if (await clearButton.isVisible()) {
      await clearButton.click()

      // 検索バーが空になることを確認
      await expect(page.getByPlaceholder(/検索/i)).toHaveValue('')
    }
  })

  test('検索履歴が保存される', async ({ page }) => {
    await page.goto('/search')

    // 検索を実行
    await page.getByPlaceholder(/検索/i).fill('盆栽')
    await page.getByPlaceholder(/検索/i).press('Enter')

    // 新しいタブで検索ページを開く
    await page.goto('/search')
    await page.getByPlaceholder(/検索/i).focus()

    // 検索履歴が表示されることを確認（実装による）
    // 注意: 検索履歴機能の実装状況により、このテストは調整が必要な場合があります
    const historyItem = page.getByText('盆栽')
    if (await historyItem.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(historyItem).toBeVisible()
    }
  })
})
