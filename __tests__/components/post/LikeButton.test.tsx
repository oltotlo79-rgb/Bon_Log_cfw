import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { LikeButton } from '@/components/post/LikeButton'

// Server Actionモック
const mockTogglePostLike = vi.fn()
vi.mock('@/lib/actions/like', () => ({
  togglePostLike: (...args: unknown[]) => mockTogglePostLike(...args),
}))

describe('LikeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('いいねボタンを表示する', () => {
    render(<LikeButton postId="post-1" initialLiked={false} initialCount={10} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('いいね数を表示する', () => {
    render(<LikeButton postId="post-1" initialLiked={false} initialCount={42} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('未いいね状態で表示される', () => {
    render(<LikeButton postId="post-1" initialLiked={false} initialCount={10} />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('text-muted-foreground')
  })

  it('いいね済み状態で表示される', () => {
    render(<LikeButton postId="post-1" initialLiked={true} initialCount={10} />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('text-rose-500')
  })

  it('クリックでいいねをトグルする（未いいね→いいね）', async () => {
    mockTogglePostLike.mockResolvedValue({ success: true, data: { liked: true } })

    const user = userEvent.setup()
    render(<LikeButton postId="post-1" initialLiked={false} initialCount={10} />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockTogglePostLike).toHaveBeenCalledWith('post-1')
    })
  })

  it('クリックでいいねをトグルする（いいね→解除）', async () => {
    mockTogglePostLike.mockResolvedValue({ success: true, data: { liked: false } })

    const user = userEvent.setup()
    render(<LikeButton postId="post-1" initialLiked={true} initialCount={10} />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockTogglePostLike).toHaveBeenCalledWith('post-1')
    })
  })

  it('エラー時は元の状態に戻る', async () => {
    mockTogglePostLike.mockResolvedValue({ success: false, error: 'エラーが発生しました' })

    const user = userEvent.setup()
    render(<LikeButton postId="post-1" initialLiked={false} initialCount={10} />)

    await user.click(screen.getByRole('button'))

    // サーバーアクションが呼ばれることを確認
    await waitFor(() => {
      expect(mockTogglePostLike).toHaveBeenCalledWith('post-1')
    })

    // エラー後も10のまま（ロールバック）
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument()
    })
  })

  it('propsが更新されると状態が同期される', () => {
    const { rerender } = render(<LikeButton postId="post-1" initialLiked={false} initialCount={10} />)
    expect(screen.getByText('10')).toBeInTheDocument()

    rerender(<LikeButton postId="post-1" initialLiked={true} initialCount={15} />)
    expect(screen.getByText('15')).toBeInTheDocument()
  })
})
