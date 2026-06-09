import { vi } from 'vitest'
/**
 * ログインフォームコンポーネントのテスト。
 *
 * 統合後のフロー: クライアントは `verifyCredentials(email, password, fingerprint)` を 1 回呼ぶだけで
 * ロックアウト/デバイス/パスワード/2FA 判定を受け取る。2FA 不要時のみ `signIn` でセッションを発行する。
 */

import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '@/components/auth/LoginForm'
import {
  ERR_EMAIL_NOT_VERIFIED,
  ERR_LOGIN_INVALID_CREDENTIALS,
} from '@/lib/constants/errors'

const mockSignIn = vi.fn()
vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

const mockPush = vi.fn()
const mockRefresh = vi.fn()
let mockSearchParamsValue = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => mockSearchParamsValue,
}))

const mockResendVerificationEmail = vi.fn().mockResolvedValue({ success: true })
const mockVerifyCredentials = vi.fn()
vi.mock('@/lib/actions/auth', () => ({
  resendVerificationEmail: (...args: unknown[]) => mockResendVerificationEmail(...args),
  verifyCredentials: (...args: unknown[]) => mockVerifyCredentials(...args),
}))

const mockVerify2FAToken = vi.fn().mockResolvedValue({ success: true, data: { ticket: 'ticket-1' } })
vi.mock('@/lib/actions/two-factor', () => ({
  verify2FAToken: (...args: unknown[]) => mockVerify2FAToken(...args),
}))

vi.mock('@/lib/fingerprint', () => ({
  getFingerprintWithCache: vi.fn().mockResolvedValue('mock-fingerprint-123'),
}))

