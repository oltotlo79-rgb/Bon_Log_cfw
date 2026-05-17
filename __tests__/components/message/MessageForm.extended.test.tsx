import { vi } from 'vitest'
/**
 * MessageForm コンポーネントの拡張テスト
 */
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import React from 'react'

// Prismaモック
vi.mock('@/lib/db', () => ({ prisma: {} }))

// メッセージアクションモック
const mockSendMessage = vi.fn()
vi.mock('@/lib/actions/message', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}))

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { MessageForm } from '@/components/message/MessageForm'

describe('MessageForm 拡張テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('空のメッセージは送信できない', async () => {
    render(<MessageForm conversationId="conv-1" />)

    const submitButton = screen.getByRole('button', { name: '送信' })
    expect(submitButton).toBeDisabled()
  })

  it('メッセージ入力後に送信ボタンが有効になる', async () => {
    const user = userEvent.setup()
    render(<MessageForm conversationId="conv-1" />)

    const input = screen.getByPlaceholderText(/メッセージを入力/i)
    await user.type(input, 'テストメッセージ')

    const submitButton = screen.getByRole('button')
    expect(submitButton).not.toBeDisabled()
  })

  it('メッセージ送信が成功するとフォームがクリアされる', async () => {
    mockSendMessage.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<MessageForm conversationId="conv-1" />)

    const input = screen.getByPlaceholderText(/メッセージを入力/i)
    await user.type(input, 'テストメッセージ')

    const submitButton = screen.getByRole('button')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('conv-1', 'テストメッセージ')
    })

    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })

  it('メッセージ送信が失敗してもクラッシュしない', async () => {
    mockSendMessage.mockResolvedValue({ success: false, error: '送信に失敗しました' })

    const user = userEvent.setup()
    render(<MessageForm conversationId="conv-1" />)

    const input = screen.getByPlaceholderText(/メッセージを入力/i)
    await user.type(input, 'テストメッセージ')

    const submitButton = screen.getByRole('button')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalled()
    })

    // エラーが発生してもUIは維持される
    expect(screen.getByPlaceholderText(/メッセージを入力/i)).toBeInTheDocument()
  })

  it('Ctrl+Enterで送信できる', async () => {
    mockSendMessage.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<MessageForm conversationId="conv-1" />)

    const input = screen.getByPlaceholderText(/メッセージを入力/i)
    await user.type(input, 'テストメッセージ')
    await user.keyboard('{Control>}{Enter}{/Control}')

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('conv-1', 'テストメッセージ')
    })
  })

  it('通常のEnterは改行として扱われる', async () => {
    const user = userEvent.setup()
    render(<MessageForm conversationId="conv-1" />)

    const input = screen.getByPlaceholderText(/メッセージを入力/i)
    await user.type(input, '1行目{enter}2行目')

    // 送信されていないことを確認（Enterだけでは送信されない）
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('送信中は入力が無効化される', async () => {
    mockSendMessage.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
    )

    const user = userEvent.setup()
    render(<MessageForm conversationId="conv-1" />)

    const input = screen.getByPlaceholderText(/メッセージを入力/i)
    await user.type(input, 'テストメッセージ')

    const submitButton = screen.getByRole('button')
    await user.click(submitButton)

    // テキストエリアが無効化されていることを確認
    expect(input).toBeDisabled()

    await waitFor(() => {
      expect(input).not.toBeDisabled()
    })
  })

  it('スペースのみのメッセージは送信できない', async () => {
    const user = userEvent.setup()
    render(<MessageForm conversationId="conv-1" />)

    const input = screen.getByPlaceholderText(/メッセージを入力/i)
    await user.type(input, '   ')

    const submitButton = screen.getByRole('button')
    expect(submitButton).toBeDisabled()
  })

  it('文字数カウントが表示される', async () => {
    const user = userEvent.setup()
    render(<MessageForm conversationId="conv-1" />)

    expect(screen.getByText(/0\/1000文字/)).toBeInTheDocument()

    const input = screen.getByPlaceholderText(/メッセージを入力/i)
    await user.type(input, 'テスト')

    // テスト = 3文字
    expect(screen.getByText(/3\/1000文字/)).toBeInTheDocument()
  })
})
