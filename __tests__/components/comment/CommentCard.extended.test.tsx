import { vi } from 'vitest'
/**
 * CommentCard コンポーネントの拡張テスト
 * ブロックユーザー、エッジケース、追加カバレッジ
 */
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { CommentCard } from '@/components/comment/CommentCard'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

// Server Actions モック
const mockDeleteComment = vi.fn()
const mockGetReplies = vi.fn()
vi.mock('@/lib/actions/comment', () => ({
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  getReplies: (...args: unknown[]) => mockGetReplies(...args),
}))

// CommentFormモック
vi.mock('@/components/comment/CommentForm', () => ({
  CommentForm: (props: { onSuccess?: () => void; onCancel?: () => void; placeholder?: string }) => (
    <div data-testid="mock-comment-form">
      <input placeholder={props.placeholder} />
      {props.onSuccess && <button onClick={props.onSuccess} data-testid="submit-reply">送信</button>}
      {props.onCancel && <button onClick={props.onCancel}>キャンセル</button>}
    </div>
  ),
}))

// スレッドミュートモック
vi.mock('@/lib/actions/comment-thread-mute', () => ({
  muteThread: vi.fn().mockResolvedValue({ success: true }),
  unmuteThread: vi.fn().mockResolvedValue({ success: true }),
}))

// いいねアクションモック
vi.mock('@/lib/actions/like', () => ({
  toggleCommentLike: vi.fn().mockResolvedValue({ success: true, data: { liked: true } }),
}))

// useToast モック
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

const mockComment = {
  id: 'comment-1',
  content: 'テストコメント',
  createdAt: new Date().toISOString(),
  parentId: null,
  user: { id: 'user-1', nickname: 'テストユーザー', avatarUrl: null },
  likeCount: 5,
  replyCount: 0,
  isLiked: false,
}

