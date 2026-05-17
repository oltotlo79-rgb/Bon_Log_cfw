import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { MessageForm } from '@/components/message/MessageForm'

// Next.js navigation モック
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// Server Actions モック
const mockSendMessage = vi.fn()
vi.mock('@/lib/actions/message', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}))

describe('MessageForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('メッセージ入力フォームを表示する', () => {
    render(<MessageForm conversationId="conv-1" />)
    expect(screen.getByPlaceholderText('メッセージを入力...')).toBeInTheDocument()
  })

  it('メッセージを入力できる', async () => {
    const user = userEvent.setup()
    render(<MessageForm conversationId="conv-1" />)

    const textarea = screen.getByPlaceholderText('メッセージを入力...')
    await user.type(textarea, 'こんにちは')

    expect(textarea).toHaveValue('こんにちは')
  })

  it('文字数カウントを表示する', async () => {
    const user = userEvent.setup()
    render(<MessageForm conversationId="conv-1" />)

    const textarea = screen.getByPlaceholderText('メッセージを入力...')
    await user.type(textarea, 'Hello')

    expect(screen.getByText('5/1000文字 | Ctrl+Enterで送信')).toBeInTheDocument()
  })

  it('空のメッセージは送信できない', () => {
    render(<MessageForm conversationId="conv-1" />)
    const submitButton = screen.getByRole('button')
    expect(submitButton).toBeDisabled()
  })

  it('メッセージを送信する', async () => {
    mockSendMessage.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<MessageForm conversationId="conv-1" />)

    const textarea = screen.getByPlaceholderText('メッセージを入力...')
    await user.type(textarea, 'テストメッセージ')
    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('conv-1', 'テストメッセージ')
    })

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('送信成功後にフォームがリセットされる', async () => {
    mockSendMessage.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<MessageForm conversationId="conv-1" />)

    const textarea = screen.getByPlaceholderText('メッセージを入力...')
    await user.type(textarea, 'テストメッセージ')
    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
  })

  it('エラー時はエラーメッセージを表示する', async () => {
    mockSendMessage.mockResolvedValue({ success: false, error: '送信に失敗しました' })

    const user = userEvent.setup()
    render(<MessageForm conversationId="conv-1" />)

    const textarea = screen.getByPlaceholderText('メッセージを入力...')
    await user.type(textarea, 'テストメッセージ')
    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('送信に失敗しました')).toBeInTheDocument()
    })
  })

  it('最大1000文字まで入力できる', () => {
    render(<MessageForm conversationId="conv-1" />)
    const textarea = screen.getByPlaceholderText('メッセージを入力...')
    expect(textarea).toHaveAttribute('maxLength', '1000')
  })
})
