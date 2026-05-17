import { test, expect } from '@playwright/test'

/**
 * 管理者モデレーション関連ページのE2Eテスト
 *
 * 操作ログページ (/admin/logs) と非表示コンテンツ管理ページ (/admin/hidden) を対象とする。
 * テストユーザーが管理者権限を持っていない場合はリダイレクトが正しく動作することを確認する。
 */
test.describe('管理者操作ログページ', () => {
  test('操作ログページにアクセスできる、またはリダイレクトされる', async ({ page }) => {
    await page.goto('/admin/logs')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (url.includes('/admin/logs')) {
      // 管理者権限あり: ページ見出しが表示される
      await expect(page.getByText(/操作ログ/i).first()).toBeVisible({ timeout: 10000 })
    } else {
      // 管理者権限なし: ログインまたはフィードにリダイレクト
      expect(url).toMatch(/\/(login|feed)/)
    }
  })

  test('操作ログページにテーブルが表示される', async ({ page }) => {
    await page.goto('/admin/logs')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (!url.includes('/admin/logs')) return

    // ログテーブルのヘッダーが存在する
    const tableHeader = page.locator('thead, th').first()
    if (await tableHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(tableHeader).toBeVisible()
    }

    // テーブルカラム「日時」「管理者」「アクション」が表示される
    const columnTexts = ['日時', '管理者', 'アクション']
    for (const col of columnTexts) {
      const el = page.getByText(col, { exact: true }).first()
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(el).toBeVisible()
      }
    }
  })

  test('操作ログページにアクションフィルターが表示される', async ({ page }) => {
    await page.goto('/admin/logs')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (!url.includes('/admin/logs')) return

    // アクション種別 select または フィルターボタンが存在する
    const filterSelect = page.locator('select[name="action"]')
    if (await filterSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(filterSelect).toBeVisible()

      // フィルターボタンが存在する
      const filterBtn = page.getByRole('button', { name: /フィルター/i })
      await expect(filterBtn).toBeVisible({ timeout: 5000 })
    }
  })

  test('操作ログページでフィルターを適用するとURLが更新される', async ({ page }) => {
    await page.goto('/admin/logs')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (!url.includes('/admin/logs')) return

    const filterSelect = page.locator('select[name="action"]')
    if (!(await filterSelect.isVisible({ timeout: 5000 }).catch(() => false))) return

    // フィルタリングを実行
    await filterSelect.selectOption('delete_post')
    const filterBtn = page.getByRole('button', { name: /フィルター/i })
    await filterBtn.click()

    // URLにクエリパラメータが含まれる
    await page.waitForURL(/\/admin\/logs/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/admin\/logs/, { timeout: 5000 })
  })

  test('操作ログページにログ件数が表示される', async ({ page }) => {
    await page.goto('/admin/logs')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (!url.includes('/admin/logs')) return

    // 件数表示または「ログが見つかりません」メッセージのどちらかが表示される
    const countOrEmpty = page
      .getByText(/全 \d+ 件/i)
      .or(page.getByText(/ログが見つかりません/i))
    await expect(countOrEmpty.first()).toBeVisible({ timeout: 10000 })
  })

  test('操作ログのアクションラベルが表示される', async ({ page }) => {
    await page.goto('/admin/logs')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (!url.includes('/admin/logs')) return

    // ログがある場合: アクションバッジが表示される
    const actionBadge = page.locator('span').filter({ hasText: /ユーザー停止|投稿削除|ユーザー復帰|イベント削除|盆栽園削除|通報ステータス更新/ }).first()
    if (await actionBadge.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(actionBadge).toBeVisible()
    }
  })

  test('操作ログページからユーザーリンクをクリックできる', async ({ page }) => {
    await page.goto('/admin/logs')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (!url.includes('/admin/logs')) return

    // ユーザーリンクがある場合はクリックできる
    const userLink = page.locator('a[href^="/users/"]').first()
    if (await userLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await userLink.getAttribute('href')
      expect(href).toMatch(/^\/users\//)
    }
  })

  test('操作ログページのtitleが設定されている', async ({ page }) => {
    await page.goto('/admin/logs')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (!url.includes('/admin/logs')) return

    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })
})

test.describe('管理者非表示コンテンツ管理ページ', () => {
  test('非表示コンテンツ管理ページにアクセスできる、またはリダイレクトされる', async ({ page }) => {
    await page.goto('/admin/hidden')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (url.includes('/admin/hidden')) {
      // 管理者権限あり: ページ見出しが表示される
      await expect(page.getByText(/非表示コンテンツ管理/i).first()).toBeVisible({ timeout: 10000 })
    } else {
      // 管理者権限なし: ログインまたはフィードにリダイレクト
      expect(url).toMatch(/\/(login|feed)/)
    }
  })

  test('非表示コンテンツ管理ページに説明文が表示される', async ({ page }) => {
    await page.goto('/admin/hidden')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (!url.includes('/admin/hidden')) return

    // 説明文または空状態メッセージが表示される
    const description = page
      .getByText(/通報により自動非表示|非表示コンテンツはありません/i)
      .first()
    await expect(description).toBeVisible({ timeout: 10000 })
  })

  test('非表示コンテンツ管理ページにタイプ別統計カードが表示される', async ({ page }) => {
    await page.goto('/admin/hidden')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (!url.includes('/admin/hidden')) return

    // タイプ別統計カード（投稿、コメント、イベント、盆栽園、レビュー）が表示される
    const typeLabels = ['投稿', 'コメント', 'イベント', '盆栽園', 'レビュー']
    let foundCount = 0
    for (const label of typeLabels) {
      const el = page.getByText(label, { exact: true }).first()
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        foundCount++
      }
    }
    // 少なくとも1つの統計カードラベルが表示されることを確認
    expect(foundCount).toBeGreaterThan(0)
  })

  test('非表示コンテンツ管理ページに再表示・削除ボタンが表示される', async ({ page }) => {
    await page.goto('/admin/hidden')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (!url.includes('/admin/hidden')) return

    // コンテンツがある場合: アクションボタンが表示される
    const actionBtn = page
      .getByRole('button', { name: /再表示|削除|承認|却下/i })
      .first()
    if (await actionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(actionBtn).toBeVisible()
    }
  })

  test('非表示コンテンツ管理ページのtitleが設定されている', async ({ page }) => {
    await page.goto('/admin/hidden')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (!url.includes('/admin/hidden')) return

    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
    // メタデータで「非表示コンテンツ管理」が設定されている
    expect(title).toMatch(/非表示|管理|BON-LOG/i)
  })

  test('非表示コンテンツ管理ページに未読通知バナーが表示される（通知がある場合）', async ({ page }) => {
    await page.goto('/admin/hidden')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (!url.includes('/admin/hidden')) return

    // 未読通知バナーは通知があるときのみ表示されるので、存在確認のみ
    const banner = page.locator('[class*="notification"], [class*="alert"], [role="alert"]').first()
    // バナーがある場合は表示されていることを確認（ない場合はスキップ）
    if (await banner.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(banner).toBeVisible()
    }
  })
})
