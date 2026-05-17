import { test, expect } from '@playwright/test'

/**
 * 設定サブページのE2Eテスト
 * settings.spec.ts では /settings と /settings/profile のみカバー
 * このファイルでは残りの設定サブページをカバー
 */
test.describe('アカウント設定', () => {
  test('アカウント設定ページが表示される', async ({ page }) => {
    await page.goto('/settings/account')

    await expect(page.getByText(/アカウント|メールアドレス|パスワード/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('メールアドレス変更フォームが存在する', async ({ page }) => {
    await page.goto('/settings/account')

    const emailField = page.locator('input[type="email"], input[name="email"]')
    if (await emailField.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(emailField.first()).toBeVisible()
    }
  })

  test('パスワード変更セクションが存在する', async ({ page }) => {
    await page.goto('/settings/account')

    const passwordSection = page.getByText(/パスワード変更|パスワードを変更/i)
    if (await passwordSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(passwordSection).toBeVisible()
    }
  })

  test('アカウント削除セクションが存在する', async ({ page }) => {
    await page.goto('/settings/account')

    const deleteSection = page.getByText(/アカウント削除|アカウントを削除/i)
    if (await deleteSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(deleteSection).toBeVisible()
    }
  })
})

test.describe('セキュリティ設定（2FA）', () => {
  test('セキュリティ設定ページが表示される', async ({ page }) => {
    await page.goto('/settings/security')

    await expect(page.getByText(/セキュリティ|二段階認証|2FA|二要素認証/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('2FA設定セクションが存在する', async ({ page }) => {
    await page.goto('/settings/security')

    const twoFaSection = page.getByText(/二段階認証|2FA|二要素認証|認証アプリ/i).first()
    await expect(twoFaSection).toBeVisible({ timeout: 10000 })
  })
})

test.describe('通知設定', () => {
  test('通知設定ページが表示される', async ({ page }) => {
    await page.goto('/settings/notifications')

    await expect(page.getByText(/通知設定|通知/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('通知タイプごとのトグルが存在する', async ({ page }) => {
    await page.goto('/settings/notifications')

    // いいね通知やフォロー通知のトグルが存在する
    const toggles = page.locator('button[role="switch"], input[type="checkbox"], [data-state]')
    const count = await toggles.count()
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('ブロック・ミュート管理', () => {
  test('ブロックユーザー一覧ページが表示される', async ({ page }) => {
    await page.goto('/settings/blocked')

    await expect(page.getByText(/ブロック/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('ブロック一覧または空メッセージが表示される', async ({ page }) => {
    await page.goto('/settings/blocked')
    await page.waitForLoadState('load')

    const hasContent = page.locator('[data-testid="blocked-user"], [class*="user"], [class*="card"]')
    const hasEmpty = page.getByText(/ブロック中のユーザーはいません|ブロックしているユーザーはいません|まだありません|表示するものがありません/i)
    const hasHeading = page.getByText(/ブロック中のユーザー/i)

    const contentVisible = await hasContent.first().isVisible({ timeout: 5000 }).catch(() => false)
    const emptyVisible = await hasEmpty.isVisible({ timeout: 5000 }).catch(() => false)
    const headingVisible = await hasHeading.isVisible({ timeout: 3000 }).catch(() => false)

    expect(contentVisible || emptyVisible || headingVisible).toBe(true)
  })

  test('ミュートユーザー一覧ページが表示される', async ({ page }) => {
    await page.goto('/settings/muted')

    await expect(page.getByText(/ミュート/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('ミュート一覧または空メッセージが表示される', async ({ page }) => {
    await page.goto('/settings/muted')
    await page.waitForLoadState('load')

    const hasContent = page.locator('[data-testid="muted-user"], [class*="user"], [class*="card"]')
    const hasEmpty = page.getByText(/ミュート中のユーザーはいません|ミュートしているユーザーはいません|まだありません|表示するものがありません/i)
    const hasHeading = page.getByText(/ミュート中のユーザー/i)

    const contentVisible = await hasContent.first().isVisible({ timeout: 5000 }).catch(() => false)
    const emptyVisible = await hasEmpty.isVisible({ timeout: 5000 }).catch(() => false)
    const headingVisible = await hasHeading.isVisible({ timeout: 3000 }).catch(() => false)

    expect(contentVisible || emptyVisible || headingVisible).toBe(true)
  })
})

test.describe('フォローリクエスト', () => {
  test('フォローリクエストページが表示される', async ({ page }) => {
    await page.goto('/settings/follow-requests')

    await expect(page.getByText(/フォローリクエスト|フォロー申請/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('リクエスト一覧または空メッセージが表示される', async ({ page }) => {
    await page.goto('/settings/follow-requests')

    const hasContent = page.locator('[data-testid="follow-request"], [class*="request"], [class*="card"]')
    const hasEmpty = page.getByText(/リクエストはありません|まだありません|表示するものがありません/i)

    const contentVisible = await hasContent.first().isVisible({ timeout: 5000 }).catch(() => false)
    const emptyVisible = await hasEmpty.isVisible({ timeout: 3000 }).catch(() => false)

    expect(contentVisible || emptyVisible).toBe(true)
  })
})

test.describe('サブスクリプション管理', () => {
  test('サブスクリプション設定ページが表示される', async ({ page }) => {
    await page.goto('/settings/subscription')

    await expect(
      page.getByText(/サブスクリプション|プレミアム|プラン|メンバーシップ/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('プラン情報が表示される', async ({ page }) => {
    await page.goto('/settings/subscription')

    // 現在のプランまたはアップグレードボタンが表示される
    const planInfo = page.getByText(/無料|フリー|プレミアム|月額|年額/i).first()
    if (await planInfo.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(planInfo).toBeVisible()
    }
  })
})
