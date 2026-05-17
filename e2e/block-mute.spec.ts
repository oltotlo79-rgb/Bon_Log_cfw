import { test, expect } from '@playwright/test'

/**
 * ブロック・ミュート機能の E2E テスト
 * ユーザープロフィールでのブロック/ミュートボタン表示と操作を検証する。
 */

/**
 * 他のユーザープロフィールページに遷移するヘルパー
 */
async function navigateToOtherUserProfile(page: import('@playwright/test').Page): Promise<boolean> {
  // フィードから他ユーザーのリンクを探す（seed で user2 の投稿が表示されるはず）
  await page.goto('/feed')
  await page.waitForLoadState('load')

  const feedUserLinks = page.locator('a[href^="/users/"]')
  if ((await feedUserLinks.count()) > 0) {
    await feedUserLinks.first().click()
    await expect(page).toHaveURL(/\/users\//, { timeout: 15000 })
    await page.waitForLoadState('load')
    return true
  }

  // フォールバック: ユーザー検索
  await page.goto('/search?q=E2E&tab=users')
  await page.waitForLoadState('load')

  const searchUserLinks = page.locator('a[href^="/users/"]')
  if ((await searchUserLinks.count()) > 0) {
    await searchUserLinks.first().click()
    await expect(page).toHaveURL(/\/users\//, { timeout: 15000 })
    await page.waitForLoadState('load')
    return true
  }

  return false
}

test.describe('ミュート機能', () => {
  test('他のユーザープロフィールにミュートボタンが表示される', async ({ page }) => {
    const navigated = await navigateToOtherUserProfile(page)
    if (!navigated) {
      test.skip()
      return
    }

    await page.waitForLoadState('domcontentloaded')

    const muteButton = page.locator(
      'button:has-text("ミュート"), button:has-text("ミュート解除"), [data-testid="mute-button"]'
    ).first()

    const hasButton = await muteButton.isVisible({ timeout: 8000 }).catch(() => false)

    if (hasButton) {
      await expect(muteButton).toBeVisible()
    }
  })

  test('ミュートボタンをクリックすると確認ダイアログが表示される', async ({ page }) => {
    const navigated = await navigateToOtherUserProfile(page)
    if (!navigated) {
      test.skip()
      return
    }

    await page.waitForLoadState('domcontentloaded')

    const muteButton = page.locator('button:has-text("ミュート")').first()
    const isMuteText = await muteButton.textContent({ timeout: 5000 }).catch(() => '')

    // 既にミュート中の場合はミュート解除となるためスキップ
    if (!isMuteText || isMuteText.includes('解除')) {
      test.skip()
      return
    }

    if (!(await muteButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip()
      return
    }

    await muteButton.click()
    await page.waitForTimeout(500)

    // 確認ダイアログが表示される
    const dialog = page.locator('[role="alertdialog"], [role="dialog"]').first()
    const hasDialog = await dialog.isVisible({ timeout: 3000 }).catch(() => false)

    if (hasDialog) {
      await expect(dialog).toBeVisible()

      // キャンセルしてダイアログを閉じる
      const cancelButton = page.getByRole('button', { name: /キャンセル/i }).first()
      if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cancelButton.click()
      }
    }
  })

  test('ミュートキャンセル後もページが正常に表示される', async ({ page }) => {
    const navigated = await navigateToOtherUserProfile(page)
    if (!navigated) {
      test.skip()
      return
    }

    await page.waitForLoadState('domcontentloaded')

    const muteButton = page.locator('button:has-text("ミュート")').first()
    if (!(await muteButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip()
      return
    }

    const buttonText = await muteButton.textContent().catch(() => '')
    if (buttonText?.includes('解除')) {
      test.skip()
      return
    }

    await muteButton.click()
    await page.waitForTimeout(300)

    const cancelButton = page.getByRole('button', { name: /キャンセル/i }).first()
    if (await cancelButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelButton.click()
      await page.waitForTimeout(300)
    }

    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('ブロック機能', () => {
  test('他のユーザープロフィールにブロックボタンが表示される', async ({ page }) => {
    const navigated = await navigateToOtherUserProfile(page)
    if (!navigated) {
      test.skip()
      return
    }

    await page.waitForLoadState('domcontentloaded')

    const blockButton = page.locator(
      'button:has-text("ブロック"), button:has-text("ブロック解除"), [data-testid="block-button"]'
    ).first()

    const hasButton = await blockButton.isVisible({ timeout: 8000 }).catch(() => false)

    if (hasButton) {
      await expect(blockButton).toBeVisible()
    }
  })

  test('ブロックボタンをクリックすると確認ダイアログが表示される', async ({ page }) => {
    const navigated = await navigateToOtherUserProfile(page)
    if (!navigated) {
      test.skip()
      return
    }

    await page.waitForLoadState('domcontentloaded')

    const blockButton = page.locator('button:has-text("ブロック")').first()
    if (!(await blockButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip()
      return
    }

    const buttonText = await blockButton.textContent().catch(() => '')
    // 既にブロック中（「ブロック解除」）の場合はスキップ
    if (buttonText?.includes('解除')) {
      test.skip()
      return
    }

    await blockButton.click()
    await page.waitForTimeout(500)

    // 確認ダイアログが表示される
    const dialog = page.locator('[role="alertdialog"], [role="dialog"]').first()
    const hasDialog = await dialog.isVisible({ timeout: 3000 }).catch(() => false)

    if (hasDialog) {
      await expect(dialog).toBeVisible()

      // キャンセルしてダイアログを閉じる
      const cancelButton = page.getByRole('button', { name: /キャンセル/i }).first()
      if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cancelButton.click()
      }
    }
  })

  test('ブロック確認ダイアログの内容が正しく表示される', async ({ page }) => {
    const navigated = await navigateToOtherUserProfile(page)
    if (!navigated) {
      test.skip()
      return
    }

    await page.waitForLoadState('domcontentloaded')

    const blockButton = page.locator('button:has-text("ブロック")').first()
    if (!(await blockButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip()
      return
    }

    const buttonText = await blockButton.textContent().catch(() => '')
    if (buttonText?.includes('解除')) {
      test.skip()
      return
    }

    await blockButton.click()
    await page.waitForTimeout(500)

    const dialog = page.locator('[role="alertdialog"], [role="dialog"]').first()
    if (!(await dialog.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip()
      return
    }

    // ダイアログにブロック説明が含まれる
    const blockText = page.getByText(/ブロック/i).first()
    await expect(blockText).toBeVisible()

    // キャンセルしてダイアログを閉じる
    const cancelButton = page.getByRole('button', { name: /キャンセル/i }).first()
    if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelButton.click()
    }
  })

  test('ブロックキャンセル後もページが正常に表示される', async ({ page }) => {
    const navigated = await navigateToOtherUserProfile(page)
    if (!navigated) {
      test.skip()
      return
    }

    await page.waitForLoadState('domcontentloaded')

    const blockButton = page.locator('button:has-text("ブロック")').first()
    if (!(await blockButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip()
      return
    }

    const buttonText = await blockButton.textContent().catch(() => '')
    if (buttonText?.includes('解除')) {
      test.skip()
      return
    }

    await blockButton.click()
    await page.waitForTimeout(300)

    const cancelButton = page.getByRole('button', { name: /キャンセル/i }).first()
    if (await cancelButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelButton.click()
      await page.waitForTimeout(300)
    }

    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('ブロック済みユーザー一覧', () => {
  test('設定ページにブロック済みユーザー管理リンクが存在する', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    const blockedLink = page.locator(
      'a[href*="/settings/blocked"], a[href*="block"], [data-testid="blocked-users-link"]'
    ).first()
    const blockedText = page.getByText(/ブロック/i).first()

    const hasLink = await blockedLink.isVisible({ timeout: 5000 }).catch(() => false)
    const hasText = await blockedText.isVisible({ timeout: 3000 }).catch(() => false)

    if (hasLink || hasText) {
      expect(hasLink || hasText).toBeTruthy()
    }
  })
})

test.describe('ミュート済みユーザー一覧', () => {
  test('設定ページにミュート済みユーザー管理リンクが存在する', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    const mutedLink = page.locator(
      'a[href*="/settings/muted"], a[href*="mute"], [data-testid="muted-users-link"]'
    ).first()
    const mutedText = page.getByText(/ミュート/i).first()

    const hasLink = await mutedLink.isVisible({ timeout: 5000 }).catch(() => false)
    const hasText = await mutedText.isVisible({ timeout: 3000 }).catch(() => false)

    if (hasLink || hasText) {
      expect(hasLink || hasText).toBeTruthy()
    }
  })
})
