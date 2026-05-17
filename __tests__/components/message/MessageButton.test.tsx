import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { MessageButton } from '@/components/message/MessageButton'

// Next.js navigation モック
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Server Actions モック
const mockGetOrCreateConversation = vi.fn()
vi.mock('@/lib/actions/message', () => ({
  getOrCreateConversation: (...args: unknown[]) => mockGetOrCreateConversation(...args),
}))

describe('MessageButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('メッセージボタンを表示する', () => {
    render(<MessageButton userId="user-1" />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('クリックで会話を作成しメッセージページへ遷移する', async () => {
    mockGetOrCreateConversation.mockResolvedValue({ success: true, data: { conversationId: 'conv-1' } })

    const user = userEvent.setup()
    render(<MessageButton userId="user-1" />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockGetOrCreateConversation).toHaveBeenCalledWith('user-1')
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/messages/conv-1')
    })
  })

  it('ブロック中はボタンが無効化される', () => {
    render(<MessageButton userId="user-1" isBlocked={true} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('ブロック中はaria-labelが変わる', () => {
    render(<MessageButton userId="user-1" isBlocked={true} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'メッセージを送れません')
  })

  it('通常時はaria-labelが「メッセージを送る」', () => {
    render(<MessageButton userId="user-1" isBlocked={false} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'メッセージを送る')
  })

  it('エラー時はエラーメッセージを表示する', async () => {
    mockGetOrCreateConversation.mockResolvedValue({ success: false, error: 'エラーが発生しました' })

    const user = userEvent.setup()
    render(<MessageButton userId="user-1" />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })

    expect(mockPush).not.toHaveBeenCalled()
  })
})
