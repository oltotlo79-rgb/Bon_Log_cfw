import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { QuotePostModal } from '@/components/post/QuotePostModal'
import { MSG_QUOTE_FAILED } from '@/lib/constants/messages'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockCreateQuotePost = vi.fn()
vi.mock('@/lib/actions/post', () => ({
  createQuotePost: (...args: unknown[]) => mockCreateQuotePost(...args),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

const quoteTarget = {
  id: 'post-1',
  content: '元の投稿の本文',
  user: { nickname: '山田' },
}

describe('QuotePostModal - 追加カバレッジテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('キャンセルボタンをクリックすると onOpenChange(false) が呼ばれる', () => {
    const onOpenChange = vi.fn()
    render(<QuotePostModal open={true} onOpenChange={onOpenChange} quoteTarget={quoteTarget} />)

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('失敗結果に error キーが無い場合はフォールバックメッセージを表示する', async () => {
    mockCreateQuotePost.mockResolvedValue({ success: false })
    render(<QuotePostModal open={true} onOpenChange={vi.fn()} quoteTarget={quoteTarget} />)

    fireEvent.change(screen.getByLabelText('引用コメント'), { target: { value: 'コメント' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: MSG_QUOTE_FAILED, variant: 'destructive' }),
      )
    })
  })

  it('成功しても postId が無い場合は遷移しない', async () => {
    mockCreateQuotePost.mockResolvedValue({ success: true, data: {} })
    const onOpenChange = vi.fn()
    render(<QuotePostModal open={true} onOpenChange={onOpenChange} quoteTarget={quoteTarget} />)

    fireEvent.change(screen.getByLabelText('引用コメント'), { target: { value: 'コメント' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('送信中はキャンセル・投稿ボタンが disabled になる', async () => {
    let resolveFn!: (v: { success: boolean; data?: { postId: string } }) => void
    mockCreateQuotePost.mockReturnValue(new Promise((r) => { resolveFn = r }))
    render(<QuotePostModal open={true} onOpenChange={vi.fn()} quoteTarget={quoteTarget} />)

    fireEvent.change(screen.getByLabelText('引用コメント'), { target: { value: 'コメント' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled()
      expect(screen.getByRole('button', { name: '投稿中...' })).toBeDisabled()
    })

    resolveFn({ success: true, data: { postId: 'p2' } })
  })
})
