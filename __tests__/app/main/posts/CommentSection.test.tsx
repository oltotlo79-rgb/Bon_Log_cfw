import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * CommentSection (投稿詳細ページの Suspense 境界コンテンツ) のテスト。
 * - getComments / getCommentCount の並列取得結果を CommentThread に渡す
 * - ログイン中ユーザーがいる場合のみミュート済みスレッドを問い合わせる
 * - コメントが無い場合は commentThreadMute への問い合わせをスキップする
 * - CommentSectionSkeleton の描画確認
 */

const mockGetComments = vi.fn()
const mockGetCommentCount = vi.fn()
vi.mock('@/lib/actions/comment', () => ({
  getComments: (...args: unknown[]) => mockGetComments(...args),
  getCommentCount: (...args: unknown[]) => mockGetCommentCount(...args),
}))

const mockFindMany = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    commentThreadMute: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  },
}))

vi.mock('@/components/comment', () => ({
  CommentThread: ({ postId, comments, nextCursor, currentUserId, commentCount, mutedThreadIds }: {
    postId: string
    comments: Array<{ id: string }>
    nextCursor?: string
    currentUserId?: string
    commentCount: number
    mutedThreadIds: string[]
  }) => (
    <div
      data-testid="comment-thread"
      data-post-id={postId}
      data-comment-count={commentCount}
      data-current-user={currentUserId ?? ''}
      data-next-cursor={nextCursor ?? ''}
      data-muted-ids={JSON.stringify(mutedThreadIds)}
      data-rendered-count={comments.length}
    />
  ),
}))

describe('CommentSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindMany.mockResolvedValue([])
  })

  it('取得したコメント・件数を CommentThread に渡す', async () => {
    mockGetComments.mockResolvedValue({ comments: [{ id: 'c1' }, { id: 'c2' }], nextCursor: 'cursor-x' })
    mockGetCommentCount.mockResolvedValue({ count: 5 })

    const { CommentSection } = await import('@/app/(main)/posts/[id]/CommentSection')
    const result = await CommentSection({ postId: 'post-1', currentUserId: 'user-1' })
    render(result)

    const thread = screen.getByTestId('comment-thread')
    expect(thread).toHaveAttribute('data-post-id', 'post-1')
    expect(thread).toHaveAttribute('data-comment-count', '5')
    expect(thread).toHaveAttribute('data-rendered-count', '2')
    expect(thread).toHaveAttribute('data-next-cursor', 'cursor-x')
    expect(mockGetComments).toHaveBeenCalledWith('post-1')
    expect(mockGetCommentCount).toHaveBeenCalledWith('post-1')
  })

  it('ログイン中ユーザーがいてコメントがある場合、ミュート済みスレッドを問い合わせる', async () => {
    mockGetComments.mockResolvedValue({ comments: [{ id: 'c1' }, { id: 'c2' }], nextCursor: undefined })
    mockGetCommentCount.mockResolvedValue({ count: 2 })
    mockFindMany.mockResolvedValue([{ commentId: 'c1' }])

    const { CommentSection } = await import('@/app/(main)/posts/[id]/CommentSection')
    const result = await CommentSection({ postId: 'post-1', currentUserId: 'user-1' })
    render(result)

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', commentId: { in: ['c1', 'c2'] } },
      select: { commentId: true },
    })
    expect(screen.getByTestId('comment-thread')).toHaveAttribute('data-muted-ids', JSON.stringify(['c1']))
  })

  it('未ログインの場合、コメントがあってもミュート済みスレッドの問い合わせをスキップする', async () => {
    mockGetComments.mockResolvedValue({ comments: [{ id: 'c1' }], nextCursor: undefined })
    mockGetCommentCount.mockResolvedValue({ count: 1 })

    const { CommentSection } = await import('@/app/(main)/posts/[id]/CommentSection')
    const result = await CommentSection({ postId: 'post-1' })
    render(result)

    expect(mockFindMany).not.toHaveBeenCalled()
    expect(screen.getByTestId('comment-thread')).toHaveAttribute('data-muted-ids', '[]')
  })

  it('コメントが0件の場合、ログイン中でもミュート済みスレッドの問い合わせをスキップする', async () => {
    mockGetComments.mockResolvedValue({ comments: [], nextCursor: undefined })
    mockGetCommentCount.mockResolvedValue({ count: 0 })

    const { CommentSection } = await import('@/app/(main)/posts/[id]/CommentSection')
    const result = await CommentSection({ postId: 'post-1', currentUserId: 'user-1' })
    render(result)

    expect(mockFindMany).not.toHaveBeenCalled()
    expect(screen.getByTestId('comment-thread')).toHaveAttribute('data-rendered-count', '0')
  })

  it('comments が undefined の場合も空配列にフォールバックする', async () => {
    mockGetComments.mockResolvedValue({ comments: undefined, nextCursor: undefined })
    mockGetCommentCount.mockResolvedValue({ count: 0 })

    const { CommentSection } = await import('@/app/(main)/posts/[id]/CommentSection')
    const result = await CommentSection({ postId: 'post-1', currentUserId: 'user-1' })
    render(result)

    expect(screen.getByTestId('comment-thread')).toHaveAttribute('data-rendered-count', '0')
  })
})

describe('CommentSectionSkeleton', () => {
  it('3件分のプレースホルダーを描画する', async () => {
    const { CommentSectionSkeleton } = await import('@/app/(main)/posts/[id]/CommentSection')
    const { container } = render(<CommentSectionSkeleton />)

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.rounded-full').length).toBe(3)
  })
})
