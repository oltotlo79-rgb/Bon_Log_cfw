import { test, expect } from '@playwright/test'
import { getPostDetailReadyLocator } from './locators'
import { clickAndWaitForUrl } from './helpers/navigation'

/**
 * アンケート（投票）機能の E2E テスト
 * 投票ボタン、結果表示、投票フローを検証する。
 */

/** 投票付き投稿がフィードに表示されているか確認するヘルパー */
async function hasPollOnFeed(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto('/feed')
  await page.waitForLoadState('load')
  // 投票ボタンまたは投票関連テキスト（「票」「投票する」）
  const pollIndicator = page.getByRole('button', { name: /投票する/i })
    .or(page.getByText(/0票|投票/i))
    .first()
  return await pollIndicator.isVisible({ timeout: 10000 }).catch(() => false)
}

test.describe('アンケート表示', () => {
  test('フィードにアンケート投稿が表示される場合は投票ボタンが存在する', async ({ page }) => {
    const hasPolls = await hasPollOnFeed(page)
    // seed が有効な投票付き投稿 (期限 +7 日) を作成し、E2E はレート制限無効化済みのため、投票は feed に必ず表示される
    expect(hasPolls).toBe(true)
    const voteButton = page.getByRole('button', { name: /投票する/i }).first()
    await expect(voteButton).toBeVisible({ timeout: 5000 })
  })

  test('アンケートのオプションが表示される', async ({ page }) => {
    const hasPolls = await hasPollOnFeed(page)
    // seed が有効な投票付き投稿 (期限 +7 日) を作成し、E2E はレート制限無効化済みのため、投票は feed に必ず表示される
    expect(hasPolls).toBe(true)
    // 投稿カード内のボタン（選択肢）が2つ以上
    const postCards = page.locator('[data-testid="post-card"]')
    const pollCard = postCards.filter({ hasText: /投票する/ }).first()
    if (await pollCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      const optionButtons = pollCard.locator('button[type="button"]')
      const count = await optionButtons.count()
      expect(count).toBeGreaterThanOrEqual(2)
    }
  })

  test('アンケートの投票数が表示される', async ({ page }) => {
    const hasPolls = await hasPollOnFeed(page)
    // seed が有効な投票付き投稿 (期限 +7 日) を作成し、E2E はレート制限無効化済みのため、投票は feed に必ず表示される
    expect(hasPolls).toBe(true)
    // 「0票」等の投票数テキスト
    const voteCount = page.getByText(/\d+票/).first()
    const hasCount = await voteCount.isVisible({ timeout: 5000 }).catch(() => false)
    // 投票数または残り時間が表示される
    const timeText = page.getByText(/残り|終了/).first()
    const hasTime = await timeText.isVisible({ timeout: 3000 }).catch(() => false)
    expect(hasCount || hasTime).toBeTruthy()
  })

  test('アンケートの選択肢をクリックできる', async ({ page }) => {
    const hasPolls = await hasPollOnFeed(page)
    // seed が有効な投票付き投稿 (期限 +7 日) を作成し、E2E はレート制限無効化済みのため、投票は feed に必ず表示される
    expect(hasPolls).toBe(true)
    const postCards = page.locator('[data-testid="post-card"]')
    const pollCard = postCards.filter({ hasText: /投票する/ }).first()
    if (await pollCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      const firstOption = pollCard.locator('button[type="button"]').first()
      if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstOption.click()
        // クリック後にUIが変化する（選択状態になる）
        await page.waitForTimeout(500)
      }
    }
  })

  test('投稿詳細ページでもアンケートが表示される', async ({ page }) => {
    const hasPolls = await hasPollOnFeed(page)
    // seed が有効な投票付き投稿 (期限 +7 日) を作成し、E2E はレート制限無効化済みのため、投票は feed に必ず表示される
    expect(hasPolls).toBe(true)
    // 投票付き投稿のコメントリンクをクリックして詳細へ
    const postCards = page.locator('[data-testid="post-card"]')
    const pollCard = postCards.filter({ hasText: /投票する/ }).first()
    const detailLink = pollCard.locator('[data-testid="comment-link"], a[href*="/posts/"]').first()
    if (await detailLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickAndWaitForUrl(page, detailLink, /\/posts\//, { timeout: 15000 })
      await page.waitForLoadState('load')
      await expect(getPostDetailReadyLocator(page)).toBeVisible({ timeout: 30000 })
      const voteBtn = page.getByRole('button', { name: /投票する/i }).first()
      const voteText = page.getByText(/票|投票/).first()
      const hasVote = await voteBtn.isVisible({ timeout: 15000 }).catch(() => false)
      const hasText = await voteText.isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasVote || hasText).toBeTruthy()
    }
  })
})
