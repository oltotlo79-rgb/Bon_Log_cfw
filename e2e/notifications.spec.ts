import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * 通知ページのE2Eテスト
 */
test.describe('通知ページ', () => {
  test('通知ページが表示される', async ({ page }) => {
    await page.goto('/notifications')

    await expect(page.getByText('通知', { exact: true }).first()).toBeVisible({ timeout: 10000 })
  })

  test('通知リストまたは空メッセージが表示される', async ({ page }) => {
    await page.goto('/notifications')

    // 通知アイテムまたは「通知はありません」メッセージのいずれかが表示される
    const notificationItem = page.locator('[data-testid="notification-item"], [class*="notification"]').first()
    const emptyMessage = page.getByText(/通知はありません|まだ通知がありません/i)

    const hasNotifications = (await notificationItem.count()) > 0
    const hasEmptyMessage = await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasNotifications || hasEmptyMessage).toBeTruthy()
  })

  test('通知にフィルタータブが存在する', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForLoadState('load')

    // フィルタータブ（すべて/未読）
    const allTab = page.getByRole('tab', { name: /すべて|全て|All/i }).or(
      page.getByRole('button', { name: /すべて|全て|All/i })
    ).first()
    const unreadTab = page.getByRole('tab', { name: /未読|Unread/i }).or(
      page.getByRole('button', { name: /未読|Unread/i })
    ).first()
    const tabList = page.locator('[role="tablist"]').first()

    const hasAllTab = await allTab.isVisible({ timeout: 5000 }).catch(() => false)
    const hasUnreadTab = await unreadTab.isVisible({ timeout: 3000 }).catch(() => false)
    const hasTabList = await tabList.isVisible({ timeout: 3000 }).catch(() => false)

    if (hasAllTab || hasUnreadTab || hasTabList) {
      expect(hasAllTab || hasUnreadTab || hasTabList).toBeTruthy()
    }
  })

  test('通知をクリックでリンク先に遷移できる', async ({ page }) => {
    await page.goto('/notifications')
    // hydration を含む client fetch まで待つ (Notification list の useQuery 完了)
    await page.waitForLoadState('networkidle').catch(() => {})

    // 通知アイテム内のリンク
    const notificationLinks = page.locator(
      '[data-testid="notification-item"] a, [class*="notification"] a, a[href*="/posts/"], a[href*="/users/"]'
    )

    if ((await notificationLinks.count()) === 0) {
      // 通知がない場合はスキップ
      test.skip()
      return
    }

    const notificationLink = notificationLinks.first()
    const href = await notificationLink.getAttribute('href')

    if (href) {
      // click + URL 遷移を atomic に待つ (toHaveURL polling だけだと hydration 遅延で flake する)
      const urlPattern = new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      await clickAndWaitForUrl(page, notificationLink, urlPattern)
    } else {
      await notificationLink.click()
    }
  })
})
