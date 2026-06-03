import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { QuotePostModal } from '@/components/post/QuotePostModal'

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

function renderModal() {
  return render(
    <QuotePostModal open={true} onOpenChange={vi.fn()} quoteTarget={quoteTarget} />,
  )
}

describe('QuotePostModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateQuotePost.mockResolvedValue({ success: true, data: { postId: 'new-post' } })
  })

  it('引用元のプレビュー（投稿者・本文）を表示する', () => {
    renderModal()
    expect(screen.getByText('山田')).toBeInTheDocument()
    expect(screen.getByText('元の投稿の本文')).toBeInTheDocument()
  })

  it('コメントが空のとき投稿ボタンは無効', () => {
    renderModal()
    expect(screen.getByRole('button', { name: '投稿する' })).toBeDisabled()
  })

  it('コメント入力後に送信すると createQuotePost を引用元IDで呼び、遷移する', async () => {
    renderModal()
    fireEvent.change(screen.getByLabelText('引用コメント'), { target: { value: 'いい木ですね' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockCreateQuotePost).toHaveBeenCalledTimes(1)
    })
    const [formData, quoteId] = mockCreateQuotePost.mock.calls[0]
    expect(quoteId).toBe('post-1')
    expect(formData).toBeInstanceOf(FormData)
    expect(formData.get('content')).toBe('いい木ですね')

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/posts/new-post')
    })
  })

  it('createQuotePost 失敗時はエラートーストを出し遷移しない', async () => {
    mockCreateQuotePost.mockResolvedValue({ success: false, error: '引用投稿に失敗しました' })
    renderModal()
    fireEvent.change(screen.getByLabelText('引用コメント'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' }),
      )
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})
