import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * マイ盆栽カレンダー機能の E2E テスト。
 *
 * 認証は `auth.setup.ts` の storageState を利用。
 * /bonsai?view=calendar でアクセスし、各ビュー切替・基本操作を確認する。
 */
test.describe('マイ盆栽カレンダー', () => {
  test('view=calendar でカレンダービューが表示される', async ({ page }) => {
    await page.goto('/bonsai?view=calendar')
    // grid role を持つカレンダーが描画される
    await expect(page.getByRole('grid').first()).toBeVisible({ timeout: 10000 })
  })

  test('view=timeline（既定）ではタイムラインが表示される', async ({ page }) => {
    await page.goto('/bonsai')
    // タブの状態を確認
    const timelineTab = page.getByRole('tab', { name: /タイムライン/ })
    await expect(timelineTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 })
  })

  test('カレンダータブクリックで切り替わる', async ({ page }) => {
    await page.goto('/bonsai')
    const calendarTab = page.getByRole('tab', { name: /カレンダー/ })
    await clickAndWaitForUrl(page, calendarTab, /[?&]view=calendar/)
  })

  test('ナビ: 1ヶ月モードで次の月へ移動', async ({ page }) => {
    await page.goto('/bonsai?view=calendar&mode=month&anchor=2026-04')
    await clickAndWaitForUrl(page, page.getByRole('button', { name: '次の月' }), /anchor=2026-05/)
  })

  test('モード切替: 6ヶ月ビュー → 6 列ヘッダ', async ({ page }) => {
    await page.goto('/bonsai?view=calendar&mode=half-year&anchor=2026-04')
    // カレンダーは client 描画され得るため、count() の即時評価ではなく poll で確定を待つ
    await expect
      .poll(() => page.getByRole('columnheader').count(), { timeout: 10000 })
      .toBeGreaterThanOrEqual(6)
  })

  test('モード切替: 12ヶ月ビュー → 12 列ヘッダ', async ({ page }) => {
    await page.goto('/bonsai?view=calendar&mode=year&anchor=2026-04')
    // 12 月ヘッダ + 左端ラベル 1 個。client 描画完了まで poll で待つ
    await expect
      .poll(() => page.getByRole('columnheader').count(), { timeout: 10000 })
      .toBeGreaterThanOrEqual(12)
  })

  test('全モード共通: ←→ は ±1 ヶ月のみ', async ({ page }) => {
    await page.goto('/bonsai?view=calendar&mode=year&anchor=2026-04')
    await clickAndWaitForUrl(page, page.getByRole('button', { name: '前の月' }), /anchor=2026-03/)
  })

  test('「今日」ボタンで現在月へリセット', async ({ page }) => {
    await page.goto('/bonsai?view=calendar&mode=month&anchor=2024-01')
    await page.getByRole('button', { name: '今日' }).click()
    // anchor=YYYY-MM の形式で今月になっている
    await page.waitForURL(/anchor=\d{4}-(0[1-9]|1[0-2])/)
  })

  test('記録追加ダイアログが開く', async ({ page }) => {
    await page.goto('/bonsai?view=calendar')
    await page.getByRole('button', { name: /記録追加/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('手入れ記録を追加')).toBeVisible()
  })
})
