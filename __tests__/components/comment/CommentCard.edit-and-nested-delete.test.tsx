/**
 * CommentCard - 編集フロー / ネスト返信削除の連鎖 (handleNestedDeleted)
 *
 * 既存の CommentCard.test.tsx 系は「表示」「削除」「返信取得」を主に検証しており、
 * 編集機能 (handleEditStart/Cancel/Save) と、返信の削除がどう親コメントへ波及するか
 * (handleNestedDeleted) は未検証だったため補強する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { CommentCard } from '@/components/comment/CommentCard'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: { user: { id: 'owner-user' } }, status: 'authenticated' }),
}))

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mockDeleteComment = vi.fn()
const mockGetReplies = vi.fn()
const mockUpdateComment = vi.fn()
vi.mock('@/lib/actions/comment', () => ({
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  getReplies: (...args: unknown[]) => mockGetReplies(...args),
  updateComment: (...args: unknown[]) => mockUpdateComment(...args),
}))

vi.mock('@/lib/actions/comment-thread-mute', () => ({
  muteThread: vi.fn().mockResolvedValue({ success: true }),
  unmuteThread: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/actions/like', () => ({
  toggleCommentLike: vi.fn().mockResolvedValue({ success: true, data: { liked: true } }),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

vi.mock('@/components/comment/CommentForm', () => ({
  CommentForm: (props: { onSuccess?: () => void; onCancel?: () => void; placeholder?: string }) => (
    <div data-testid="mock-comment-form">
      <input placeholder={props.placeholder} />
      {props.onSuccess && <button onClick={props.onSuccess} data-testid="submit-reply">送信</button>}
      {props.onCancel && <button onClick={props.onCancel}>キャンセル返信</button>}
    </div>
  ),
}))

const ownedComment = {
  id: 'owned-comment',
  content: '編集前の内容',
  createdAt: new Date().toISOString(),
  parentId: null,
  user: { id: 'owner-user', nickname: 'オーナー', avatarUrl: null },
  likeCount: 0,
  replyCount: 0,
  isLiked: false,
}

describe('CommentCard - 編集フロー', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('編集ボタンで編集モードに入り、テキストエリアに既存内容が入る', async () => {
    const user = userEvent.setup()
    render(<CommentCard comment={ownedComment} postId="post-1" currentUserId="owner-user" />)

    await user.click(screen.getByRole('button', { name: 'コメントを編集' }))

    const textarea = screen.getByRole('textbox', { name: 'コメントを編集' }) as HTMLTextAreaElement
    expect(textarea.value).toBe('編集前の内容')
  })

  it('編集をキャンセルすると元の表示に戻る', async () => {
    const user = userEvent.setup()
    render(<CommentCard comment={ownedComment} postId="post-1" currentUserId="owner-user" />)

    await user.click(screen.getByRole('button', { name: 'コメントを編集' }))
    expect(screen.getByRole('textbox', { name: 'コメントを編集' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'コメントを編集' })).not.toBeInTheDocument()
    })
    expect(screen.getByText('編集前の内容')).toBeInTheDocument()
  })

  it('内容を変更せずに保存すると Server Action を呼ばずに編集モードを抜ける', async () => {
    const user = userEvent.setup()
    render(<CommentCard comment={ownedComment} postId="post-1" currentUserId="owner-user" />)

    await user.click(screen.getByRole('button', { name: 'コメントを編集' }))
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'コメントを編集' })).not.toBeInTheDocument()
    })
    expect(mockUpdateComment).not.toHaveBeenCalled()
  })

  it('内容を変更して保存すると updateComment が呼ばれ、内容が更新される', async () => {
    mockUpdateComment.mockResolvedValue({
      success: true,
      data: { content: '編集後の内容', editedAt: new Date().toISOString() },
    })
    const user = userEvent.setup()
    render(<CommentCard comment={ownedComment} postId="post-1" currentUserId="owner-user" />)

    await user.click(screen.getByRole('button', { name: 'コメントを編集' }))
    const textarea = screen.getByRole('textbox', { name: 'コメントを編集' })
    await user.clear(textarea)
    await user.type(textarea, '編集後の内容')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(mockUpdateComment).toHaveBeenCalledWith('owned-comment', '編集後の内容')
    })
    await waitFor(() => {
      expect(screen.getByText('編集後の内容')).toBeInTheDocument()
      expect(screen.getByText('（編集済み）')).toBeInTheDocument()
    })
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ description: 'コメントを更新しました' }))
  })

  it('保存に失敗した場合はエラートーストを表示し編集モードを維持する', async () => {
    mockUpdateComment.mockResolvedValue({ success: false, error: '更新に失敗しました' })
    const user = userEvent.setup()
    render(<CommentCard comment={ownedComment} postId="post-1" currentUserId="owner-user" />)

    await user.click(screen.getByRole('button', { name: 'コメントを編集' }))
    const textarea = screen.getByRole('textbox', { name: 'コメントを編集' })
    await user.clear(textarea)
    await user.type(textarea, '別の内容')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'エラー', description: '更新に失敗しました', variant: 'destructive' }),
      )
    })
    // 失敗時は編集モードのまま
    expect(screen.getByRole('textbox', { name: 'コメントを編集' })).toBeInTheDocument()
  })

  it('保存成功時に result.data が無い場合は入力値そのものを content とする', async () => {
    mockUpdateComment.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<CommentCard comment={ownedComment} postId="post-1" currentUserId="owner-user" />)

    await user.click(screen.getByRole('button', { name: 'コメントを編集' }))
    const textarea = screen.getByRole('textbox', { name: 'コメントを編集' })
    await user.clear(textarea)
    await user.type(textarea, 'data無し更新')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(screen.getByText('data無し更新')).toBeInTheDocument()
    })
  })
})

describe('CommentCard - ネスト返信削除の連鎖 (handleNestedDeleted)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteComment.mockResolvedValue({ success: true })
  })

  it('返信に子返信が無い場合、削除するとリストから除去され、残り0件なら親も onDeleted される', async () => {
    mockGetReplies.mockResolvedValue({
      replies: [
        {
          id: 'reply-leaf',
          content: '葉っぱの返信',
          createdAt: new Date().toISOString(),
          parentId: 'parent-comment',
          user: { id: 'owner-user', nickname: 'オーナー', avatarUrl: null },
          likeCount: 0,
          replyCount: 0,
        },
      ],
    })
    const onDeleted = vi.fn()
    const parentComment = {
      ...ownedComment,
      id: 'parent-comment',
      isDeleted: true,
      replyCount: 1,
    }

    const user = userEvent.setup()
    render(
      <CommentCard
        comment={parentComment}
        postId="post-1"
        currentUserId="owner-user"
        onDeleted={onDeleted}
      />,
    )

    await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))
    await waitFor(() => {
      expect(screen.getByText('葉っぱの返信')).toBeInTheDocument()
    })

    const trashButton = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-trash-2'))
    expect(trashButton).toBeDefined()
    await user.click(trashButton!)

    await waitFor(() => {
      expect(screen.getByText('コメントを削除')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => {
      expect(mockDeleteComment).toHaveBeenCalledWith('reply-leaf')
    })
    // 末端の返信が消え、残り0件になったため親コメント自体も onDeleted される
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith('parent-comment')
    })
    expect(screen.queryByText('葉っぱの返信')).not.toBeInTheDocument()
  })

  it('返信に子返信がある場合、削除すると isDeleted=true でプレースホルダ表示に切り替わる（リストからは消えない）', async () => {
    mockGetReplies.mockResolvedValue({
      replies: [
        {
          id: 'reply-with-children',
          content: '子ありの返信',
          createdAt: new Date().toISOString(),
          parentId: 'parent-comment-2',
          user: { id: 'owner-user', nickname: 'オーナー', avatarUrl: null },
          likeCount: 0,
          replyCount: 2,
        },
      ],
    })
    const onDeleted = vi.fn()
    const parentComment = {
      ...ownedComment,
      id: 'parent-comment-2',
      replyCount: 1,
    }

    const user = userEvent.setup()
    render(
      <CommentCard
        comment={parentComment}
        postId="post-1"
        currentUserId="owner-user"
        onDeleted={onDeleted}
      />,
    )

    await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))
    await waitFor(() => {
      expect(screen.getByText('子ありの返信')).toBeInTheDocument()
    })

    // 親コメント自身も owner のため削除ボタンを持つ。返信側（最後に描画される）を選ぶ。
    const trashButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg.lucide-trash-2'))
    expect(trashButtons.length).toBe(2)
    await user.click(trashButtons[trashButtons.length - 1]!)

    await waitFor(() => {
      expect(screen.getByText('コメントを削除')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => {
      expect(mockDeleteComment).toHaveBeenCalledWith('reply-with-children')
    })
    // 子返信があるため、リストからは消えず「削除されたコメントです」表示に変わる
    await waitFor(() => {
      expect(screen.getByText('削除されたコメントです')).toBeInTheDocument()
    })
    // 親コメント自体は onDeleted されない（返信がまだ残っているため）
    expect(onDeleted).not.toHaveBeenCalledWith('parent-comment-2')
  })

  it('複数の末端返信のうち1件を削除しても、残り返信が有る場合は親を onDeleted しない（削除対象のみリストから除去）', async () => {
    mockGetReplies.mockResolvedValue({
      replies: [
        {
          id: 'leaf-a',
          content: '返信A',
          createdAt: new Date().toISOString(),
          parentId: 'parent-multi',
          user: { id: 'owner-user', nickname: 'オーナー', avatarUrl: null },
          likeCount: 0,
          replyCount: 0,
        },
        {
          id: 'leaf-b',
          content: '返信B',
          createdAt: new Date().toISOString(),
          parentId: 'parent-multi',
          user: { id: 'other-user', nickname: '他ユーザー', avatarUrl: null },
          likeCount: 0,
          replyCount: 0,
        },
      ],
    })
    const onDeleted = vi.fn()
    const parentComment = { ...ownedComment, id: 'parent-multi', isDeleted: true, replyCount: 2 }

    const user = userEvent.setup()
    render(
      <CommentCard
        comment={parentComment}
        postId="post-1"
        currentUserId="owner-user"
        onDeleted={onDeleted}
      />,
    )

    await user.click(screen.getByRole('button', { name: /2件の返信を表示/ }))
    await waitFor(() => {
      expect(screen.getByText('返信A')).toBeInTheDocument()
      expect(screen.getByText('返信B')).toBeInTheDocument()
    })

    // 返信Aのみ owner のため削除ボタンを持つ（返信Bは他ユーザー）
    const trashButton = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-trash-2'))
    expect(trashButton).toBeDefined()
    await user.click(trashButton!)
    await waitFor(() => {
      expect(screen.getByText('コメントを削除')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '削除' }))

    await waitFor(() => {
      expect(mockDeleteComment).toHaveBeenCalledWith('leaf-a')
    })
    await waitFor(() => {
      expect(screen.queryByText('返信A')).not.toBeInTheDocument()
    })
    // 返信Bはまだ残っているため、親コメントは onDeleted されない
    expect(screen.getByText('返信B')).toBeInTheDocument()
    expect(onDeleted).not.toHaveBeenCalled()
  })
})

describe('CommentCard - depth 上限', () => {
  it('depth が MAX_COMMENT_DEPTH 以上の場合、スレッドの続きへのリンクのみ表示する', () => {
    render(
      <CommentCard
        comment={ownedComment}
        postId="post-1"
        currentUserId="owner-user"
        depth={10}
      />,
    )
    expect(screen.getByRole('link', { name: /スレッドの続きを表示/ })).toHaveAttribute('href', '/posts/post-1')
    expect(screen.queryByText('編集前の内容')).not.toBeInTheDocument()
  })
})

describe('CommentCard - 返信送信成功だが getReplies が空を返すケース', () => {
  it('返信一覧取得結果に replies が無い場合、表示は更新せずフォームだけ閉じる', async () => {
    mockGetReplies.mockResolvedValue({})
    const user = userEvent.setup()
    render(<CommentCard comment={ownedComment} postId="post-1" currentUserId="owner-user" />)

    await user.click(screen.getByRole('button', { name: /返信/i }))
    expect(screen.getByTestId('mock-comment-form')).toBeInTheDocument()

    await user.click(screen.getByTestId('submit-reply'))

    await waitFor(() => {
      expect(screen.queryByTestId('mock-comment-form')).not.toBeInTheDocument()
    })
    expect(mockRefresh).toHaveBeenCalled()
    // showReplies は true にならないため、返信欄自体が表示されない
    expect(screen.queryByRole('button', { name: /返信を非表示/ })).not.toBeInTheDocument()
  })
})

describe('CommentCard - depth>0 でのブロック/削除プレースホルダ表示（インデント無し分岐）', () => {
  it('isBlockedUser かつ depth>0 の場合、返信一覧に追加インデント(ml-8)を付けない', async () => {
    mockGetReplies.mockResolvedValue({
      replies: [
        {
          id: 'blocked-nested-reply',
          content: 'ネストされたブロック返信',
          createdAt: new Date().toISOString(),
          parentId: 'blocked-depth1',
          user: { id: 'user-x', nickname: 'ユーザーX', avatarUrl: null },
          likeCount: 0,
          replyCount: 0,
        },
      ],
    })
    const blockedComment = { ...ownedComment, id: 'blocked-depth1', isBlockedUser: true, replyCount: 1 }

    const user = userEvent.setup()
    const { container } = render(
      <CommentCard
        comment={blockedComment}
        postId="post-1"
        currentUserId="owner-user"
        depth={1}
      />,
    )

    await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))
    await waitFor(() => {
      expect(screen.getByText('ネストされたブロック返信')).toBeInTheDocument()
    })
    expect(container.querySelector('.ml-8')).not.toBeInTheDocument()
  })

  it('isDeleted かつ depth>0 の場合、返信一覧に追加インデント(ml-8)を付けない', async () => {
    mockGetReplies.mockResolvedValue({
      replies: [
        {
          id: 'deleted-nested-reply',
          content: 'ネストされた削除コメント返信',
          createdAt: new Date().toISOString(),
          parentId: 'deleted-depth1',
          user: { id: 'user-y', nickname: 'ユーザーY', avatarUrl: null },
          likeCount: 0,
          replyCount: 0,
        },
      ],
    })
    const deletedComment = { ...ownedComment, id: 'deleted-depth1', isDeleted: true, replyCount: 1 }

    const user = userEvent.setup()
    const { container } = render(
      <CommentCard
        comment={deletedComment}
        postId="post-1"
        currentUserId="owner-user"
        depth={1}
      />,
    )

    await user.click(screen.getByRole('button', { name: /1件の返信を表示/ }))
    await waitFor(() => {
      expect(screen.getByText('ネストされた削除コメント返信')).toBeInTheDocument()
    })
    expect(container.querySelector('.ml-8')).not.toBeInTheDocument()
  })
})
