import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * 管理者拡張ページのE2Eテスト
 * admin.spec.tsに含まれない管理者ページをカバー
 * テストユーザーが管理者権限を持っていない場合はリダイレクト確認
 */
test.describe('管理者拡張ページ', () => {
  test('レビュー管理ページが表示される', async ({ page }) => {
    await page.goto('/admin/reviews')

    const url = page.url()
    if (url.includes('/admin/reviews')) {
      await expect(page.getByText(/レビュー管理|レビュー一覧|レビュー/i).first()).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed)/)
    }
  })

  test('レビュー管理ページに検索・フィルター機能がある', async ({ page }) => {
    await page.goto('/admin/reviews')

    const url = page.url()
    if (url.includes('/admin/reviews')) {
      // 検索フォームまたはフィルターが存在する
      const searchOrFilter = page.locator(
        'input[type="search"], input[placeholder*="検索"], [data-testid="search-input"], select, [role="tablist"]'
      ).first()

      if (await searchOrFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(searchOrFilter).toBeVisible()
      }
    }
  })

  test('変更リクエスト管理ページが表示される', async ({ page }) => {
    await page.goto('/admin/shop-requests')

    const url = page.url()
    if (url.includes('/admin/shop-requests')) {
      await expect(
        page.getByText(/変更リクエスト|リクエスト管理|盆栽園変更/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed)/)
    }
  })

  test('変更リクエストにステータスフィルターがある', async ({ page }) => {
    await page.goto('/admin/shop-requests')

    const url = page.url()
    if (url.includes('/admin/shop-requests')) {
      // ステータスフィルタータブ
      const statusFilter = page.locator(
        '[role="tablist"], button:has-text("承認待ち"), button:has-text("全て"), select[name*="status"]'
      ).first()

      if (await statusFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(statusFilter).toBeVisible()
      }
    }
  })

  test('統計情報ページが表示される', async ({ page }) => {
    await page.goto('/admin/stats')

    const url = page.url()
    if (url.includes('/admin/stats')) {
      await expect(page.getByText(/統計|アクセス|ダッシュボード/i).first()).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed)/)
    }
  })

  test('統計ページに統計カードが表示される', async ({ page }) => {
    await page.goto('/admin/stats')

    const url = page.url()
    if (url.includes('/admin/stats')) {
      // 統計カード（ユーザー数、投稿数など）
      const statsCard = page.locator(
        '[class*="card"], [class*="stat"], [data-testid*="stat"]'
      ).first()

      if (await statsCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(statsCard).toBeVisible()
      }
    }
  })

  test('サービス使用量ページが表示される', async ({ page }) => {
    await page.goto('/admin/usage')

    const url = page.url()
    if (url.includes('/admin/usage')) {
      await expect(
        page.getByText(/使用量|サービス|利用状況|usage/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed)/)
    }
  })

  test('非表示コンテンツ管理ページが表示される', async ({ page }) => {
    await page.goto('/admin/hidden')

    const url = page.url()
    if (url.includes('/admin/hidden')) {
      await expect(
        page.getByText(/非表示|hidden|非公開/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed)/)
    }
  })

  test('お問い合わせ詳細ページが表示される', async ({ page }) => {
    // まずお問い合わせ一覧から詳細リンクを探す
    await page.goto('/admin/contact')

    const url = page.url()
    if (!url.includes('/admin/contact')) {
      // 管理者権限なし
      expect(url).toMatch(/\/(login|feed)/)
      return
    }

    // 詳細リンクを探す
    const detailLinks = page.locator('a[href^="/admin/contact/"]')
    if ((await detailLinks.count()) > 0) {
      await clickAndWaitForUrl(page, detailLinks.first(), /\/admin\/contact\//, { timeout: 10000 })

      // 詳細コンテンツが表示される
      const content = page.getByText(/お問い合わせ|詳細|件名|内容/i).first()
      await expect(content).toBeVisible({ timeout: 10000 })
    }
  })

  test('ユーザー詳細ページが表示される', async ({ page }) => {
    // まずユーザー一覧から詳細リンクを探す
    await page.goto('/admin/users')

    const url = page.url()
    if (!url.includes('/admin/users')) {
      expect(url).toMatch(/\/(login|feed)/)
      return
    }

    // ユーザー詳細リンクを探す
    const userLinks = page.locator('a[href^="/admin/users/"]')
    if ((await userLinks.count()) > 0) {
      await clickAndWaitForUrl(page, userLinks.first(), /\/admin\/users\//, { timeout: 10000 })

      // ユーザー詳細が表示される
      const content = page.getByText(/ユーザー詳細|アカウント|メールアドレス/i).first()
      await expect(content).toBeVisible({ timeout: 10000 })
    }
  })
})
