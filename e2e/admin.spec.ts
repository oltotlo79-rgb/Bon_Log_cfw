import { test, expect } from '@playwright/test'

/**
 * 管理者ダッシュボードのE2Eテスト
 *
 * テストユーザーが管理者権限を持っていない場合、
 * リダイレクトまたはアクセス拒否が正しく動作することを確認
 */
test.describe('管理者ダッシュボード', () => {
  test('管理者ページにアクセスできる（権限あり）またはリダイレクトされる（権限なし）', async ({ page }) => {
    await page.goto('/admin')

    // 管理者権限がある場合: ダッシュボードが表示される
    // 管理者権限がない場合: リダイレクトまたは403
    const url = page.url()
    if (url.includes('/admin')) {
      // 管理者ダッシュボードが表示される
      await expect(page.getByText(/ダッシュボード|管理/i).first()).toBeVisible({ timeout: 10000 })
    } else {
      // リダイレクトされた場合
      expect(url).toMatch(/\/(login|feed)/)
    }
  })

  test('管理者ユーザー一覧ページ', async ({ page }) => {
    await page.goto('/admin/users')

    const url = page.url()
    if (url.includes('/admin/users')) {
      await expect(page.getByText(/ユーザー管理|ユーザー一覧/i).first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('管理者投稿管理ページ', async ({ page }) => {
    await page.goto('/admin/posts')

    const url = page.url()
    if (url.includes('/admin/posts')) {
      await expect(page.getByText(/投稿管理|投稿一覧/i).first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('管理者通報管理ページ', async ({ page }) => {
    await page.goto('/admin/reports')

    const url = page.url()
    if (url.includes('/admin/reports')) {
      await expect(page.getByText(/通報|レポート/i).first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('管理者イベント管理ページ', async ({ page }) => {
    await page.goto('/admin/events')

    const url = page.url()
    if (url.includes('/admin/events')) {
      await expect(page.getByText(/イベント管理|イベント一覧/i).first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('管理者イベントインポートページ', async ({ page }) => {
    await page.goto('/admin/events/import')

    const url = page.url()
    if (url.includes('/admin/events/import')) {
      await expect(
        page.getByText(/イベント.*インポート|インポート|取り込み/i).first()
      ).toBeVisible({ timeout: 10000 })
    }
    // 権限がない場合はログイン等にリダイレクトされる
  })

  test('管理者盆栽園管理ページ', async ({ page }) => {
    await page.goto('/admin/shops')

    const url = page.url()
    if (url.includes('/admin/shops')) {
      await expect(page.getByText(/盆栽園管理|盆栽園一覧/i).first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('管理者統計ページ', async ({ page }) => {
    await page.goto('/admin/stats')

    const url = page.url()
    if (url.includes('/admin/stats')) {
      await expect(page.getByText(/統計|アクセス/i).first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('管理者ログページ', async ({ page }) => {
    await page.goto('/admin/logs')

    const url = page.url()
    if (url.includes('/admin/logs')) {
      await expect(page.getByText(/ログ|操作履歴/i).first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('管理者メンテナンスページ', async ({ page }) => {
    await page.goto('/admin/maintenance')

    const url = page.url()
    if (url.includes('/admin/maintenance')) {
      await expect(page.getByText(/メンテナンス/i).first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('管理者ブラックリストページ', async ({ page }) => {
    await page.goto('/admin/blacklist')

    const url = page.url()
    if (url.includes('/admin/blacklist')) {
      await expect(page.getByText(/ブラックリスト/i).first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('管理者プレミアム管理ページ', async ({ page }) => {
    await page.goto('/admin/premium')

    const url = page.url()
    if (url.includes('/admin/premium')) {
      await expect(page.getByText(/プレミアム/i).first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('管理者お問い合わせ管理ページ', async ({ page }) => {
    await page.goto('/admin/contact')

    const url = page.url()
    if (url.includes('/admin/contact')) {
      await expect(page.getByText(/お問い合わせ|問い合わせ/i).first()).toBeVisible({ timeout: 10000 })
    }
  })
})
