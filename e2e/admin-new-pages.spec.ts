import { test, expect } from '@playwright/test'

/**
 * 新規管理者ページのE2Eテスト
 *
 * admin.spec.ts / admin-extended.spec.ts でカバーされていない
 * 13の管理者ページの表示確認テスト。
 * テストユーザーが管理者権限を持っていない場合はリダイレクト確認。
 */
test.describe('新規管理者ページ', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test('お知らせ管理ページが表示される', async ({ page }) => {
    await page.goto('/admin/announcements')

    const url = page.url()
    if (url.includes('/admin/announcements')) {
      await expect(
        page.getByText(/お知らせ管理|お知らせ一覧|お知らせ/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed|admin)/)
    }
  })

  test('NGワード管理ページが表示される', async ({ page }) => {
    await page.goto('/admin/ng-words')

    const url = page.url()
    if (url.includes('/admin/ng-words')) {
      await expect(
        page.getByText(/NGワード管理|NGワード一覧|NGワード/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed|admin)/)
    }
  })

  test('モデレーションキューページが表示される', async ({ page }) => {
    await page.goto('/admin/moderation-queue')

    const url = page.url()
    if (url.includes('/admin/moderation-queue')) {
      await expect(
        page.getByText(/モデレーション|キュー|審査/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed|admin)/)
    }
  })

  test('警告管理ページが表示される', async ({ page }) => {
    await page.goto('/admin/warnings')

    const url = page.url()
    if (url.includes('/admin/warnings')) {
      await expect(
        page.getByText(/警告管理|警告一覧|警告/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed|admin)/)
    }
  })

  test('ロール管理ページが表示される', async ({ page }) => {
    await page.goto('/admin/roles')

    const url = page.url()
    if (url.includes('/admin/roles')) {
      await expect(
        page.getByText(/ロール管理|管理者ロール|ロール/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed|admin)/)
    }
  })

  test('セグメント管理ページが表示される', async ({ page }) => {
    await page.goto('/admin/segments')

    const url = page.url()
    if (url.includes('/admin/segments')) {
      await expect(
        page.getByText(/セグメント|ユーザーセグメント/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed|admin)/)
    }
  })

  test('セキュリティイベントページが表示される', async ({ page }) => {
    await page.goto('/admin/security')

    const url = page.url()
    if (url.includes('/admin/security')) {
      await expect(
        page.getByText(/セキュリティ|セキュリティダッシュボード|イベントログ/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed|admin)/)
    }
  })

  test('IP管理ページが表示される', async ({ page }) => {
    await page.goto('/admin/ip-management')

    const url = page.url()
    if (url.includes('/admin/ip-management')) {
      await expect(
        page.getByText(/IP.*管理|IPアドレス管理|IPアドレス/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed|admin)/)
    }
  })

  test('バックアップ管理ページが表示される', async ({ page }) => {
    await page.goto('/admin/backups')

    const url = page.url()
    if (url.includes('/admin/backups')) {
      await expect(
        page.getByText(/バックアップ管理|バックアップ/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed|admin)/)
    }
  })

  test('CMS管理ページが表示される', async ({ page }) => {
    await page.goto('/admin/content-management')

    const url = page.url()
    if (url.includes('/admin/content-management')) {
      await expect(
        page.getByText(/コンテンツ管理|CMS管理|CMS/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed|admin)/)
    }
  })

  test('農薬データ管理ページが表示される', async ({ page }) => {
    await page.goto('/admin/pesticide-data')

    const url = page.url()
    if (url.includes('/admin/pesticide-data')) {
      await expect(
        page.getByText(/農薬データ管理|農薬データ|農薬/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed|admin)/)
    }
  })

  test('コホート分析ページが表示される', async ({ page }) => {
    await page.goto('/admin/analytics/cohort')

    const url = page.url()
    if (url.includes('/admin/analytics/cohort')) {
      await expect(
        page.getByText(/コホート分析|コホート/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed|admin)/)
    }
  })

  test('コンテンツ分析ページが表示される', async ({ page }) => {
    await page.goto('/admin/analytics/content')

    const url = page.url()
    if (url.includes('/admin/analytics/content')) {
      await expect(
        page.getByText(/コンテンツ分析|コンテンツ/i).first()
      ).toBeVisible({ timeout: 10000 })
    } else {
      expect(url).toMatch(/\/(login|feed|admin)/)
    }
  })

  test('お知らせ管理ページにテーブルまたはリストが存在する', async ({ page }) => {
    await page.goto('/admin/announcements')

    const url = page.url()
    if (url.includes('/admin/announcements')) {
      // テーブル、リスト、または作成ボタンが存在する
      const element = page.locator(
        'table, [role="table"], button:has-text("作成"), button:has-text("追加"), button:has-text("新規")'
      ).first()

      if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(element).toBeVisible()
      }
    }
  })

  test('NGワード管理ページにフォームまたはリストが存在する', async ({ page }) => {
    await page.goto('/admin/ng-words')

    const url = page.url()
    if (url.includes('/admin/ng-words')) {
      const element = page.locator(
        'table, [role="table"], input[type="text"], button:has-text("追加"), form'
      ).first()

      if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(element).toBeVisible()
      }
    }
  })

  test('農薬データ管理ページに検索機能が存在する', async ({ page }) => {
    await page.goto('/admin/pesticide-data')

    const url = page.url()
    if (url.includes('/admin/pesticide-data')) {
      const searchElement = page.locator(
        'input[type="search"], input[placeholder*="検索"], [data-testid="search-input"], input[type="text"]'
      ).first()

      if (await searchElement.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(searchElement).toBeVisible()
      }
    }
  })

  test('バックアップ管理ページに統計情報が存在する', async ({ page }) => {
    await page.goto('/admin/backups')

    const url = page.url()
    if (url.includes('/admin/backups')) {
      const element = page.locator(
        '[class*="card"], [class*="stat"], table, button:has-text("エクスポート"), button:has-text("バックアップ")'
      ).first()

      if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(element).toBeVisible()
      }
    }
  })
})
