import type { Page } from '@playwright/test'

/**
 * フィードページの「タイムライン」見出し locator。
 * data-testid を優先し、フォールバックで見出しテキストにマッチ（CI/standalone で安定化）
 */
export function getFeedTimelineLocator(page: Page) {
  return page
    .getByTestId('feed-timeline-heading')
    .or(page.getByRole('heading', { name: /タイムライン/i }))
}

/**
 * フィードページが表示完了したとみなす locator（認証セットアップ用）。
 * タイムライン見出し・投稿ボタン・スケルトン文言のいずれかが表示されればOK。
 */
/**
 * 投稿詳細ページが描画完了したとみなす locator。
 * CI standalone環境では初回コンパイルが遅いため、十分に広いセレクタで待つ。
 */
export function getPostDetailReadyLocator(page: Page) {
  return page
    .locator('[data-testid="post-detail"], [data-testid="post-card"], [data-testid="comment-input"]')
    .or(page.locator('textarea'))
    .or(page.getByText(/コメント|いいね/i))
    .or(page.locator('article'))
    .first()
}

export function getFeedPageReadyLocator(page: Page) {
  return page
    .getByTestId('feed-timeline-heading')
    .or(page.getByRole('heading', { name: /タイムライン/i }))
    .or(page.getByTestId('compose-button'))
    .or(page.getByRole('button', { name: /新規投稿/i }))
    .or(page.getByText(/タイムライン|投稿を読み込んでいます|BON-LOG|下書き/i))
    .first()
}
