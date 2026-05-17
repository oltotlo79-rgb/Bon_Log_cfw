import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { CommentLikeButton } from '@/components/comment/CommentLikeButton'

// Server Actionモック
const mockToggleCommentLike = vi.fn()
vi.mock('@/lib/actions/like', () => ({
  toggleCommentLike: (...args: unknown[]) => mockToggleCommentLike(...args),
}))

describe('CommentLikeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('いいねボタンを表示する', () => {
    render(
      <CommentLikeButton
        commentId="comment-1"
        postId="post-1"
        initialLiked={false}
        initialCount={10}
      />
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('いいね数を表示する', () => {
    render(
      <CommentLikeButton
        commentId="comment-1"
        postId="post-1"
        initialLiked={false}
        initialCount={42}
      />
    )
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('未いいね状態で表示される', () => {
    render(
      <CommentLikeButton
        commentId="comment-1"
        postId="post-1"
        initialLiked={false}
        initialCount={10}
      />
    )
    const button = screen.getByRole('button')
    expect(button).toHaveClass('text-muted-foreground')
  })

  it('いいね済み状態で表示される', () => {
    render(
      <CommentLikeButton
        commentId="comment-1"
        postId="post-1"
        initialLiked={true}
        initialCount={10}
      />
    )
    const button = screen.getByRole('button')
    expect(button).toHaveClass('text-foreground')
  })

  it('クリックでいいねをトグルする（未いいね→いいね）', async () => {
    mockToggleCommentLike.mockResolvedValue({ success: true, data: { liked: true } })

    const user = userEvent.setup()
    render(
      <CommentLikeButton
        commentId="comment-1"
        postId="post-1"
        initialLiked={false}
        initialCount={10}
      />
    )

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockToggleCommentLike).toHaveBeenCalledWith('comment-1', 'post-1')
    })
  })

  it('クリックでいいねをトグルする（いいね→解除）', async () => {
    mockToggleCommentLike.mockResolvedValue({ success: true, data: { liked: false } })

    const user = userEvent.setup()
    render(
      <CommentLikeButton
        commentId="comment-1"
        postId="post-1"
        initialLiked={true}
        initialCount={10}
      />
    )

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockToggleCommentLike).toHaveBeenCalledWith('comment-1', 'post-1')
    })
  })

  it('エラー時は元の状態に戻る', async () => {
    mockToggleCommentLike.mockResolvedValue({ success: false, error: 'エラーが発生しました' })

    const user = userEvent.setup()
    render(
      <CommentLikeButton
        commentId="comment-1"
        postId="post-1"
        initialLiked={false}
        initialCount={10}
      />
    )

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockToggleCommentLike).toHaveBeenCalledWith('comment-1', 'post-1')
    })

    // エラー後も10のまま（ロールバック）
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument()
    })
  })

  it('propsが更新されると状態が同期される', () => {
    const { rerender } = render(
      <CommentLikeButton
        commentId="comment-1"
        postId="post-1"
        initialLiked={false}
        initialCount={10}
      />
    )
    expect(screen.getByText('10')).toBeInTheDocument()

    rerender(
      <CommentLikeButton
        commentId="comment-1"
        postId="post-1"
        initialLiked={true}
        initialCount={15}
      />
    )
    expect(screen.getByText('15')).toBeInTheDocument()
  })
})
