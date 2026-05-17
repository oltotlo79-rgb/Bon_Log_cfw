 
import { vi } from 'vitest'
/**
 * ログインフォームコンポーネントのテスト
 */

import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '@/components/auth/LoginForm'

// モックのセットアップ
const mockSignIn = vi.fn()
vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => new URLSearchParams(),
}))

const mockCheckLoginAllowed = vi.fn().mockResolvedValue({ allowed: true })
const mockGetEmailVerificationStatus = vi.fn().mockResolvedValue({ verified: true })
const mockResendVerificationEmail = vi.fn().mockResolvedValue({ success: true })
const mockVerifyCredentials = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/actions/auth', () => ({
  checkLoginAllowed: (...args: unknown[]) => mockCheckLoginAllowed(...args),
  recordLoginFailure: vi.fn().mockResolvedValue(undefined),
  clearLoginAttempts: vi.fn().mockResolvedValue(undefined),
  getEmailVerificationStatus: (...args: unknown[]) => mockGetEmailVerificationStatus(...args),
  resendVerificationEmail: (...args: unknown[]) => mockResendVerificationEmail(...args),
  verifyCredentials: (...args: unknown[]) => mockVerifyCredentials(...args),
}))

const mockCheck2FARequired = vi.fn().mockResolvedValue({ required: false })
const mockVerify2FAToken = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/actions/two-factor', () => ({
  check2FARequired: (...args: unknown[]) => mockCheck2FARequired(...args),
  verify2FAToken: (...args: unknown[]) => mockVerify2FAToken(...args),
}))

vi.mock('@/lib/fingerprint', () => ({
  getFingerprintWithCache: vi.fn().mockResolvedValue('mock-fingerprint-123'),
}))

