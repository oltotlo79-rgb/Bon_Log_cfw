import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { CommentList } from '@/components/comment/CommentList'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

// Server Actions モック
const mockGetComments = vi.fn()
vi.mock('@/lib/actions/comment', () => ({
  getComments: (...args: unknown[]) => mockGetComments(...args),
  deleteComment: vi.fn(),
  getReplies: vi.fn().mockResolvedValue({ replies: [] }),
}))

// いいねアクションモック
vi.mock('@/lib/actions/like', () => ({
  toggleCommentLike: vi.fn().mockResolvedValue({ success: true, data: { liked: true } }),
}))

const mockComments = [
  {
    id: 'comment-1',
    content: '最初のコメント',
    createdAt: new Date().toISOString(),
    parentId: null,
    user: {
      id: 'user-1',
      nickname: 'ユーザー1',
      avatarUrl: null,
    },
    likeCount: 5,
    replyCount: 0,
  },
  {
    id: 'comment-2',
    content: '2番目のコメント',
    createdAt: new Date().toISOString(),
    parentId: null,
    user: {
      id: 'user-2',
      nickname: 'ユーザー2',
      avatarUrl: null,
    },
    likeCount: 3,
    replyCount: 0,
  },
]

describe('CommentList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('コメント一覧を表示する', () => {
    render(
      <CommentList
        postId="post-1"
        initialComments={mockComments}
        currentUserId="test-user-id"
      />
    )
    expect(screen.getByText('最初のコメント')).toBeInTheDocument()
    expect(screen.getByText('2番目のコメント')).toBeInTheDocument()
  })

  it('コメントがない場合メッセージを表示する', () => {
    render(
      <CommentList
        postId="post-1"
        initialComments={[]}
        currentUserId="test-user-id"
      />
    )
    // テキストはbr要素で分割されているので、部分一致で検索
    expect(screen.getByText(/まだコメントはありません/)).toBeInTheDocument()
    expect(screen.getByText(/最初のコメントを投稿しましょう/)).toBeInTheDocument()
  })

  it('nextCursorがある場合「さらに読み込む」ボタンを表示する', () => {
    render(
      <CommentList
        postId="post-1"
        initialComments={mockComments}
        initialNextCursor="cursor-123"
        currentUserId="test-user-id"
      />
    )
    expect(screen.getByRole('button', { name: 'さらに読み込む' })).toBeInTheDocument()
  })

  it('nextCursorがない場合「さらに読み込む」ボタンを表示しない', () => {
    render(
      <CommentList
        postId="post-1"
        initialComments={mockComments}
        currentUserId="test-user-id"
      />
    )
    expect(screen.queryByRole('button', { name: 'さらに読み込む' })).not.toBeInTheDocument()
  })

  it('「さらに読み込む」クリックで追加コメントを取得する', async () => {
    const additionalComments = [
      {
        id: 'comment-3',
        content: '3番目のコメント',
        createdAt: new Date().toISOString(),
        parentId: null,
        user: {
          id: 'user-3',
          nickname: 'ユーザー3',
          avatarUrl: null,
        },
        likeCount: 1,
        replyCount: 0,
      },
    ]

    mockGetComments.mockResolvedValue({
      comments: additionalComments,
      nextCursor: undefined,
    })

    const user = userEvent.setup()
    render(
      <CommentList
        postId="post-1"
        initialComments={mockComments}
        initialNextCursor="cursor-123"
        currentUserId="test-user-id"
      />
    )

    await user.click(screen.getByRole('button', { name: 'さらに読み込む' }))

    await waitFor(() => {
      expect(mockGetComments).toHaveBeenCalledWith('post-1', 'cursor-123')
    })

    await waitFor(() => {
      expect(screen.getByText('3番目のコメント')).toBeInTheDocument()
    })
  })

  it('読み込み中はボタンが無効化される', async () => {
    mockGetComments.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ comments: [], nextCursor: undefined }), 100))
    )

    const user = userEvent.setup()
    render(
      <CommentList
        postId="post-1"
        initialComments={mockComments}
        initialNextCursor="cursor-123"
        currentUserId="test-user-id"
      />
    )

    await user.click(screen.getByRole('button', { name: 'さらに読み込む' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '読み込み中...' })).toBeDisabled()
    })
  })

  it('propsが更新されるとコメントが更新される', () => {
    const { rerender } = render(
      <CommentList
        postId="post-1"
        initialComments={mockComments}
        currentUserId="test-user-id"
      />
    )

    expect(screen.getByText('最初のコメント')).toBeInTheDocument()

    const newComments = [
      {
        id: 'comment-new',
        content: '新しいコメント',
        createdAt: new Date().toISOString(),
        parentId: null,
        user: {
          id: 'user-new',
          nickname: '新しいユーザー',
          avatarUrl: null,
        },
        likeCount: 0,
        replyCount: 0,
      },
    ]

    rerender(
      <CommentList
        postId="post-1"
        initialComments={newComments}
        currentUserId="test-user-id"
      />
    )

    expect(screen.getByText('新しいコメント')).toBeInTheDocument()
    expect(screen.queryByText('最初のコメント')).not.toBeInTheDocument()
  })
})
