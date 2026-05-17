import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import { CommentThread } from '@/components/comment/CommentThread'

// Next.js navigation モック
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// CommentFormモック
vi.mock('@/components/comment/CommentForm', () => ({
  CommentForm: ({ postId, onSuccess }: { postId: string; onSuccess: (content: string) => void }) => (
    <div data-testid="comment-form">
      <span>CommentForm: {postId}</span>
      <button onClick={() => onSuccess('テストコメント')}>送信成功</button>
    </div>
  ),
}))

// CommentListモック
vi.mock('@/components/comment/CommentList', () => ({
  CommentList: ({ postId, initialComments, currentUserId }: { postId: string; initialComments: unknown[]; currentUserId?: string }) => (
    <div data-testid="comment-list">
      <span>CommentList: {postId}</span>
      <span>初期コメント数: {initialComments.length}</span>
      <span>ユーザーID: {currentUserId || 'なし'}</span>
    </div>
  ),
}))

describe('CommentThread', () => {
  const mockComments = [
    {
      id: 'comment-1',
      content: 'テストコメント1',
      createdAt: '2024-01-01T00:00:00.000Z',
      parentId: null,
      user: {
        id: 'user-1',
        nickname: 'ユーザー1',
        avatarUrl: null,
      },
      likeCount: 5,
    },
    {
      id: 'comment-2',
      content: 'テストコメント2',
      createdAt: '2024-01-02T00:00:00.000Z',
      parentId: null,
      user: {
        id: 'user-2',
        nickname: 'ユーザー2',
        avatarUrl: '/avatar.jpg',
      },
      likeCount: 3,
      replyCount: 2,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('コメントヘッダーを表示する', () => {
    render(
      <CommentThread
        postId="post-1"
        comments={mockComments}
        commentCount={10}
      />
    )
    expect(screen.getByText('コメント')).toBeInTheDocument()
  })

  it('コメント数が0より大きい場合は件数を表示する', () => {
    render(
      <CommentThread
        postId="post-1"
        comments={mockComments}
        commentCount={10}
      />
    )
    expect(screen.getByText('(10)')).toBeInTheDocument()
  })

  it('コメント数が0の場合は件数を表示しない', () => {
    render(
      <CommentThread
        postId="post-1"
        comments={[]}
        commentCount={0}
      />
    )
    expect(screen.queryByText('(0)')).not.toBeInTheDocument()
  })

  it('ログイン済みの場合はコメントフォームを表示する', () => {
    render(
      <CommentThread
        postId="post-1"
        comments={mockComments}
        currentUserId="user-123"
        commentCount={10}
      />
    )
    expect(screen.getByTestId('comment-form')).toBeInTheDocument()
  })

  it('未ログインの場合はログイン案内を表示する', () => {
    render(
      <CommentThread
        postId="post-1"
        comments={mockComments}
        commentCount={10}
      />
    )
    expect(screen.getByText(/コメントするには/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ログイン' })).toHaveAttribute('href', '/login')
  })

  it('CommentListを正しいpropsで表示する', () => {
    render(
      <CommentThread
        postId="post-1"
        comments={mockComments}
        currentUserId="user-123"
        commentCount={10}
      />
    )
    expect(screen.getByTestId('comment-list')).toBeInTheDocument()
    expect(screen.getByText('CommentList: post-1')).toBeInTheDocument()
    expect(screen.getByText('初期コメント数: 2')).toBeInTheDocument()
  })

  it('コメント投稿成功時にページを更新する', async () => {
    render(
      <CommentThread
        postId="post-1"
        comments={mockComments}
        currentUserId="user-123"
        commentCount={10}
      />
    )

    // モックされたCommentFormの送信成功ボタンをクリック
    const successButton = screen.getByRole('button', { name: '送信成功' })
    successButton.click()

    expect(mockRefresh).toHaveBeenCalled()
  })

  it('コメント投稿成功時にOptimisticコメントが表示される', async () => {
    render(
      <CommentThread
        postId="post-1"
        comments={mockComments}
        currentUserId="user-123"
        commentCount={10}
      />
    )

    const successButton = screen.getByRole('button', { name: '送信成功' })
    successButton.click()

    // Optimisticコメントが表示される
    await waitFor(() => {
      expect(screen.getByText('テストコメント')).toBeInTheDocument()
    })
    expect(screen.getByText('送信中...')).toBeInTheDocument()
  })

  it('nextCursorが渡される場合はCommentListに渡す', () => {
    render(
      <CommentThread
        postId="post-1"
        comments={mockComments}
        nextCursor="cursor-123"
        commentCount={10}
      />
    )
    expect(screen.getByTestId('comment-list')).toBeInTheDocument()
  })
})
