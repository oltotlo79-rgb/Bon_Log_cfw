import { vi } from 'vitest'
/**
 * Timeline - queryFn / getNextPageParam の実挙動テスト
 *
 * 他の Timeline.*.test.tsx はすべて `@tanstack/react-query` の `useInfiniteQuery` 自体を
 * モックしており、Timeline.tsx 内部で定義される `queryFn` (getTimeline 呼び出し + エラー変換) と
 * `getNextPageParam` は一度も実行されない。ここでは react-query を実装のまま使い、
 * `getTimeline` だけをモックして実際のページネーション挙動を検証する。
 */

import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/db', () => ({ prisma: {} }))

const mockGetTimeline = vi.fn()
vi.mock('@/lib/actions/feed', () => ({
  getTimeline: (...args: unknown[]) => mockGetTimeline(...args),
}))
vi.mock('@/lib/actions/post', () => ({ createPost: vi.fn(), deletePost: vi.fn() }))
vi.mock('@/lib/actions/like', () => ({ likePost: vi.fn(), unlikePost: vi.fn() }))
vi.mock('@/lib/actions/bookmark', () => ({ bookmarkPost: vi.fn(), unbookmarkPost: vi.fn() }))
vi.mock('@/lib/actions/report', () => ({ createReport: vi.fn() }))
vi.mock('@/components/report/ReportButton', () => ({ ReportButton: () => null }))
vi.mock('@/lib/actions/hide-post', () => ({ hidePost: vi.fn(), getHiddenPostIds: vi.fn() }))
vi.mock('@/lib/actions/poll', () => ({ votePoll: vi.fn(), getPollResults: vi.fn() }))

import { Timeline } from '@/components/feed/Timeline'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: { user: { id: 'test-user-id' } }, status: 'authenticated' }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

// 次ページ取得を即時トリガーするため常に inView = true として無限スクロールを実発火させる
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: true }),
}))

const post1 = {
  id: 'post-1',
  content: '1ページ目の投稿',
  createdAt: new Date().toISOString(),
  user: { id: 'user-1', nickname: 'ユーザー1', avatarUrl: null },
  media: [],
  genres: [],
  likeCount: 0,
  commentCount: 0,
  isLiked: false,
  isBookmarked: false,
  repostCount: 0,
  quoteCount: 0,
}

const post2 = {
  ...post1,
  id: 'post-2',
  content: '2ページ目の投稿',
}

describe('Timeline - queryFn 実挙動', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('次ページ取得が成功すると getTimeline の戻り値が反映され、追加ページが表示される', async () => {
    mockGetTimeline.mockResolvedValue({
      success: true,
      data: { posts: [post2], nextCursor: undefined },
    })

    render(
      <Timeline initialPosts={[post1]} currentUserId="test-user-id" nextCursor="cursor-1" />,
    )

    await waitFor(() => {
      expect(mockGetTimeline).toHaveBeenCalledWith('cursor-1')
    })

    await waitFor(() => {
      expect(screen.getByText('2ページ目の投稿')).toBeInTheDocument()
    })
    // 次ページが無いため「すべての投稿を表示しました」に切り替わる
    await waitFor(() => {
      expect(screen.getByText(/すべての投稿を表示しました/)).toBeInTheDocument()
    })
  })

  it('getTimeline が success:false を返すとエラーとして扱われ、ページネーションエラーUIを表示する', async () => {
    mockGetTimeline.mockResolvedValue({ success: false, error: 'サーバーエラー' })

    render(
      <Timeline initialPosts={[post1]} currentUserId="test-user-id" nextCursor="cursor-1" />,
    )

    await waitFor(() => {
      expect(mockGetTimeline).toHaveBeenCalledWith('cursor-1')
    })

    await waitFor(() => {
      expect(screen.getByText('追加の読み込みに失敗しました')).toBeInTheDocument()
    })
    // 既存の1ページ目の投稿は表示され続ける
    expect(screen.getByText('1ページ目の投稿')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '再試行' }))

    await waitFor(() => {
      expect(mockGetTimeline).toHaveBeenCalledTimes(2)
    })
  })

  it('getTimeline が結果を返さない場合、空配列にフォールバックする', async () => {
    mockGetTimeline.mockResolvedValue({ success: true, data: undefined })

    render(
      <Timeline initialPosts={[post1]} currentUserId="test-user-id" nextCursor="cursor-1" />,
    )

    await waitFor(() => {
      expect(mockGetTimeline).toHaveBeenCalledWith('cursor-1')
    })

    // フォールバックの nextCursor: undefined により次ページ無しと判定される
    await waitFor(() => {
      expect(screen.getByText(/すべての投稿を表示しました/)).toBeInTheDocument()
    })
    expect(screen.getByText('1ページ目の投稿')).toBeInTheDocument()
  })
})
