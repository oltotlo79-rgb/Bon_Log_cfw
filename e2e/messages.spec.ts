import { test, expect } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * メッセージページのE2Eテスト
 */
test.describe('メッセージページ', () => {
  test('メッセージ一覧ページが表示される', async ({ page }) => {
    await page.goto('/messages')

    await expect(page.getByText(/メッセージ|ダイレクトメッセージ/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('会話リストまたは空メッセージが表示される', async ({ page }) => {
    await page.goto('/messages')

    // 会話アイテムまたは空メッセージのいずれか
    const conversationItem = page.locator('[data-testid="conversation-item"], a[href*="/messages/"]').first()
    const emptyMessage = page.getByText(/メッセージはありません|まだメッセージがありません|会話がありません/i)

    const hasConversations = (await conversationItem.count()) > 0
    const hasEmptyMessage = await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasConversations || hasEmptyMessage).toBeTruthy()
  })

  test('会話詳細ページに遷移できる', async ({ page }) => {
    await page.goto('/messages')
    await page.waitForLoadState('load')

    const conversationLinks = page.locator('a[href*="/messages/"]')
    if ((await conversationLinks.count()) === 0) {
      // 会話がない場合はスキップ
      test.skip()
      return
    }

    await clickAndWaitForUrl(page, conversationLinks.first(), /\/messages\//, { timeout: 10000 })
  })

  test('会話詳細にメッセージ入力フォームが表示される', async ({ page }) => {
    await page.goto('/messages')
    await page.waitForLoadState('load')

    const conversationLinks = page.locator('a[href*="/messages/"]')
    if ((await conversationLinks.count()) === 0) {
      test.skip()
      return
    }

    await clickAndWaitForUrl(page, conversationLinks.first(), /\/messages\//, { timeout: 15000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})

    // メッセージ入力フォーム（placeholder="メッセージを入力..."）
    const messageInput = page.locator('textarea[placeholder*="メッセージ"], textarea').first()
    const sendButton = page.getByRole('button', { name: /送信|Send/i }).first()

    const hasInput = await messageInput.isVisible({ timeout: 30000 }).catch(() => false)
    const hasSend = await sendButton.isVisible({ timeout: 10000 }).catch(() => false)

    expect(hasInput || hasSend).toBeTruthy()
  })

  test('会話詳細に戻るリンクが表示される', async ({ page }) => {
    await page.goto('/messages')
    await page.waitForLoadState('load')

    const conversationLinks = page.locator('a[href*="/messages/"]')
    if ((await conversationLinks.count()) === 0) {
      test.skip()
      return
    }

    await clickAndWaitForUrl(page, conversationLinks.first(), /\/messages\//, { timeout: 10000 })

    // 戻るリンク/ボタン
    const backLink = page.locator(
      'a[href="/messages"], button[aria-label*="戻る"], [data-testid="back-button"]'
    ).first()
    const backText = page.getByText(/戻る|一覧/i).first()

    const hasBack = await backLink.isVisible({ timeout: 5000 }).catch(() => false)
    const hasBackText = await backText.isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasBack || hasBackText).toBeTruthy()
  })
})
