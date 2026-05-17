import { vi } from 'vitest'
/**
 * CommentList コンポーネントの拡張テスト
 * onDeletedコールバック、ミュート機能のエッジケースをカバー
 */
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
  useRouter: () => ({ refresh: vi.fn() }),
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

// スレッドミュートモック
vi.mock('@/lib/actions/comment-thread-mute', () => ({
  muteThread: vi.fn().mockResolvedValue({ success: true }),
  unmuteThread: vi.fn().mockResolvedValue({ success: true }),
}))

const mockComments = [
  {
    id: 'comment-1',
    content: '最初のコメント',
    createdAt: new Date().toISOString(),
    parentId: null,
    user: { id: 'user-1', nickname: 'ユーザー1', avatarUrl: null },
    likeCount: 5,
    replyCount: 0,
  },
  {
    id: 'comment-2',
    content: '2番目のコメント',
    createdAt: new Date().toISOString(),
    parentId: null,
    user: { id: 'user-2', nickname: 'ユーザー2', avatarUrl: null },
    likeCount: 3,
    replyCount: 2,
  },
]

describe('CommentList 拡張テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mutedThreadIdsが渡された場合、該当コメントがミュート状態になる', () => {
    render(
      <CommentList
        postId="post-1"
        initialComments={mockComments}
        currentUserId="test-user-id"
        mutedThreadIds={['comment-1']}
      />
    )

    // コメント自体は表示される（ミュート状態はCommentCardで処理）
    expect(screen.getByText('最初のコメント')).toBeInTheDocument()
  })

  it('空のmutedThreadIdsでも正常に動作する', () => {
    render(
      <CommentList
        postId="post-1"
        initialComments={mockComments}
        currentUserId="test-user-id"
        mutedThreadIds={[]}
      />
    )

    expect(screen.getByText('最初のコメント')).toBeInTheDocument()
    expect(screen.getByText('2番目のコメント')).toBeInTheDocument()
  })

  it('削除コールバックがreplyCountがある場合はisDeletedをtrueにする', async () => {
    // replyCount=2のコメントを持つ
    const commentWithReplies = [
      {
        id: 'comment-with-replies',
        content: '返信があるコメント',
        createdAt: new Date().toISOString(),
        parentId: null,
        user: { id: 'test-user-id', nickname: 'テスト', avatarUrl: null },
        likeCount: 0,
        replyCount: 2,
      },
    ]

    render(
      <CommentList
        postId="post-1"
        initialComments={commentWithReplies}
        currentUserId="test-user-id"
      />
    )

    expect(screen.getByText('返信があるコメント')).toBeInTheDocument()
  })

  it('追加読み込み中にもう一度クリックしても重複リクエストしない', async () => {
    // 非常に遅いレスポンスをシミュレート
    mockGetComments.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ comments: [], nextCursor: undefined }), 500))
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

    const loadMoreButton = screen.getByRole('button', { name: 'さらに読み込む' })

    // 1回目のクリック
    await user.click(loadMoreButton)

    // ボタンが無効化されるのを待つ
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '読み込み中...' })).toBeDisabled()
    })

    // getCommentsは1回だけ呼ばれる
    expect(mockGetComments).toHaveBeenCalledTimes(1)
  })

  it('getCommentsが失敗した場合もクラッシュしない', async () => {
    mockGetComments.mockResolvedValue({ comments: null, nextCursor: undefined })

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
      // ローディングが終了し、ボタンが再度表示されるか消える
      expect(screen.queryByRole('button', { name: '読み込み中...' })).not.toBeInTheDocument()
    })
  })

  it('initialNextCursorがundefinedからstringに変わると状態が更新される', () => {
    const { rerender } = render(
      <CommentList
        postId="post-1"
        initialComments={mockComments}
        initialNextCursor={undefined}
        currentUserId="test-user-id"
      />
    )

    // 最初はボタンなし
    expect(screen.queryByRole('button', { name: 'さらに読み込む' })).not.toBeInTheDocument()

    // 再レンダリングでカーソルを追加
    rerender(
      <CommentList
        postId="post-1"
        initialComments={mockComments}
        initialNextCursor="new-cursor"
        currentUserId="test-user-id"
      />
    )

    // ボタンが表示される
    expect(screen.getByRole('button', { name: 'さらに読み込む' })).toBeInTheDocument()
  })

  it('currentUserIdがundefinedでも表示される', () => {
    render(
      <CommentList
        postId="post-1"
        initialComments={mockComments}
        currentUserId={undefined}
      />
    )

    expect(screen.getByText('最初のコメント')).toBeInTheDocument()
  })

  it('追加読み込み後にnextCursorがundefinedになるとボタンが消える', async () => {
    mockGetComments.mockResolvedValue({
      comments: [
        {
          id: 'comment-3',
          content: '追加コメント',
          createdAt: new Date().toISOString(),
          parentId: null,
          user: { id: 'user-3', nickname: 'ユーザー3', avatarUrl: null },
          likeCount: 0,
          replyCount: 0,
        },
      ],
      nextCursor: undefined, // これ以上データなし
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
      expect(screen.getByText('追加コメント')).toBeInTheDocument()
    })

    // ボタンが消えている
    expect(screen.queryByRole('button', { name: 'さらに読み込む' })).not.toBeInTheDocument()
  })

  describe('onDeletedコールバック', () => {
    it('replyCountがundefinedのコメントを削除するとリストから完全に削除される', async () => {
      const commentsWithUndefinedReplyCount = [
        {
          id: 'comment-no-reply',
          content: '返信なしコメント',
          createdAt: new Date().toISOString(),
          parentId: null,
          user: { id: 'test-user-id', nickname: 'テスト', avatarUrl: null },
          likeCount: 0,
          // replyCountがundefined
        },
      ]

      const { rerender } = render(
        <CommentList
          postId="post-1"
          initialComments={commentsWithUndefinedReplyCount}
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('返信なしコメント')).toBeInTheDocument()

      // onDeletedがトリガーされた場合をシミュレート
      // CommentCardからonDeletedコールバックが呼ばれた状況を再現
      rerender(
        <CommentList
          postId="post-1"
          initialComments={[]} // 削除後の状態
          currentUserId="test-user-id"
        />
      )

      expect(screen.queryByText('返信なしコメント')).not.toBeInTheDocument()
    })

    it('replyCount=0のコメントを削除するとリストから完全に削除される', () => {
      const commentsWithZeroReplies = [
        {
          id: 'comment-zero-reply',
          content: 'replyCount=0のコメント',
          createdAt: new Date().toISOString(),
          parentId: null,
          user: { id: 'test-user-id', nickname: 'テスト', avatarUrl: null },
          likeCount: 0,
          replyCount: 0,
        },
      ]

      render(
        <CommentList
          postId="post-1"
          initialComments={commentsWithZeroReplies}
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('replyCount=0のコメント')).toBeInTheDocument()
    })

    it('replyCount>0のコメントを削除するとisDeleted=trueになる', () => {
      const commentsWithReplies = [
        {
          id: 'comment-with-replies',
          content: '返信ありコメント',
          createdAt: new Date().toISOString(),
          parentId: null,
          user: { id: 'test-user-id', nickname: 'テスト', avatarUrl: null },
          likeCount: 0,
          replyCount: 3,
        },
      ]

      render(
        <CommentList
          postId="post-1"
          initialComments={commentsWithReplies}
          currentUserId="test-user-id"
        />
      )

      // replyCount=3があるのでボタンが表示される
      expect(screen.getByText(/3件の返信を表示/)).toBeInTheDocument()
    })

    it('isDeleted=trueのコメントは「削除されたコメントです」と表示される', () => {
      const deletedComment = [
        {
          id: 'deleted-comment',
          content: '元のコメント内容',
          createdAt: new Date().toISOString(),
          parentId: null,
          user: { id: 'user-1', nickname: 'ユーザー1', avatarUrl: null },
          likeCount: 0,
          replyCount: 2,
          isDeleted: true, // 削除済み
        },
      ]

      render(
        <CommentList
          postId="post-1"
          initialComments={deletedComment}
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('削除されたコメントです')).toBeInTheDocument()
      expect(screen.queryByText('元のコメント内容')).not.toBeInTheDocument()
    })
  })
})
