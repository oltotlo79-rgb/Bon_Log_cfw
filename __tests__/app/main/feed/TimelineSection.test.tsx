import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * TimelineSection (Suspense boundary content for FeedPage) のテスト。
 * FeedPage.test.tsx は Suspense をモックしてこのコンポーネントをバイパスするため、
 * ここでは実装を直接呼び出して振る舞いを検証する。
 * - getTimeline の成功結果を Timeline に渡す
 * - 失敗時 (ActionResult エラー) は空配列 + nextCursor undefined にフォールバックする
 * - currentUserId / isGuest がそのまま Timeline に伝播する
 */

const mockGetTimeline = vi.fn()
vi.mock('@/lib/actions/feed', () => ({
  getTimeline: () => mockGetTimeline(),
}))

vi.mock('@/components/feed/Timeline', () => ({
  Timeline: ({ initialPosts, currentUserId, isGuest, nextCursor }: { initialPosts: unknown[]; currentUserId?: string; isGuest?: boolean; nextCursor?: string }) => (
    <div
      data-testid="timeline"
      data-post-count={initialPosts.length}
      data-user-id={currentUserId ?? ''}
      data-is-guest={String(isGuest)}
      data-next-cursor={nextCursor ?? ''}
    />
  ),
}))

describe('TimelineSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('取得成功時: 投稿一覧と nextCursor が Timeline に渡される', async () => {
    mockGetTimeline.mockResolvedValue({
      success: true,
      data: { posts: [{ id: 'p1' }, { id: 'p2' }], nextCursor: 'cursor-2' },
    })

    const { TimelineSection } = await import('@/app/(main)/feed/TimelineSection')
    const result = await TimelineSection({ currentUserId: 'user-1', isGuest: false })
    render(result)

    const timeline = screen.getByTestId('timeline')
    expect(timeline).toHaveAttribute('data-post-count', '2')
    expect(timeline).toHaveAttribute('data-user-id', 'user-1')
    expect(timeline).toHaveAttribute('data-is-guest', 'false')
    expect(timeline).toHaveAttribute('data-next-cursor', 'cursor-2')
  })

  it('取得失敗時 (ActionResult エラー): 空配列 + nextCursor undefined にフォールバックする', async () => {
    mockGetTimeline.mockResolvedValue({ success: false, error: 'DB error' })

    const { TimelineSection } = await import('@/app/(main)/feed/TimelineSection')
    const result = await TimelineSection({ currentUserId: 'user-1' })
    render(result)

    const timeline = screen.getByTestId('timeline')
    expect(timeline).toHaveAttribute('data-post-count', '0')
    expect(timeline).toHaveAttribute('data-next-cursor', '')
  })

  it('成功だが data が未定義の場合も空配列にフォールバックする', async () => {
    mockGetTimeline.mockResolvedValue({ success: true, data: undefined })

    const { TimelineSection } = await import('@/app/(main)/feed/TimelineSection')
    const result = await TimelineSection({})
    render(result)

    expect(screen.getByTestId('timeline')).toHaveAttribute('data-post-count', '0')
  })

  it('ゲストユーザー: isGuest が Timeline にそのまま伝わる', async () => {
    mockGetTimeline.mockResolvedValue({ success: true, data: { posts: [], nextCursor: undefined } })

    const { TimelineSection } = await import('@/app/(main)/feed/TimelineSection')
    const result = await TimelineSection({ currentUserId: 'guest-1', isGuest: true })
    render(result)

    expect(screen.getByTestId('timeline')).toHaveAttribute('data-is-guest', 'true')
  })

  it('currentUserId が未指定 (未ログイン) でも描画できる', async () => {
    mockGetTimeline.mockResolvedValue({ success: true, data: { posts: [{ id: 'p1' }], nextCursor: undefined } })

    const { TimelineSection } = await import('@/app/(main)/feed/TimelineSection')
    const result = await TimelineSection({})
    render(result)

    const timeline = screen.getByTestId('timeline')
    expect(timeline).toHaveAttribute('data-user-id', '')
    expect(timeline).toHaveAttribute('data-post-count', '1')
  })
})
