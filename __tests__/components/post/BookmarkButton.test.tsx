import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BookmarkButton } from '@/components/post/BookmarkButton'

// Server Actionモック
const mockToggleBookmark = vi.fn()
vi.mock('@/lib/actions/bookmark', () => ({
  toggleBookmark: (...args: unknown[]) => mockToggleBookmark(...args),
}))

describe('BookmarkButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ブックマークボタンを表示する', () => {
    render(<BookmarkButton postId="post-1" initialBookmarked={false} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('未ブックマーク状態で表示される', () => {
    render(<BookmarkButton postId="post-1" initialBookmarked={false} />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('text-muted-foreground')
  })

  it('ブックマーク済み状態で表示される', () => {
    render(<BookmarkButton postId="post-1" initialBookmarked={true} />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('text-foreground')
  })

  it('クリックでブックマークをトグルする（未ブックマーク→ブックマーク）', async () => {
    mockToggleBookmark.mockResolvedValue({ success: true, data: { bookmarked: true } })

    const user = userEvent.setup()
    render(<BookmarkButton postId="post-1" initialBookmarked={false} />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockToggleBookmark).toHaveBeenCalledWith('post-1')
    })
  })

  it('クリックでブックマークをトグルする（ブックマーク→解除）', async () => {
    mockToggleBookmark.mockResolvedValue({ success: true, data: { bookmarked: false } })

    const user = userEvent.setup()
    render(<BookmarkButton postId="post-1" initialBookmarked={true} />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockToggleBookmark).toHaveBeenCalledWith('post-1')
    })
  })

  it('エラー時は元の状態に戻る', async () => {
    mockToggleBookmark.mockResolvedValue({ success: false, error: 'エラーが発生しました' })

    const user = userEvent.setup()
    render(<BookmarkButton postId="post-1" initialBookmarked={false} />)

    const button = screen.getByRole('button')
    await user.click(button)

    await waitFor(() => {
      expect(mockToggleBookmark).toHaveBeenCalledWith('post-1')
    })

    // エラー後も未ブックマーク状態（ロールバック）
    await waitFor(() => {
      expect(button).toHaveClass('text-muted-foreground')
    })
  })

  it('propsが更新されると状態が同期される', () => {
    const { rerender } = render(<BookmarkButton postId="post-1" initialBookmarked={false} />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('text-muted-foreground')

    rerender(<BookmarkButton postId="post-1" initialBookmarked={true} />)
    expect(button).toHaveClass('text-foreground')
  })
})
