/**
 * LoginForm - 未カバー分岐のテスト（統合フロー版）
 *
 * verifyCredentials が success/2FA/各種エラーを返すケースと、確認メール再送・2FA 入力の分岐を網羅する。
 */

import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '@/components/auth/LoginForm'
import { ERR_EMAIL_NOT_VERIFIED } from '@/lib/constants/errors'
import { MSG_ERROR_FALLBACK, MSG_VERIFICATION_EMAIL_RESENT } from '@/lib/constants/messages'

const mockSignIn = vi.fn()
vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(),
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

describe('LoginForm - 未カバー分岐', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyCredentials.mockResolvedValue(okNo2FA)
    mockVerify2FAToken.mockResolvedValue({ success: true, data: { ticket: 'ticket-1' } })
    mockSignIn.mockResolvedValue({ ok: true })
    mockResendVerificationEmail.mockResolvedValue({ success: true })
  })

  const getPasswordInput = () => screen.getByPlaceholderText('8文字以上（英字・数字を含む）')
  const getEmailInput = () => screen.getByPlaceholderText('mail@example.com')

  async function fillAndSubmitLogin(user: ReturnType<typeof userEvent.setup>) {
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.click(screen.getByRole('button', { name: /^ログイン$/i }))
  }

  it('未確認メールの場合、確認メール再送ボタンを表示する', async () => {
    mockVerifyCredentials.mockResolvedValue({ success: false, error: ERR_EMAIL_NOT_VERIFIED })
    const user = userEvent.setup()
    render(<LoginForm />)
    await fillAndSubmitLogin(user)
    await waitFor(() => {
      expect(screen.getByText(/メールアドレスがまだ確認されていません/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /確認メールを再送する/ })).toBeInTheDocument()
    })
  })

  it('2FA入力中にキャンセルするとログインフォームに戻る', async () => {
    mockVerifyCredentials.mockResolvedValue(ok2FA)
    const user = userEvent.setup()
    render(<LoginForm />)
    await fillAndSubmitLogin(user)
    await waitFor(() => {
      expect(screen.getByText(/2段階認証/i)).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /キャンセル/i }))
    await waitFor(() => {
      expect(getEmailInput()).toBeInTheDocument()
    })
  })

  it('確認メール再送が成功した場合、成功メッセージを表示し再送ボタンを消す', async () => {
    mockVerifyCredentials.mockResolvedValue({ success: false, error: ERR_EMAIL_NOT_VERIFIED })
    mockResendVerificationEmail.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<LoginForm />)
    await fillAndSubmitLogin(user)
    const resendButton = await screen.findByRole('button', { name: /確認メールを再送する/ })
    await user.click(resendButton)
    await waitFor(() => {
      expect(screen.getByText(MSG_VERIFICATION_EMAIL_RESENT)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /確認メールを再送する/ })).not.toBeInTheDocument()
    expect(mockResendVerificationEmail).toHaveBeenCalledTimes(1)
  })

  it('確認メール再送が失敗した場合、エラーメッセージを表示する', async () => {
    mockVerifyCredentials.mockResolvedValue({ success: false, error: ERR_EMAIL_NOT_VERIFIED })
    mockResendVerificationEmail.mockResolvedValue({ success: false, error: '送信に失敗しました' })
    const user = userEvent.setup()
    render(<LoginForm />)
    await fillAndSubmitLogin(user)
    const resendButton = await screen.findByRole('button', { name: /確認メールを再送する/ })
    await user.click(resendButton)
    await waitFor(() => {
      expect(screen.getByText('送信に失敗しました')).toBeInTheDocument()
    })
  })

  it('確認メール再送レスポンスにerrorフィールドがない場合、フォールバックメッセージを表示する', async () => {
    mockVerifyCredentials.mockResolvedValue({ success: false, error: ERR_EMAIL_NOT_VERIFIED })
    mockResendVerificationEmail.mockResolvedValue({ success: false })
    const user = userEvent.setup()
    render(<LoginForm />)
    await fillAndSubmitLogin(user)
    const resendButton = await screen.findByRole('button', { name: /確認メールを再送する/ })
    await user.click(resendButton)
    await waitFor(() => {
      expect(screen.getByText(MSG_ERROR_FALLBACK)).toBeInTheDocument()
    })
  })

  it('Googleでログインクリック時にローディング状態を設定する', async () => {
    mockSignIn.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.click(screen.getByRole('button', { name: /Googleでログイン/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ログイン中/i })).toBeDisabled()
    })
  })

  it('2FAコード入力が大文字に変換される', async () => {
    mockVerifyCredentials.mockResolvedValue(ok2FA)
    const user = userEvent.setup()
    render(<LoginForm />)
    await fillAndSubmitLogin(user)
    const codeInput = await screen.findByLabelText(/認証コード/i)
    await user.type(codeInput, 'abcdef')
    expect(codeInput).toHaveValue('ABCDEF')
  })

  it('2FA確認ボタンはコード未入力時に無効', async () => {
    mockVerifyCredentials.mockResolvedValue(ok2FA)
    const user = userEvent.setup()
    render(<LoginForm />)
    await fillAndSubmitLogin(user)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /確認$/i })).toBeDisabled()
    })
  })
})