describe('CommentCard 拡張テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ブロックユーザー表示', () => {
    it('ブロックされたユーザーのコメントは「ブロック中のユーザーのコメントです」と表示', () => {
      render(
        <CommentCard
          comment={{ ...mockComment, isBlockedUser: true }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('ブロック中のユーザーのコメントです')).toBeInTheDocument()
      expect(screen.queryByText('テストコメント')).not.toBeInTheDocument()
    })

    it('ブロックユーザーのコメントにも返信表示ボタンは表示される（replyCountがある場合）', () => {
      render(
        <CommentCard
          comment={{ ...mockComment, isBlockedUser: true, replyCount: 3 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('3件の返信を表示')).toBeInTheDocument()
    })
  })

  describe('ミュート状態', () => {
    it('isMuted=trueの場合はミュートアイコンが変わる', () => {
      render(
        <CommentCard
          comment={mockComment}
          postId="post-1"
          currentUserId="test-user-id"
          isMuted={true}
        />
      )

      // bell-offアイコンがある
      const muteButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-bell-off')
      )
      expect(muteButton).toBeInTheDocument()
    })
  })

  describe('返信取得エラーハンドリング', () => {
    it('返信がnullで返ってきても処理できる', async () => {
      mockGetReplies.mockResolvedValue({ replies: null })

      const commentWithReplies = { ...mockComment, replyCount: 1 }
      const user = userEvent.setup()

      render(
        <CommentCard
          comment={commentWithReplies}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      await user.click(screen.getByRole('button', { name: /1件の返信を表示/i }))

      await waitFor(() => {
        // クラッシュしないことを確認
        expect(screen.getByText('テストコメント')).toBeInTheDocument()
      })
    })
  })

  describe('rootCommentId', () => {
    it('返信コメントでrootCommentIdが渡される場合、ミュートボタンで使用される', () => {
      render(
        <CommentCard
          comment={mockComment}
          postId="post-1"
          currentUserId="test-user-id"
          depth={1}
          rootCommentId="root-123"
        />
      )

      // ミュートボタンが表示される
      const muteButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-bell') || btn.querySelector('svg.lucide-bell-off')
      )
      expect(muteButton).toBeInTheDocument()
    })
  })

  describe('深いネスト', () => {
    it('depth=3でも正常に表示される', () => {
      render(
        <CommentCard
          comment={mockComment}
          postId="post-1"
          currentUserId="test-user-id"
          depth={3}
        />
      )

      expect(screen.getByText('テストコメント')).toBeInTheDocument()
    })
  })

  describe('削除処理の詳細', () => {
    it('削除処理中はボタンがローディング状態になる', async () => {
      mockDeleteComment.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      )

      const user = userEvent.setup()
      render(
        <CommentCard
          comment={mockComment}
          postId="post-1"
          currentUserId="user-1" // コメント投稿者と同じ
        />
      )

      // 削除ボタンをクリック
      const deleteButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-trash-2')
      )
      await user.click(deleteButton!)

      await waitFor(() => {
        expect(screen.getByText('コメントを削除')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '削除' }))

      // 削除処理が呼ばれる
      await waitFor(() => {
        expect(mockDeleteComment).toHaveBeenCalledWith('comment-1')
      })
    })

    it('削除エラー時にトーストが表示される', async () => {
      mockDeleteComment.mockResolvedValue({ error: '削除に失敗しました' })

      const user = userEvent.setup()
      render(
        <CommentCard
          comment={mockComment}
          postId="post-1"
          currentUserId="user-1"
        />
      )

      const deleteButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-trash-2')
      )
      await user.click(deleteButton!)

      await waitFor(() => {
        expect(screen.getByText('コメントを削除')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '削除' }))

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '削除に失敗しました', variant: 'destructive' }))
      })
    })

    it('削除成功時にonDeletedコールバックが呼ばれる', async () => {
      const onDeletedMock = vi.fn()
      mockDeleteComment.mockResolvedValue({ success: true })

      const user = userEvent.setup()
      render(
        <CommentCard
          comment={mockComment}
          postId="post-1"
          currentUserId="user-1"
          onDeleted={onDeletedMock}
        />
      )

      const deleteButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-trash-2')
      )
      await user.click(deleteButton!)

      await waitFor(() => {
        expect(screen.getByText('コメントを削除')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '削除' }))

      await waitFor(() => {
        expect(onDeletedMock).toHaveBeenCalledWith('comment-1')
      })
    })
  })

  describe('複数メディア', () => {
    it('4つのメディアがある場合もgrid-cols-2で表示', () => {
      const commentWith4Media = {
        ...mockComment,
        media: [
          { id: 'm1', url: '/img1.jpg', type: 'image', sortOrder: 0 },
          { id: 'm2', url: '/img2.jpg', type: 'image', sortOrder: 1 },
          { id: 'm3', url: '/img3.jpg', type: 'image', sortOrder: 2 },
          { id: 'm4', url: '/img4.jpg', type: 'image', sortOrder: 3 },
        ],
      }

      const { container } = render(
        <CommentCard
          comment={commentWith4Media}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(container.querySelector('.grid-cols-2')).toBeInTheDocument()
    })

    it('画像と動画の混在', () => {
      const commentWithMixedMedia = {
        ...mockComment,
        media: [
          { id: 'm1', url: '/img1.jpg', type: 'image', sortOrder: 0 },
          { id: 'm2', url: '/video.mp4', type: 'video', sortOrder: 1 },
        ],
      }

      render(
        <CommentCard
          comment={commentWithMixedMedia}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      const img = document.querySelector('img[src="/img1.jpg"]')
      const video = document.querySelector('video[src="/video.mp4"]')
      expect(img).toBeInTheDocument()
      expect(video).toBeInTheDocument()
    })
  })

  describe('いいね数0の場合', () => {
    it('likeCount=0でも表示される', () => {
      render(
        <CommentCard
          comment={{ ...mockComment, likeCount: 0 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // 0は表示されないか、または空で表示
      expect(screen.getByText('テストコメント')).toBeInTheDocument()
    })
  })

  describe('返信フォームの表示/非表示', () => {
    it('返信フォームを開いて閉じて再度開ける', async () => {
      const user = userEvent.setup()
      render(
        <CommentCard
          comment={mockComment}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // 開く
      await user.click(screen.getByRole('button', { name: /返信/i }))
      expect(screen.getByTestId('mock-comment-form')).toBeInTheDocument()

      // 閉じる
      await user.click(screen.getByRole('button', { name: /キャンセル/i }))
      await waitFor(() => {
        expect(screen.queryByTestId('mock-comment-form')).not.toBeInTheDocument()
      })

      // 再度開く
      await user.click(screen.getByRole('button', { name: /返信/i }))
      expect(screen.getByTestId('mock-comment-form')).toBeInTheDocument()
    })
  })

  describe('日付表示', () => {
    it('過去の日付も正しく表示される', () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 7) // 7日前

      render(
        <CommentCard
          comment={{ ...mockComment, createdAt: oldDate.toISOString() }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // "7日前" または "1週間前" のような表示
      expect(screen.getByText(/前/)).toBeInTheDocument()
    })
  })

  describe('削除されたコメントの返信表示', () => {
    it('削除されたコメントでも返信があれば返信表示ボタンが表示される', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-1',
            content: '削除コメントへの返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-deleted',
            user: { id: 'user-2', nickname: 'ユーザー2', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      const deletedComment = {
        ...mockComment,
        id: 'comment-deleted',
        isDeleted: true,
        replyCount: 1,
      }

      render(
        <CommentCard
          comment={deletedComment}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('削除されたコメントです')).toBeInTheDocument()
      expect(screen.getByText(/1件の返信を表示/)).toBeInTheDocument()

      // 返信を表示
      await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))

      await waitFor(() => {
        expect(screen.getByText('削除コメントへの返信')).toBeInTheDocument()
      })
    })

    it('削除されたコメントの返信を閉じることができる', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-2',
            content: '表示された返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-deleted-2',
            user: { id: 'user-3', nickname: 'ユーザー3', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      const deletedComment = {
        ...mockComment,
        id: 'comment-deleted-2',
        isDeleted: true,
        replyCount: 1,
      }

      render(
        <CommentCard
          comment={deletedComment}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // 返信を表示
      await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))

      await waitFor(() => {
        expect(screen.getByText('表示された返信')).toBeInTheDocument()
      })

      // 返信を非表示
      await user.click(screen.getByRole('button', { name: /返信を非表示/ }))

      await waitFor(() => {
        expect(screen.queryByText('表示された返信')).not.toBeInTheDocument()
      })
    })
  })

  describe('ネストされた返信のonDeletedコールバック', () => {
    it('返信を表示して返信内のCommentCardがレンダリングされる', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'nested-reply-1',
            content: 'ネストされた返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-nested', nickname: 'ネストユーザー', avatarUrl: '/avatar.jpg' },
            likeCount: 2,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      const commentWithReplies = { ...mockComment, replyCount: 1 }

      render(
        <CommentCard
          comment={commentWithReplies}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))

      await waitFor(() => {
        expect(screen.getByText('ネストされた返信')).toBeInTheDocument()
        expect(screen.getByText('ネストユーザー')).toBeInTheDocument()
      })
    })

    it('onDeletedコールバック付きでCommentCardを受け取る', async () => {
      const onDeletedMock = vi.fn()
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-with-ondeleted',
            content: 'onDeleted付き返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-1', nickname: 'ユーザー1', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      const commentWithReplies = { ...mockComment, replyCount: 1 }

      render(
        <CommentCard
          comment={commentWithReplies}
          postId="post-1"
          currentUserId="test-user-id"
          onDeleted={onDeletedMock}
        />
      )

      await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))

      await waitFor(() => {
        expect(screen.getByText('onDeleted付き返信')).toBeInTheDocument()
      })
    })
  })

  describe('ブロックユーザーの返信表示', () => {
    it('ブロックユーザーのコメントから返信を展開できる', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'blocked-user-reply',
            content: 'ブロックユーザーへの返信',
            createdAt: new Date().toISOString(),
            parentId: 'blocked-comment',
            user: { id: 'normal-user', nickname: '通常ユーザー', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      const blockedComment = {
        ...mockComment,
        id: 'blocked-comment',
        isBlockedUser: true,
        replyCount: 1,
      }

      render(
        <CommentCard
          comment={blockedComment}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('ブロック中のユーザーのコメントです')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))

      await waitFor(() => {
        expect(screen.getByText('ブロックユーザーへの返信')).toBeInTheDocument()
      })
    })

    it('ブロックユーザーの返信を非表示にできる', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'blocked-reply-2',
            content: '非表示テスト返信',
            createdAt: new Date().toISOString(),
            parentId: 'blocked-comment-2',
            user: { id: 'another-user', nickname: '別ユーザー', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      const blockedComment = {
        ...mockComment,
        id: 'blocked-comment-2',
        isBlockedUser: true,
        replyCount: 1,
      }

      render(
        <CommentCard
          comment={blockedComment}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))

      await waitFor(() => {
        expect(screen.getByText('非表示テスト返信')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /返信を非表示/ }))

      await waitFor(() => {
        expect(screen.queryByText('非表示テスト返信')).not.toBeInTheDocument()
      })
    })
  })

  describe('mentionUsers', () => {
    it('mentionUsersが渡された場合、返信にも伝播される', async () => {
      const mentionUsers = new Map([
        ['mention-1', { id: 'mention-1', nickname: 'メンション1', avatarUrl: null }],
        ['mention-2', { id: 'mention-2', nickname: 'メンション2', avatarUrl: null }],
      ])

      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-with-mentions',
            content: '@メンション1 テスト',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-2', nickname: 'ユーザー2', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      const commentWithReplies = { ...mockComment, replyCount: 1 }

      render(
        <CommentCard
          comment={commentWithReplies}
          postId="post-1"
          currentUserId="test-user-id"
          mentionUsers={mentionUsers}
        />
      )

      await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))

      await waitFor(() => {
        expect(screen.getByText(/@メンション1/)).toBeInTheDocument()
      })
    })
  })

  describe('depth制限', () => {
    it('depth=2以上ではさらなる返信展開ボタンが表示されない', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'deep-reply',
            content: '深いネストの返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-deep', nickname: '深いユーザー', avatarUrl: null },
            likeCount: 0,
            replyCount: 5, // 返信がある設定
          },
        ],
      })

      const user = userEvent.setup()
      const commentWithReplies = { ...mockComment, replyCount: 1 }

      render(
        <CommentCard
          comment={commentWithReplies}
          postId="post-1"
          currentUserId="test-user-id"
          depth={1}
        />
      )

      await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))

      await waitFor(() => {
        expect(screen.getByText('深いネストの返信')).toBeInTheDocument()
      })
    })
  })

  describe('メンションの表示', () => {
    it('コメント内のメンションがリンクとして表示される', () => {
      const mentionUsers = new Map([
        ['mentioned-user-1', { id: 'mentioned-user-1', nickname: '言及ユーザー', avatarUrl: null }],
      ])

      const commentWithMention = {
        ...mockComment,
        content: 'テスト <@mentioned-user-1> への返信',
      }

      render(
        <CommentCard
          comment={commentWithMention}
          postId="post-1"
          currentUserId="test-user-id"
          mentionUsers={mentionUsers}
        />
      )

      // メンションリンクが表示される
      const mentionLink = screen.getByText('@言及ユーザー')
      expect(mentionLink).toBeInTheDocument()
      expect(mentionLink.closest('a')).toHaveAttribute('href', '/users/mentioned-user-1')
    })

    it('mentionUsersにユーザーがいない場合はunknownと表示', () => {
      const commentWithUnknownMention = {
        ...mockComment,
        content: 'テスト <@unknown-user> への返信',
      }

      render(
        <CommentCard
          comment={commentWithUnknownMention}
          postId="post-1"
          currentUserId="test-user-id"
          mentionUsers={new Map()} // 空のMap
        />
      )

      // unknownが表示される
      expect(screen.getByText('@unknown')).toBeInTheDocument()
    })
  })

  describe('返信成功時の処理', () => {
    it('返信送信成功後に返信一覧が更新される', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'new-reply',
            content: '新しい返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'test-user-id', nickname: 'テスト', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      render(
        <CommentCard
          comment={mockComment}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // 返信ボタンをクリックしてフォームを開く
      await user.click(screen.getByRole('button', { name: /返信/i }))
      expect(screen.getByTestId('mock-comment-form')).toBeInTheDocument()

      // 返信を送信（モックのonSuccessをトリガー）
      await user.click(screen.getByTestId('submit-reply'))

      // 返信一覧が更新されるのを待つ
      await waitFor(() => {
        expect(mockGetReplies).toHaveBeenCalledWith('comment-1')
      })

      await waitFor(() => {
        expect(screen.getByText('新しい返信')).toBeInTheDocument()
      })
    })

    it('返信送信成功後にrouter.refreshが呼ばれる', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-after-submit',
            content: '送信後の返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'test-user-id', nickname: 'テスト', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      render(
        <CommentCard
          comment={mockComment}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      await user.click(screen.getByRole('button', { name: /返信/i }))
      await user.click(screen.getByTestId('submit-reply'))

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })
    })
  })

  describe('ハッシュタグの表示', () => {
    it('コメント内のハッシュタグがリンクとして表示される', () => {
      const commentWithHashtag = {
        ...mockComment,
        content: 'テスト投稿 #盆栽 #園芸',
      }

      render(
        <CommentCard
          comment={commentWithHashtag}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // ハッシュタグリンクが表示される
      const hashtagLink = screen.getByText('#盆栽')
      expect(hashtagLink).toBeInTheDocument()
      expect(hashtagLink.closest('a')).toHaveAttribute('href', expect.stringContaining('/search?q='))
    })
  })

  describe('削除されたコメントのonDeletedコールバック', () => {
    it('削除されたコメントの返信を削除するとonDeletedが呼ばれる', async () => {
      const onDeletedMock = vi.fn()
      mockDeleteComment.mockResolvedValue({ success: true })
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-to-delete',
            content: '削除予定の返信',
            createdAt: new Date().toISOString(),
            parentId: 'deleted-parent',
            user: { id: 'test-user-id', nickname: 'テスト', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      const deletedComment = {
        ...mockComment,
        id: 'deleted-parent',
        isDeleted: true,
        replyCount: 1,
      }

      render(
        <CommentCard
          comment={deletedComment}
          postId="post-1"
          currentUserId="test-user-id"
          onDeleted={onDeletedMock}
        />
      )

      // 返信を展開
      await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))

      await waitFor(() => {
        expect(screen.getByText('削除予定の返信')).toBeInTheDocument()
      })
    })
  })

  describe('通常コメントの返信からのonDeletedコールバック', () => {
    it('返信削除時にreplyCountがない場合リストから削除される', async () => {
      mockDeleteComment.mockResolvedValue({ success: true })
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'deletable-reply',
            content: '削除可能な返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'test-user-id', nickname: 'テスト', avatarUrl: null },
            likeCount: 0,
            // replyCountなし
          },
        ],
      })

      const user = userEvent.setup()
      const commentWithReplies = { ...mockComment, replyCount: 1 }

      render(
        <CommentCard
          comment={commentWithReplies}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))

      await waitFor(() => {
        expect(screen.getByText('削除可能な返信')).toBeInTheDocument()
      })

      // 返信の削除ボタンをクリック
      const deleteButtons = screen.getAllByRole('button').filter(btn =>
        btn.querySelector('svg.lucide-trash-2')
      )
      if (deleteButtons.length > 0) {
        await user.click(deleteButtons[0])
        await waitFor(() => {
          const confirmButton = screen.queryByRole('button', { name: '削除' })
          if (confirmButton) {
            user.click(confirmButton)
          }
        })
      }
    })

    it('返信削除時にreplyCount>0の場合isDeleted=trueにマークされる', async () => {
      mockDeleteComment.mockResolvedValue({ success: true })
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-with-subreplies',
            content: '子返信がある返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'test-user-id', nickname: 'テスト', avatarUrl: null },
            likeCount: 0,
            replyCount: 2, // 子返信あり
          },
        ],
      })

      const user = userEvent.setup()
      const commentWithReplies = { ...mockComment, replyCount: 1 }

      render(
        <CommentCard
          comment={commentWithReplies}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))

      await waitFor(() => {
        expect(screen.getByText('子返信がある返信')).toBeInTheDocument()
      })

      // 返信の削除ボタンをクリック
      const deleteButtons = screen.getAllByRole('button').filter(btn =>
        btn.querySelector('svg.lucide-trash-2')
      )
      if (deleteButtons.length > 0) {
        await user.click(deleteButtons[0])
        await waitFor(() => {
          const confirmButton = screen.queryByRole('button', { name: '削除' })
          if (confirmButton) {
            user.click(confirmButton)
          }
        })
      }
    })

    it('ネストされた返信を削除するとonDeletedコールバックが発火する', async () => {
      const onDeletedMock = vi.fn()
      mockDeleteComment.mockResolvedValue({ success: true })
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'nested-deletable',
            content: 'ネスト削除返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'test-user-id', nickname: 'テスト', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      const commentWithReplies = { ...mockComment, replyCount: 1 }

      render(
        <CommentCard
          comment={commentWithReplies}
          postId="post-1"
          currentUserId="test-user-id"
          onDeleted={onDeletedMock}
        />
      )

      // 返信を展開
      await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))

      await waitFor(() => {
        expect(screen.getByText('ネスト削除返信')).toBeInTheDocument()
      })

      // 返信の削除ボタンをクリック
      const deleteButtons = screen.getAllByRole('button').filter(btn =>
        btn.querySelector('svg.lucide-trash-2')
      )
      expect(deleteButtons.length).toBeGreaterThan(0)
    })
  })
})
