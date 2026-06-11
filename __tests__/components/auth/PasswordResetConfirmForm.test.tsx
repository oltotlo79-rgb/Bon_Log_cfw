import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PasswordResetConfirmForm } from '@/components/auth/PasswordResetConfirmForm'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

// Next.js navigation モック
const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}))

// Server Actionモック
const mockResetPassword = vi.fn()
const mockVerifyPasswordResetToken = vi.fn()
vi.mock('@/lib/actions/auth', () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  verifyPasswordResetToken: (...args: unknown[]) => mockVerifyPasswordResetToken(...args),
}))

describe('PasswordResetConfirmForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.set('token', 'valid-token')
    mockSearchParams.set('email', 'test@example.com')
  })

  afterEach(() => {
    mockSearchParams.delete('token')
    mockSearchParams.delete('email')
  })

  // ヘルパー関数
  const getPasswordInput = () => screen.getByPlaceholderText('8文字以上（英字・数字を含む）')
  const getConfirmPasswordInput = () => screen.getByPlaceholderText('もう一度入力')

  it('検証中はローディング表示をする', () => {
    mockVerifyPasswordResetToken.mockImplementation(() => new Promise<{ success: true; data: { valid: boolean } }>(() => {})) // 解決しないPromise
    render(<PasswordResetConfirmForm />)
    expect(screen.getByText(/リンクを検証中/i)).toBeInTheDocument()
  })

  it('トークンが有効な場合フォームを表示する', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ success: true, data: { valid: true } })

    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(screen.getByText(/新しいパスワードを入力してください/i)).toBeInTheDocument()
    })
    expect(getPasswordInput()).toBeInTheDocument()
    expect(getConfirmPasswordInput()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /パスワードを更新/i })).toBeInTheDocument()
  })

  it('トークンが無効な場合エラーメッセージを表示する', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ success: true, data: { valid: false } })

    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(screen.getByText(/リンクが無効です/i)).toBeInTheDocument()
      expect(screen.getByText(/リセットリンクが無効または期限切れです/i)).toBeInTheDocument()
    })
  })

  it('トークンがない場合エラーメッセージを表示する', async () => {
    mockSearchParams.delete('token')

    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(screen.getByText(/リンクが無効です/i)).toBeInTheDocument()
    })
  })

  it('メールアドレスがない場合エラーメッセージを表示する', async () => {
    mockSearchParams.delete('email')

    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(screen.getByText(/リンクが無効です/i)).toBeInTheDocument()
    })
  })

  it('パスワードを入力できる', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ success: true, data: { valid: true } })

    const user = userEvent.setup()
    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(getPasswordInput()).toBeInTheDocument()
    })

    await user.type(getPasswordInput(), 'newpassword123')
    expect(getPasswordInput()).toHaveValue('newpassword123')
  })

  it('パスワードが一致しない場合エラーを表示する', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ success: true, data: { valid: true } })

    const user = userEvent.setup()
    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(getPasswordInput()).toBeInTheDocument()
    })

    await user.type(getPasswordInput(), 'password123')
    await user.type(getConfirmPasswordInput(), 'differentpassword')
    await user.click(screen.getByRole('button', { name: /パスワードを更新/i }))

    await waitFor(() => {
      expect(screen.getByText(/パスワードが一致しません/i)).toBeInTheDocument()
    })
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('パスワードが8文字未満の場合エラーを表示する', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ success: true, data: { valid: true } })

    const user = userEvent.setup()
    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(getPasswordInput()).toBeInTheDocument()
    })

    await user.type(getPasswordInput(), 'pass1')
    await user.type(getConfirmPasswordInput(), 'pass1')
    await user.click(screen.getByRole('button', { name: /パスワードを更新/i }))

    await waitFor(() => {
      expect(screen.getByText(/パスワードは8文字以上で入力してください/i)).toBeInTheDocument()
    })
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('パスワードに英字がない場合エラーを表示する', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ success: true, data: { valid: true } })

    const user = userEvent.setup()
    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(getPasswordInput()).toBeInTheDocument()
    })

    await user.type(getPasswordInput(), '12345678')
    await user.type(getConfirmPasswordInput(), '12345678')
    await user.click(screen.getByRole('button', { name: /パスワードを更新/i }))

    await waitFor(() => {
      expect(screen.getByText(/パスワードはアルファベットを含めてください/i)).toBeInTheDocument()
    })
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('パスワードに数字がない場合エラーを表示する', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ success: true, data: { valid: true } })

    const user = userEvent.setup()
    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(getPasswordInput()).toBeInTheDocument()
    })

    await user.type(getPasswordInput(), 'abcdefgh')
    await user.type(getConfirmPasswordInput(), 'abcdefgh')
    await user.click(screen.getByRole('button', { name: /パスワードを更新/i }))

    await waitFor(() => {
      expect(screen.getByText(/パスワードは数字を含めてください/i)).toBeInTheDocument()
    })
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('パスワードリセット成功時に成功メッセージを表示する', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ success: true, data: { valid: true } })
    mockResetPassword.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(getPasswordInput()).toBeInTheDocument()
    })

    await user.type(getPasswordInput(), 'newpassword123')
    await user.type(getConfirmPasswordInput(), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /パスワードを更新/i }))

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        token: 'valid-token',
        newPassword: 'newpassword123',
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/パスワードを更新しました/i)).toBeInTheDocument()
      expect(screen.getByText(/新しいパスワードでログインできます/i)).toBeInTheDocument()
    })
  })

  it('APIがエラーを返した場合エラーメッセージを表示する', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ success: true, data: { valid: true } })
    mockResetPassword.mockResolvedValue({ error: 'トークンが無効です' })

    const user = userEvent.setup()
    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(getPasswordInput()).toBeInTheDocument()
    })

    await user.type(getPasswordInput(), 'newpassword123')
    await user.type(getConfirmPasswordInput(), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /パスワードを更新/i }))

    await waitFor(() => {
      expect(screen.getByText(/トークンが無効です/i)).toBeInTheDocument()
    })
  })

  it('更新中はボタンが無効化される', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ success: true, data: { valid: true } })
    mockResetPassword.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)))

    const user = userEvent.setup()
    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(getPasswordInput()).toBeInTheDocument()
    })

    await user.type(getPasswordInput(), 'newpassword123')
    await user.type(getConfirmPasswordInput(), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /パスワードを更新/i }))

    expect(screen.getByRole('button', { name: /更新中/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /更新中/i })).toBeDisabled()
  })

  it('パスワード表示/非表示を切り替えられる', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ success: true, data: { valid: true } })

    const user = userEvent.setup()
    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(getPasswordInput()).toBeInTheDocument()
    })

    const passwordInput = getPasswordInput()
    expect(passwordInput).toHaveAttribute('type', 'password')

    const toggleButton = screen.getAllByRole('button', { name: /パスワードを表示/i })[0]!
    await user.click(toggleButton)

    expect(passwordInput).toHaveAttribute('type', 'text')

    const hideButton = screen.getAllByRole('button', { name: /パスワードを隠す/i })[0]!
    await user.click(hideButton)

    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('無効なトークン時にパスワードリセット再リクエストリンクを表示する', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ success: true, data: { valid: false } })

    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /パスワードリセットを再度リクエスト/i })).toHaveAttribute('href', '/password-reset')
    })
  })

  it('ログインページへのリンクを表示する', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ success: true, data: { valid: true } })

    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /ログインページへ戻る/i })).toHaveAttribute('href', '/login')
    })
  })

  it('成功時に今すぐログインリンクを表示する', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ success: true, data: { valid: true } })
    mockResetPassword.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<PasswordResetConfirmForm />)

    await waitFor(() => {
      expect(getPasswordInput()).toBeInTheDocument()
    })

    await user.type(getPasswordInput(), 'newpassword123')
    await user.type(getConfirmPasswordInput(), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /パスワードを更新/i }))

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /今すぐログインする/i })).toHaveAttribute('href', '/login')
    })
  })
})
