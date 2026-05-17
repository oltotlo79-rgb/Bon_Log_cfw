import { vi } from 'vitest'
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
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// Server Actions モック
const mockDeleteComment = vi.fn()
const mockGetReplies = vi.fn()
vi.mock('@/lib/actions/comment', () => ({
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  getReplies: (...args: unknown[]) => mockGetReplies(...args),
}))

// CommentFormモック（onSuccessコールバックのテスト用）
let _capturedOnSuccess: (() => void) | null = null
vi.mock('@/components/comment/CommentForm', () => ({
  CommentForm: (props: { onSuccess?: () => void; onCancel?: () => void; placeholder?: string }) => {
    _capturedOnSuccess = props.onSuccess || null
    return (
      <div data-testid="mock-comment-form">
        <input placeholder={props.placeholder} />
        {props.onSuccess && <button onClick={props.onSuccess} data-testid="submit-reply">送信</button>}
        {props.onCancel && <button onClick={props.onCancel}>キャンセル</button>}
      </div>
    )
  },
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

const mockComment = {
  id: 'comment-1',
  content: 'これはテストコメントです',
  createdAt: new Date().toISOString(),
  parentId: null,
  user: {
    id: 'user-1',
    nickname: 'テストユーザー',
    avatarUrl: null,
  },
  likeCount: 5,
  replyCount: 0,
  isLiked: false,
}

describe('CommentCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('コメント内容を表示する', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    expect(screen.getByText('これはテストコメントです')).toBeInTheDocument()
  })

  it('ユーザー情報を表示する', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
  })

  it('相対時間を表示する', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    // formatDistanceToNowが「数秒前」や「約1分前」などを返す
    expect(screen.getByText(/前/)).toBeInTheDocument()
  })

  it('いいねボタンを表示する', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('返信ボタンを表示する（ログイン時）', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    expect(screen.getByRole('button', { name: /返信/i })).toBeInTheDocument()
  })

  it('返信ボタンクリックで返信フォームを表示する', async () => {
    const user = userEvent.setup()
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )

    await user.click(screen.getByRole('button', { name: /返信/i }))
    expect(screen.getByPlaceholderText('@テストユーザー への返信...')).toBeInTheDocument()
  })

  it('コメント所有者のみ削除ボタンを表示する', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="user-1" // コメント投稿者と同じ
      />
    )
    // Trash2アイコンを持つボタンを探す
    const deleteButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    expect(deleteButton).toBeInTheDocument()
  })

  it('コメント所有者でない場合は削除ボタンを表示しない', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="other-user" // 別のユーザー
      />
    )
    const deleteButton = screen.queryAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    expect(deleteButton).toBeUndefined()
  })

  it('返信がある場合「返信を表示」ボタンを表示する', () => {
    const commentWithReplies = {
      ...mockComment,
      replyCount: 3,
    }
    render(
      <CommentCard
        comment={commentWithReplies}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    expect(screen.getByRole('button', { name: /3件の返信を表示/i })).toBeInTheDocument()
  })

  it('返信を表示ボタンクリックで返信を取得する', async () => {
    mockGetReplies.mockResolvedValue({
      replies: [
        {
          id: 'reply-1',
          content: '返信コメント',
          createdAt: new Date().toISOString(),
          parentId: 'comment-1',
          user: { id: 'user-2', nickname: '返信ユーザー', avatarUrl: null },
          likeCount: 0,
          replyCount: 0,
        },
      ],
    })

    const commentWithReplies = {
      ...mockComment,
      replyCount: 1,
    }

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
      expect(mockGetReplies).toHaveBeenCalledWith('comment-1')
    })

    await waitFor(() => {
      expect(screen.getByText('返信コメント')).toBeInTheDocument()
    })
  })

  it('削除確認ダイアログを表示する', async () => {
    const user = userEvent.setup()
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="user-1"
      />
    )

    // 削除ボタンをクリック
    const deleteButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    await user.click(deleteButton!)

    await waitFor(() => {
      expect(screen.getByText('コメントを削除')).toBeInTheDocument()
      expect(screen.getByText('このコメントを削除してもよろしいですか？')).toBeInTheDocument()
    })
  })

  it('削除を実行する', async () => {
    mockDeleteComment.mockResolvedValue({ success: true })
    const mockOnDeleted = vi.fn()

    const user = userEvent.setup()
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="user-1"
        onDeleted={mockOnDeleted}
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

    await waitFor(() => {
      expect(mockDeleteComment).toHaveBeenCalledWith('comment-1')
    })

    await waitFor(() => {
      expect(mockOnDeleted).toHaveBeenCalledWith('comment-1')
    })
  })

  it('ユーザーページへのリンクを持つ', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    const userLinks = screen.getAllByRole('link', { name: /テストユーザー/i })
    expect(userLinks[0]).toHaveAttribute('href', '/users/user-1')
  })

  it('返信コメントの場合、コンポーネント自体にはインデントがない（親側で制御）', () => {
    const { container } = render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
        depth={1}
      />
    )
    // インデントはCommentCard自体ではなく、親の返信一覧divが担当
    expect(container.firstElementChild?.querySelector('.ml-8')).not.toBeInTheDocument()
  })

  it('削除エラー時にエラー状態になる', async () => {
    mockDeleteComment.mockResolvedValue({ error: '削除に失敗しました' })

    const user = userEvent.setup()
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="user-1"
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

    await waitFor(() => {
      expect(mockDeleteComment).toHaveBeenCalledWith('comment-1')
    })
  })

  it('削除キャンセルでダイアログが閉じる', async () => {
    const user = userEvent.setup()
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="user-1"
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

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    await waitFor(() => {
      expect(screen.queryByText('コメントを削除')).not.toBeInTheDocument()
    })
  })

  it('返信フォームのキャンセルでフォームが閉じる', async () => {
    const user = userEvent.setup()
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )

    // 返信ボタンをクリック
    await user.click(screen.getByRole('button', { name: /返信/i }))

    expect(screen.getByPlaceholderText('@テストユーザー への返信...')).toBeInTheDocument()

    // キャンセルボタンをクリック
    await user.click(screen.getByRole('button', { name: /キャンセル/i }))

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('@テストユーザー への返信...')).not.toBeInTheDocument()
    })
  })

  it('currentUserIdがundefinedの場合は返信ボタンを表示しない', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId={undefined}
      />
    )
    expect(screen.queryByRole('button', { name: /返信/i })).not.toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // メンション表示テスト
  // --------------------------------------------------------------------------

  it('メンションがリンクとして表示される', () => {
    const mentionUsers = new Map([
      ['user123', { id: 'user123', nickname: 'john', avatarUrl: null }],
    ])
    const commentWithMention = {
      ...mockComment,
      content: 'Hello <@user123> さん！',
    }
    render(
      <CommentCard
        comment={commentWithMention}
        postId="post-1"
        currentUserId="test-user-id"
        mentionUsers={mentionUsers}
      />
    )

    const mentionLink = screen.getByText('@john')
    expect(mentionLink.closest('a')).toHaveAttribute('href', '/users/user123')
  })

  it('存在しないユーザーのメンションは@unknownと表示される', () => {
    const mentionUsers = new Map<string, { id: string; nickname: string; avatarUrl: string | null }>()
    const commentWithMention = {
      ...mockComment,
      content: 'Hello <@nonexistent> さん！',
    }
    render(
      <CommentCard
        comment={commentWithMention}
        postId="post-1"
        currentUserId="test-user-id"
        mentionUsers={mentionUsers}
      />
    )

    expect(screen.getByText('@unknown')).toBeInTheDocument()
  })

  it('ハッシュタグがリンクとして表示される', () => {
    const commentWithHashtag = {
      ...mockComment,
      content: '盆栽について #盆栽 のタグで投稿',
    }
    render(
      <CommentCard
        comment={commentWithHashtag}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )

    const hashtagLink = screen.getByText('#盆栽')
    expect(hashtagLink.closest('a')).toHaveAttribute('href', '/search?q=%23%E7%9B%86%E6%A0%BD')
  })

  // --------------------------------------------------------------------------
  // インデント・depth テスト
  // --------------------------------------------------------------------------

  it('depth=0の場合はインデントされない', () => {
    const { container } = render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
        depth={0}
      />
    )
    expect(container.querySelector('.ml-8')).not.toBeInTheDocument()
  })

  it('depth=2の場合はインデントされない（2段目以降はフラット表示）', () => {
    const { container } = render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
        depth={2}
      />
    )
    // depth=1のみインデント、depth>=2は追加インデントなし
    expect(container.querySelector('.ml-8')).not.toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // 返信表示トグル テスト
  // --------------------------------------------------------------------------

  it('返信を表示後に非表示にできる', async () => {
    mockGetReplies.mockResolvedValue({
      replies: [
        {
          id: 'reply-1',
          content: '返信テスト',
          createdAt: new Date().toISOString(),
          parentId: 'comment-1',
          user: { id: 'user-2', nickname: '返信者', avatarUrl: null },
          likeCount: 0,
          replyCount: 0,
        },
      ],
    })

    const commentWithReplies = { ...mockComment, replyCount: 1 }
    const user = userEvent.setup()
    render(
      <CommentCard
        comment={commentWithReplies}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )

    // 表示
    await user.click(screen.getByRole('button', { name: /1件の返信を表示/i }))
    await waitFor(() => {
      expect(screen.getByText('返信テスト')).toBeInTheDocument()
    })

    // 非表示
    await user.click(screen.getByRole('button', { name: /返信を非表示/i }))
    await waitFor(() => {
      expect(screen.queryByText('返信テスト')).not.toBeInTheDocument()
    })
  })

  it('返信投稿成功後に返信一覧を再取得して表示する', async () => {
    mockGetReplies.mockResolvedValue({
      replies: [
        {
          id: 'new-reply-1',
          content: '新しい返信',
          createdAt: new Date().toISOString(),
          parentId: 'comment-1',
          user: { id: 'user-3', nickname: '新規返信者', avatarUrl: null },
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

    // 返信ボタンをクリックしてフォームを表示
    await user.click(screen.getByRole('button', { name: /返信/i }))

    // モックCommentFormの送信ボタンをクリック
    await user.click(screen.getByTestId('submit-reply'))

    await waitFor(() => {
      expect(mockGetReplies).toHaveBeenCalledWith('comment-1')
    })

    await waitFor(() => {
      expect(screen.getByText('新しい返信')).toBeInTheDocument()
    })

    expect(mockRefresh).toHaveBeenCalled()
  })

  // --------------------------------------------------------------------------
  // メディア表示テスト
  // --------------------------------------------------------------------------

  it('画像メディアを表示する', () => {
    const commentWithMedia = {
      ...mockComment,
      media: [
        { id: 'm1', url: '/test-image.jpg', type: 'image', sortOrder: 0 },
      ],
    }
    render(
      <CommentCard
        comment={commentWithMedia}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    const img = document.querySelector('img[src="/test-image.jpg"]')
    expect(img).toBeInTheDocument()
  })

  it('動画メディアを表示する', () => {
    const commentWithVideo = {
      ...mockComment,
      media: [
        { id: 'm1', url: '/test-video.mp4', type: 'video', sortOrder: 0 },
      ],
    }
    render(
      <CommentCard
        comment={commentWithVideo}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    const video = document.querySelector('video[src="/test-video.mp4"]')
    expect(video).toBeInTheDocument()
  })

  it('複数メディアの場合grid-cols-2を使用する', () => {
    const commentWith2Media = {
      ...mockComment,
      media: [
        { id: 'm1', url: '/img1.jpg', type: 'image', sortOrder: 0 },
        { id: 'm2', url: '/img2.jpg', type: 'image', sortOrder: 1 },
      ],
    }
    const { container } = render(
      <CommentCard
        comment={commentWith2Media}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    expect(container.querySelector('.grid-cols-2')).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // ミュートボタン テスト
  // --------------------------------------------------------------------------

  it('ログイン時にミュートボタンを表示する', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    const muteButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-bell') || btn.querySelector('svg.lucide-bell-off')
    )
    expect(muteButton).toBeInTheDocument()
  })

  it('未ログイン時にミュートボタンを表示しない', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId={undefined}
      />
    )
    const muteButton = screen.queryAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-bell') || btn.querySelector('svg.lucide-bell-off')
    )
    expect(muteButton).toBeUndefined()
  })

  it('返信コメントでもミュートボタンを表示する', () => {
    render(
      <CommentCard
        comment={mockComment}
        postId="post-1"
        currentUserId="test-user-id"
        depth={1}
        rootCommentId="root-comment-1"
      />
    )
    const muteButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-bell') || btn.querySelector('svg.lucide-bell-off')
    )
    expect(muteButton).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // アバター表示テスト
  // --------------------------------------------------------------------------

  it('アバター画像がある場合はImageで表示する', () => {
    const commentWithAvatar = {
      ...mockComment,
      user: { ...mockComment.user, avatarUrl: '/avatar.jpg' },
    }
    render(
      <CommentCard
        comment={commentWithAvatar}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    const img = document.querySelector('img[alt="テストユーザー"]')
    expect(img).toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // いいねボタン（未ログイン）テスト
  // --------------------------------------------------------------------------

  it('未ログインでいいね数がある場合はログインリンクを表示する', () => {
    render(
      <CommentCard
        comment={{ ...mockComment, likeCount: 3 }}
        postId="post-1"
        currentUserId={undefined}
      />
    )
    const link = screen.getByText('3').closest('a')
    expect(link).toHaveAttribute('href', '/login')
  })

  it('削除されたコメントは「削除されたコメントです」と表示する', () => {
    render(
      <CommentCard
        comment={{ ...mockComment, isDeleted: true }}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    expect(screen.getByText('削除されたコメントです')).toBeInTheDocument()
    expect(screen.queryByText('これはテストコメントです')).not.toBeInTheDocument()
  })

  it('削除されたコメントに返信がある場合は返信表示ボタンを表示する', () => {
    render(
      <CommentCard
        comment={{ ...mockComment, isDeleted: true, replyCount: 3 }}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    expect(screen.getByText('3件の返信を表示')).toBeInTheDocument()
  })

  it('削除されたコメントに返信がない場合は返信表示ボタンを表示しない', () => {
    render(
      <CommentCard
        comment={{ ...mockComment, isDeleted: true, replyCount: 0 }}
        postId="post-1"
        currentUserId="test-user-id"
      />
    )
    expect(screen.queryByText(/件の返信を表示/)).not.toBeInTheDocument()
  })

  it('メンションとハッシュタグが混在するコメントを正しく表示する', () => {
    const mentionUsers = new Map([
      ['user1', { id: 'user1', nickname: 'alice', avatarUrl: null }],
    ])
    const commentWithMixed = {
      ...mockComment,
      content: '<@user1> が #盆栽 について投稿しました',
    }
    render(
      <CommentCard
        comment={commentWithMixed}
        postId="post-1"
        currentUserId="test-user-id"
        mentionUsers={mentionUsers}
      />
    )

    expect(screen.getByText('@alice')).toBeInTheDocument()
    expect(screen.getByText('#盆栽')).toBeInTheDocument()
  })

})