const ok2FA = { success: true, data: { twoFactorRequired: true } }
const okNo2FA = { success: true, data: { twoFactorRequired: false } }

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyCredentials.mockResolvedValue(okNo2FA)
    mockVerify2FAToken.mockResolvedValue({ success: true, data: { ticket: 'ticket-1' } })
    mockSignIn.mockResolvedValue({ ok: true })
    mockResendVerificationEmail.mockResolvedValue({ success: true })
  })

  const getPasswordInput = () => screen.getByPlaceholderText('8文字以上（英字・数字を含む）')
  const getEmailInput = () => screen.getByPlaceholderText('mail@example.com')

  async function submitLogin(email = 'test@example.com', password = 'password123') {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(getEmailInput(), email)
    await user.type(getPasswordInput(), password)
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))
    return user
  }

  // --- 描画 ---
  it('メールアドレス入力欄を表示する', () => {
    render(<LoginForm />)
    expect(getEmailInput()).toBeInTheDocument()
  })

  it('パスワード入力欄を表示する', () => {
    render(<LoginForm />)
    expect(getPasswordInput()).toBeInTheDocument()
  })

  it('ログインボタンを表示する', () => {
    render(<LoginForm />)
    expect(screen.getByRole('button', { name: /^ログイン$/i })).toBeInTheDocument()
  })

  it('メールアドレスを入力できる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(getEmailInput(), 'test@example.com')
    expect(getEmailInput()).toHaveValue('test@example.com')
  })

  it('パスワードを入力できる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(getPasswordInput(), 'password123')
    expect(getPasswordInput()).toHaveValue('password123')
  })

  it('パスワード表示/非表示を切り替えられる', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    const passwordInput = getPasswordInput()
    expect(passwordInput).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: /パスワードを表示/i }))
    expect(passwordInput).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: /パスワードを隠す/i }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('required属性で空送信を防止する', () => {
    render(<LoginForm />)
    expect(getEmailInput()).toBeRequired()
    expect(getPasswordInput()).toBeRequired()
  })

  it('新規登録 / パスワードリセットリンクを表示する', () => {
    render(<LoginForm />)
    expect(screen.getByRole('link', { name: /新規登録/i })).toHaveAttribute('href', '/register')
    expect(screen.getByRole('link', { name: /パスワードをお忘れですか/i })).toHaveAttribute('href', '/password-reset')
  })

  // --- 認証フロー ---
  it('送信時に verifyCredentials が email/password で呼ばれる', async () => {
    await submitLogin()
    await waitFor(() => {
      expect(mockVerifyCredentials).toHaveBeenCalledWith('test@example.com', 'password123', expect.anything())
    })
  })

  it('2FA 不要で成功するとフィードへ遷移する', async () => {
    await submitLogin()
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('credentials', expect.objectContaining({
        email: 'test@example.com',
        password: 'password123',
        redirect: false,
      }))
      expect(mockPush).toHaveBeenCalledWith('/feed')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('verifyCredentials が無効資格情報を返すとエラーを表示し signIn を呼ばない', async () => {
    mockVerifyCredentials.mockResolvedValue({ success: false, error: ERR_LOGIN_INVALID_CREDENTIALS })
    await submitLogin('test@example.com', 'wrongpassword')
    await waitFor(() => {
      expect(screen.getByText(/メールアドレスまたはパスワードが間違っています/i)).toBeInTheDocument()
    })
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('ロックアウト時はサーバーのメッセージを表示し signIn を呼ばない', async () => {
    mockVerifyCredentials.mockResolvedValue({
      success: false,
      error: 'ログイン試行回数の上限に達しました。30分後に再試行してください。',
    })
    await submitLogin()
    await waitFor(() => {
      expect(screen.getByText(/ログイン試行回数の上限に達しました/i)).toBeInTheDocument()
    })
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('デバイスブロック時はサーバーのメッセージを表示する', async () => {
    mockVerifyCredentials.mockResolvedValue({
      success: false,
      error: 'このデバイスからのログインは許可されていません',
    })
    await submitLogin()
    await waitFor(() => {
      expect(screen.getByText(/このデバイスからのログインは許可されていません/i)).toBeInTheDocument()
    })
  })

  it('メール未確認時はエラーと再送ボタンを表示する', async () => {
    mockVerifyCredentials.mockResolvedValue({ success: false, error: ERR_EMAIL_NOT_VERIFIED })
    await submitLogin()
    await waitFor(() => {
      expect(screen.getByText(/メールアドレスがまだ確認されていません/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /確認メールを再送する/i })).toBeInTheDocument()
    })
  })

  it('確認メール再送ボタンで resendVerificationEmail を呼ぶ', async () => {
    mockVerifyCredentials.mockResolvedValue({ success: false, error: ERR_EMAIL_NOT_VERIFIED })
    const user = await submitLogin()
    const resendButton = await screen.findByRole('button', { name: /確認メールを再送する/i })
    await user.click(resendButton)
    await waitFor(() => {
      expect(mockResendVerificationEmail).toHaveBeenCalledWith('test@example.com')
    })
  })

  it('signIn がエラーを返すと無効資格情報メッセージを表示する', async () => {
    mockSignIn.mockResolvedValue({ ok: false, error: 'CredentialsSignin' })
    await submitLogin()
    await waitFor(() => {
      expect(screen.getByText(/メールアドレスまたはパスワードが間違っています/i)).toBeInTheDocument()
    })
  })

  it('verifyCredentials が例外を投げるとログインエラーを表示する', async () => {
    mockVerifyCredentials.mockRejectedValue(new Error('Network error'))
    await submitLogin()
    await waitFor(() => {
      expect(screen.getByText(/ログイン中にエラーが発生しました/i)).toBeInTheDocument()
    })
  })

  // --- 2FA ---
  it('2FA 必要時に2FA入力フォームを表示する', async () => {
    mockVerifyCredentials.mockResolvedValue(ok2FA)
    await submitLogin()
    await waitFor(() => {
      expect(screen.getByText(/2段階認証/i)).toBeInTheDocument()
    })
  })

  it('2FAコードを入力できる', async () => {
    mockVerifyCredentials.mockResolvedValue(ok2FA)
    const user = await submitLogin()
    const codeInput = await screen.findByLabelText(/認証コード/i)
    await user.type(codeInput, '123456')
    expect(codeInput).toHaveValue('123456')
  })

  it('2FA検証時にverify2FATokenが呼ばれ、成功でフィードへ遷移する', async () => {
    mockVerifyCredentials.mockResolvedValue(ok2FA)
    const user = await submitLogin()
    const codeInput = await screen.findByLabelText(/認証コード/i)
    await user.type(codeInput, '123456')
    await user.click(screen.getByRole('button', { name: /確認$/i }))
    await waitFor(() => {
      expect(mockVerify2FAToken).toHaveBeenCalledWith('test@example.com', '123456')
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })
  })

  it('無効な2FAコードでエラーを表示する', async () => {
    mockVerifyCredentials.mockResolvedValue(ok2FA)
    mockVerify2FAToken.mockResolvedValue({ error: '認証コードが無効です' })
    const user = await submitLogin()
    const codeInput = await screen.findByLabelText(/認証コード/i)
    await user.type(codeInput, '000000')
    await user.click(screen.getByRole('button', { name: /確認$/i }))
    await waitFor(() => {
      expect(screen.getByText(/認証コードが無効です/i)).toBeInTheDocument()
    })
  })

  it('2FAキャンセルでログインフォームに戻る', async () => {
    mockVerifyCredentials.mockResolvedValue(ok2FA)
    const user = await submitLogin()
    await screen.findByLabelText(/認証コード/i)
    await user.click(screen.getByRole('button', { name: /キャンセル/i }))
    await waitFor(() => {
      expect(getEmailInput()).toBeInTheDocument()
    })
  })

  it('2FA検証で例外が発生した場合にエラーを表示する', async () => {
    mockVerifyCredentials.mockResolvedValue(ok2FA)
    mockVerify2FAToken.mockRejectedValue(new Error('Network error'))
    const user = await submitLogin()
    const codeInput = await screen.findByLabelText(/認証コード/i)
    await user.type(codeInput, '123456')
    await user.click(screen.getByRole('button', { name: /確認$/i }))
    await waitFor(() => {
      expect(screen.getByText(/認証中にエラーが発生しました/i)).toBeInTheDocument()
    })
  })

  // --- ローディング ---
  it('ログイン中はボタンが「ログイン中...」になり無効化される', async () => {
    mockVerifyCredentials.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(okNo2FA), 200)))
    await submitLogin()
    const loadingButton = screen.getByRole('button', { name: /ログイン中/i })
    expect(loadingButton).toBeInTheDocument()
    expect(loadingButton).toBeDisabled()
  })

  // --- Google OAuth ---
  it('Googleでログインボタンを表示しクリックでsignIn("google")を呼ぶ', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    const googleButton = screen.getByRole('button', { name: /Googleでログイン/i })
    expect(googleButton).toBeInTheDocument()
    await user.click(googleButton)
    expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/feed' })
  })

  it('「または」区切り線を表示する', () => {
    render(<LoginForm />)
    expect(screen.getByText('または')).toBeInTheDocument()
  })

  // --- callbackUrl セキュリティ ---
  describe('callbackUrl の open redirect 防止', () => {
    beforeEach(() => {
      mockSearchParamsValue = new URLSearchParams()
    })

    it('callbackUrl が内部相対パス（/feed）の場合はそこへ遷移する', async () => {
      mockSearchParamsValue = new URLSearchParams('callbackUrl=/feed')

      const user = userEvent.setup()
      render(<LoginForm />)
      await user.type(getEmailInput(), 'test@example.com')
      await user.type(getPasswordInput(), 'password123')
      await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/feed')
      })
    })

    it('callbackUrl が // で始まる場合は ROUTE_FEED へフォールバックする', async () => {
      mockSearchParamsValue = new URLSearchParams('callbackUrl=//evil.com')

      const user = userEvent.setup()
      render(<LoginForm />)
      await user.type(getEmailInput(), 'test@example.com')
      await user.type(getPasswordInput(), 'password123')
      await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/feed')
      })
    })

    it('callbackUrl が https:// から始まる外部 URL の場合は ROUTE_FEED へフォールバックする', async () => {
      mockSearchParamsValue = new URLSearchParams('callbackUrl=https://evil.com')

      const user = userEvent.setup()
      render(<LoginForm />)
      await user.type(getEmailInput(), 'test@example.com')
      await user.type(getPasswordInput(), 'password123')
      await user.click(screen.getByRole('button', { name: /^ログイン$/i }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/feed')
      })
    })

    it('callbackUrl がない場合は ROUTE_FEED へ遷移する', async () => {
      mockSearchParamsValue = new URLSearchParams()

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
})
