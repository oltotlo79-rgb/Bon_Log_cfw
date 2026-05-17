import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { CommentActions } from '@/components/comment/CommentActions'

// いいねアクションモック
vi.mock('@/lib/actions/like', () => ({
  toggleCommentLike: vi.fn().mockResolvedValue({ success: true, data: { liked: true } }),
}))

// スレッドミュートモック
vi.mock('@/lib/actions/comment-thread-mute', () => ({
  muteThread: vi.fn().mockResolvedValue({ success: true }),
  unmuteThread: vi.fn().mockResolvedValue({ success: true }),
}))

const defaultProps = {
  commentId: 'comment-1',
  postId: 'post-1',
  currentUserId: 'test-user-id',
  isOwner: false,
  isLiked: false,
  likeCount: 5,
  isDeleting: false,
  showReplyForm: false,
  isMuted: false,
  rootCommentId: 'root-comment-1',
  onToggleReplyForm: vi.fn(),
  onDelete: vi.fn(),
}

describe('CommentActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ログイン時にいいねボタンを表示する', () => {
    render(<CommentActions {...defaultProps} />)
    const likeBtn = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-heart')
    )
    expect(likeBtn).toBeInTheDocument()
  })

  it('ログイン時に返信ボタンを表示する', () => {
    render(<CommentActions {...defaultProps} />)
    expect(screen.getByRole('button', { name: /返信/i })).toBeInTheDocument()
  })

  it('ログイン時にミュートボタンを表示する', () => {
    render(<CommentActions {...defaultProps} />)
    const muteBtn = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-bell') || btn.querySelector('svg.lucide-bell-off')
    )
    expect(muteBtn).toBeInTheDocument()
  })

  it('isOwner=trueの場合、削除ボタンを表示する', () => {
    render(<CommentActions {...defaultProps} isOwner={true} />)
    const deleteBtn = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    expect(deleteBtn).toBeInTheDocument()
  })

  it('isOwner=falseの場合、削除ボタンを表示しない', () => {
    render(<CommentActions {...defaultProps} isOwner={false} />)
    const deleteBtn = screen.queryAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    expect(deleteBtn).toBeUndefined()
  })

  it('未ログイン時にいいね数があればログインリンクを表示する', () => {
    render(<CommentActions {...defaultProps} currentUserId={undefined} likeCount={3} />)
    const link = screen.getByText('3').closest('a')
    expect(link).toHaveAttribute('href', '/login')
  })

  it('未ログイン時にいいね数が0の場合はログインリンクを表示しない', () => {
    render(<CommentActions {...defaultProps} currentUserId={undefined} likeCount={0} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('未ログイン時に返信ボタンを表示しない', () => {
    render(<CommentActions {...defaultProps} currentUserId={undefined} />)
    expect(screen.queryByRole('button', { name: /返信/i })).not.toBeInTheDocument()
  })

  it('未ログイン時にミュートボタンを表示しない', () => {
    render(<CommentActions {...defaultProps} currentUserId={undefined} />)
    const muteBtn = screen.queryAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-bell') || btn.querySelector('svg.lucide-bell-off')
    )
    expect(muteBtn).toBeUndefined()
  })

  it('返信ボタンクリックでonToggleReplyFormが呼ばれる', async () => {
    const mockToggle = vi.fn()
    const user = userEvent.setup()
    render(<CommentActions {...defaultProps} onToggleReplyForm={mockToggle} />)
    await user.click(screen.getByRole('button', { name: /返信/i }))
    expect(mockToggle).toHaveBeenCalledTimes(1)
  })

  it('削除ボタンクリックで削除確認ダイアログを表示する', async () => {
    const user = userEvent.setup()
    render(<CommentActions {...defaultProps} isOwner={true} />)
    const deleteBtn = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    await user.click(deleteBtn!)
    await waitFor(() => {
      expect(screen.getByText('コメントを削除')).toBeInTheDocument()
    })
  })

  it('削除ダイアログで削除ボタンクリックでonDeleteが呼ばれる', async () => {
    const mockDelete = vi.fn()
    const user = userEvent.setup()
    render(<CommentActions {...defaultProps} isOwner={true} onDelete={mockDelete} />)
    const deleteBtn = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    await user.click(deleteBtn!)
    await waitFor(() => {
      expect(screen.getByText('コメントを削除')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '削除' }))
    expect(mockDelete).toHaveBeenCalledTimes(1)
  })

  it('削除ダイアログでキャンセルするとダイアログが閉じる', async () => {
    const user = userEvent.setup()
    render(<CommentActions {...defaultProps} isOwner={true} />)
    const deleteBtn = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    await user.click(deleteBtn!)
    await waitFor(() => {
      expect(screen.getByText('コメントを削除')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    await waitFor(() => {
      expect(screen.queryByText('コメントを削除')).not.toBeInTheDocument()
    })
  })

  it('返信がある場合に削除ダイアログで返信数を表示する', async () => {
    const user = userEvent.setup()
    render(<CommentActions {...defaultProps} isOwner={true} replyCount={3} />)
    const deleteBtn = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    await user.click(deleteBtn!)
    await waitFor(() => {
      expect(screen.getByText(/3件の返信があります/)).toBeInTheDocument()
    })
  })

  it('isDeleting=trueの場合、削除ボタンが無効化される', () => {
    render(<CommentActions {...defaultProps} isOwner={true} isDeleting={true} />)
    const deleteBtn = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-trash-2')
    )
    expect(deleteBtn).toBeDisabled()
  })
})