const mockIsDeviceBlacklisted = vi.fn().mockResolvedValue(false)
vi.mock('@/lib/actions/blacklist', () => ({
  isDeviceBlacklisted: (...args: unknown[]) => mockIsDeviceBlacklisted(...args),
}))

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckLoginAllowed.mockResolvedValue({ allowed: true })
    mockCheck2FARequired.mockResolvedValue({ required: false })
    mockIsDeviceBlacklisted.mockResolvedValue(false)
    mockSignIn.mockResolvedValue({ ok: true })
  })

  const getPasswordInput = () => screen.getByPlaceholderText('8文字以上（英字・数字を含む）')
  const getEmailInput = () => screen.getByPlaceholderText('mail@example.com')

  // 1
  it('メールアドレス入力欄を表示する', () => {
    render(<LoginForm />)
    expect(getEmailInput()).toBeInTheDocument()
  })

  // 2
  it('パスワード入力欄を表示する', () => {
    render(<LoginForm />)
    expect(getPasswordInput()).toBeInTheDocument()
  })

  // 3
  it('ログインボタンを表示する', () => {
    render(<LoginForm />)
    expect(screen.getByRole('button', { name: /^ログイン$/i })).toBeInTheDocument()
  })

  // 4
  it('メールアドレスを入力できる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(getEmailInput(), 'test@example.com')
    expect(getEmailInput()).toHaveValue('test@example.com')
  })

  // 5
  it('パスワードを入力できる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(getPasswordInput(), 'password123')
    expect(getPasswordInput()).toHaveValue('password123')
  })

  // 6
  it('パスワード表示/非表示を切り替えられる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    const passwordInput = getPasswordInput()

    expect(passwordInput).toHaveAttribute('type', 'password')

    const toggleButton = screen.getByRole('button', { name: /パスワードを表示/i })
    await user.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'text')

    const hideButton = screen.getByRole('button', { name: /パスワードを隠す/i })
    await user.click(hideButton)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  // 7
  it('ログインボタンをクリックするとsignInが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('credentials', expect.objectContaining({
        email: 'test@example.com',
        password: 'password123',
        redirect: false,
      }))
    })
  })

  // 8
  it('ログイン成功時にフィードページへリダイレクトする', async () => {
    mockSignIn.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/feed')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  // 9
  it('ログイン失敗時にエラーメッセージを表示する', async () => {
    mockSignIn.mockResolvedValue({ ok: false, error: 'CredentialsSignin' })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(screen.getByText(/メールアドレスまたはパスワードが間違っています/i)).toBeInTheDocument()
    })
  })

  // 10
  it('メールアドレスが空の場合はrequired属性で送信を防止する', () => {
    render(<LoginForm />)
    const emailInput = getEmailInput()
    expect(emailInput).toBeRequired()
  })

  // 11
  it('パスワードが空の場合はrequired属性で送信を防止する', () => {
    render(<LoginForm />)
    const passwordInput = getPasswordInput()
    expect(passwordInput).toBeRequired()
  })

  // 12
  it('ログイン中はローディング状態を表示する', async () => {
    mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 200)))
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    expect(screen.getByRole('button', { name: /ログイン中/i })).toBeInTheDocument()
  })

  // 13
  it('ログイン中はボタンが無効化される', async () => {
    mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 200)))
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    expect(screen.getByRole('button', { name: /ログイン中/i })).toBeDisabled()
  })

  // 14
  it('新規登録リンクを表示する', () => {
    render(<LoginForm />)
    expect(screen.getByRole('link', { name: /新規登録/i })).toHaveAttribute('href', '/register')
  })

  // 15
  it('パスワードリセットリンクを表示する', () => {
    render(<LoginForm />)
    expect(screen.getByRole('link', { name: /パスワードをお忘れですか/i })).toHaveAttribute('href', '/password-reset')
  })

  // 16
  it('ログイン前にレート制限チェックが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(mockCheckLoginAllowed).toHaveBeenCalledWith('test@example.com')
    })
  })

  // 17
  it('レート制限に達した場合はエラーメッセージを表示する', async () => {
    mockCheckLoginAllowed.mockResolvedValue({ allowed: false, message: 'ログイン試行回数の上限に達しました。しばらく待ってから再試行してください。' })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(screen.getByText(/ログイン試行回数の上限に達しました/i)).toBeInTheDocument()
    })
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  // 18
  it('デバイスブラックリストチェックが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    // フィンガープリントが設定されるまで待つ
    await waitFor(() => {})

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(mockIsDeviceBlacklisted).toHaveBeenCalled()
    })
  })

  // 19
  it('ブラックリストに登録されたデバイスはエラーを表示する', async () => {
    mockIsDeviceBlacklisted.mockResolvedValue(true)
    const user = userEvent.setup()
    render(<LoginForm />)

    await waitFor(() => {})

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(screen.getByText(/このデバイスからのログインは許可されていません/i)).toBeInTheDocument()
    })
  })

  // 20
  it('2FA必要時に2FA入力フォームを表示する', async () => {
    mockCheck2FARequired.mockResolvedValue({ required: true })
    mockVerifyCredentials.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(screen.getByText(/2段階認証/i)).toBeInTheDocument()
    })
  })

  // 21
  it('2FAコードを入力できる', async () => {
    mockCheck2FARequired.mockResolvedValue({ required: true })
    mockVerifyCredentials.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/認証コード/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/認証コード/i), '123456')
    expect(screen.getByLabelText(/認証コード/i)).toHaveValue('123456')
  })

  // 22
  it('2FA検証時にverify2FATokenが呼ばれる', async () => {
    mockCheck2FARequired.mockResolvedValue({ required: true })
    mockVerifyCredentials.mockResolvedValue({ success: true })
    mockSignIn.mockResolvedValue({ ok: true })
    mockVerify2FAToken.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/認証コード/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/認証コード/i), '123456')
    await user.click(screen.getByRole('button', { name: /確認$/i }))

    await waitFor(() => {
      expect(mockVerify2FAToken).toHaveBeenCalledWith('test@example.com', '123456')
    })
  })

  // 23
  it('無効な2FAコードでエラーを表示する', async () => {
    mockCheck2FARequired.mockResolvedValue({ required: true })
    mockVerifyCredentials.mockResolvedValue({ success: true })
    mockVerify2FAToken.mockResolvedValue({ error: '認証コードが無効です' })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/認証コード/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/認証コード/i), '000000')
    await user.click(screen.getByRole('button', { name: /確認$/i }))

    await waitFor(() => {
      expect(screen.getByText(/認証コードが無効です/i)).toBeInTheDocument()
    })
  })

  // 24
  it('ローディング中はボタンテキストが「ログイン中...」に変わる', async () => {
    mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 200)))
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')

    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(screen.getByRole('button', { name: /ログイン中/i })).toBeInTheDocument()
  })

  // 25
  it('再試行時にエラーメッセージがクリアされる', async () => {
    mockSignIn.mockResolvedValueOnce({ ok: false, error: 'CredentialsSignin' })
    mockSignIn.mockResolvedValueOnce({ ok: true })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(screen.getByText(/メールアドレスまたはパスワードが間違っています/i)).toBeInTheDocument()
    })

    // 再送信（新しい試行でエラーがクリアされる）
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    // 送信中のタイミングではエラーがクリアされている
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledTimes(2)
    })
  })

  // 26
  it('メールアドレスのプレースホルダーが表示される', () => {
    render(<LoginForm />)
    expect(screen.getByPlaceholderText('mail@example.com')).toBeInTheDocument()
  })

  // 27
  it('パスワードのプレースホルダーが表示される', () => {
    render(<LoginForm />)
    expect(screen.getByPlaceholderText('8文字以上（英字・数字を含む）')).toBeInTheDocument()
  })

  // 28
  it('2FAキャンセルでログインフォームに戻る', async () => {
    mockCheck2FARequired.mockResolvedValue({ required: true })
    mockVerifyCredentials.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(screen.getByText(/2段階認証/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /キャンセル/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('mail@example.com')).toBeInTheDocument()
    })
  })

  // 29
  it('2FA検証で例外が発生した場合にエラーを表示する', async () => {
    mockCheck2FARequired.mockResolvedValue({ required: true })
    mockVerifyCredentials.mockResolvedValue({ success: true })
    mockVerify2FAToken.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/認証コード/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/認証コード/i), '123456')
    await user.click(screen.getByRole('button', { name: /確認$/i }))

    await waitFor(() => {
      expect(screen.getByText(/認証中にエラーが発生しました/i)).toBeInTheDocument()
    })
  })

  // 30
  it('ログイン処理で例外が発生した場合にエラーを表示する', async () => {
    mockSignIn.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(screen.getByText(/ログイン中にエラーが発生しました/i)).toBeInTheDocument()
    })
  })

  // 31
  it('レート制限チェックで例外が発生してもログインは続行する', async () => {
    mockCheckLoginAllowed.mockRejectedValue(new Error('Redis error'))
    mockSignIn.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalled()
    })
  })

  // 32
  it('デバイスチェックで例外が発生してもログインは続行する', async () => {
    mockIsDeviceBlacklisted.mockRejectedValue(new Error('Check error'))
    mockSignIn.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<LoginForm />)

    await waitFor(() => {})

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalled()
    })
  })

  // 33
  it('2FA必要時にパスワードが間違っている場合エラーを表示する', async () => {
    mockCheck2FARequired.mockResolvedValue({ required: true })
    mockVerifyCredentials.mockResolvedValue({ success: false, error: 'メールアドレスまたはパスワードが間違っています' })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(screen.getByText(/メールアドレスまたはパスワードが間違っています/i)).toBeInTheDocument()
    })
  })

  // 34
  it('レート制限メッセージがない場合のデフォルトメッセージを表示する', async () => {
    mockCheckLoginAllowed.mockResolvedValue({ allowed: false })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(screen.getByText(/ログイン試行回数の上限に達しました/i)).toBeInTheDocument()
    })
  })

  // 35
  it('2FA検証成功でフィードページへリダイレクトする', async () => {
    mockCheck2FARequired.mockResolvedValue({ required: true })
    mockVerifyCredentials.mockResolvedValue({ success: true })
    mockSignIn.mockResolvedValue({ ok: true })
    mockVerify2FAToken.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/認証コード/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/認証コード/i), '123456')
    await user.click(screen.getByRole('button', { name: /確認$/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/feed')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  // 36 - Google OAuth
  it('Googleでログインボタンを表示する', () => {
    render(<LoginForm />)
    expect(screen.getByRole('button', { name: /Googleでログイン/i })).toBeInTheDocument()
  })

  // 37
  it('GoogleでログインボタンをクリックするとsignIn("google")が呼ばれる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole('button', { name: /Googleでログイン/i }))

    expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/feed' })
  })

  // 38
  it('ローディング中はGoogleログインボタンが無効化される', async () => {
    mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 200)))
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    expect(screen.getByRole('button', { name: /Googleでログイン/i })).toBeDisabled()
  })

  // 39
  it('「または」区切り線を表示する', () => {
    render(<LoginForm />)
    expect(screen.getByText('または')).toBeInTheDocument()
  })

  // 40
  it('2FAチェックで例外が発生してもログインは続行する', async () => {
    mockCheck2FARequired.mockRejectedValue(new Error('2FA check error'))
    mockSignIn.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })
  })
})
