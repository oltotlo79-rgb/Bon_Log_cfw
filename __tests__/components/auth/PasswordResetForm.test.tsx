import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PasswordResetForm } from '@/components/auth/PasswordResetForm'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

// Server Actionモック
const mockRequestPasswordReset = vi.fn()
vi.mock('@/lib/actions/auth', () => ({
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
}))

describe('PasswordResetForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ヘルパー関数
  const getEmailInput = () => screen.getByPlaceholderText('mail@example.com')
  const getSubmitButton = () => screen.getByRole('button', { name: /リセットメールを送信/i })

  it('パスワードリセットフォームを表示する', () => {
    render(<PasswordResetForm />)
    expect(screen.getByText(/登録したメールアドレスを入力してください/i)).toBeInTheDocument()
    expect(getEmailInput()).toBeInTheDocument()
    expect(getSubmitButton()).toBeInTheDocument()
  })

  it('メールアドレスを入力できる', async () => {
    const user = userEvent.setup()
    render(<PasswordResetForm />)
    const emailInput = getEmailInput()
    await user.type(emailInput, 'test@example.com')
    expect(emailInput).toHaveValue('test@example.com')
  })

  it('メールアドレスが空の場合エラーを表示する', async () => {
    const user = userEvent.setup()
    render(<PasswordResetForm />)

    // フォームを送信（HTML5バリデーションをスキップするためにフォーカスを外す）
    const emailInput = getEmailInput()
    await user.clear(emailInput)
    await user.click(getSubmitButton())

    // HTML5 required属性のため送信されない
    expect(mockRequestPasswordReset).not.toHaveBeenCalled()
  })

  it('リセットメール送信成功時に成功メッセージを表示する', async () => {
    mockRequestPasswordReset.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<PasswordResetForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('test@example.com')
    })

    await waitFor(() => {
      expect(screen.getByText(/メールを送信しました/i)).toBeInTheDocument()
      expect(screen.getByText(/パスワードリセット用のリンクを送信しました/i)).toBeInTheDocument()
    })
  })

  it('成功時にフォームが非表示になり成功メッセージを表示する', async () => {
    mockRequestPasswordReset.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<PasswordResetForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('mail@example.com')).not.toBeInTheDocument()
      expect(screen.getByText(/メールをご確認ください/i)).toBeInTheDocument()
    })
  })

  it('APIがエラーを返した場合エラーメッセージを表示する', async () => {
    mockRequestPasswordReset.mockResolvedValue({ error: 'メールアドレスが見つかりません' })

    const user = userEvent.setup()
    render(<PasswordResetForm />)

    await user.type(getEmailInput(), 'notfound@example.com')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/メールアドレスが見つかりません/i)).toBeInTheDocument()
    })
  })

  it('送信中はボタンが無効化される', async () => {
    mockRequestPasswordReset.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)))

    const user = userEvent.setup()
    render(<PasswordResetForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.click(getSubmitButton())

    expect(screen.getByRole('button', { name: /送信中/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /送信中/i })).toBeDisabled()
  })

  it('ログインページへのリンクを表示する', () => {
    render(<PasswordResetForm />)
    expect(screen.getByRole('link', { name: /ログインページへ戻る/i })).toHaveAttribute('href', '/login')
  })

  it('成功画面でログインページへのリンクを表示する', async () => {
    mockRequestPasswordReset.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<PasswordResetForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /ログインページへ戻る/i })).toHaveAttribute('href', '/login')
    })
  })

  it('成功画面で迷惑メールフォルダの確認メッセージを表示する', async () => {
    mockRequestPasswordReset.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<PasswordResetForm />)

    await user.type(getEmailInput(), 'test@example.com')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/迷惑メールフォルダもご確認ください/i)).toBeInTheDocument()
    })
  })

  it('メールアドレスのラベルが表示される', () => {
    render(<PasswordResetForm />)
    expect(screen.getByText('メールアドレス')).toBeInTheDocument()
  })

  it('result.success=false で error プロパティが無い場合は「エラー」フォールバックが出る', async () => {
    mockRequestPasswordReset.mockResolvedValue({ success: false })

    const user = userEvent.setup()
    render(<PasswordResetForm />)
    await user.type(getEmailInput(), 'test@example.com')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })
    // 成功画面には行かない
    expect(screen.queryByText(/メールを送信しました/)).not.toBeInTheDocument()
  })

  it('エラー時もボタンが loading=false に戻り再送信可能になる', async () => {
    mockRequestPasswordReset.mockResolvedValue({ success: false, error: 'サーバーエラー' })

    const user = userEvent.setup()
    render(<PasswordResetForm />)
    await user.type(getEmailInput(), 'test@example.com')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText('サーバーエラー')).toBeInTheDocument()
    })
    // 再送信可能（disabled が解除）
    const button = screen.getByRole('button', { name: /リセットメールを送信/i })
    expect(button).not.toBeDisabled()
  })

  it('FormData.get が空文字を返す場合（required HTML 属性をバイパスした場合）はエラーを表示する', async () => {
    // HTML5 required を JS で外して送信させる
    render(<PasswordResetForm />)
    const input = getEmailInput()
    input.removeAttribute('required')
    // 空のまま submit
    const form = input.closest('form')!
    const event = new Event('submit', { bubbles: true, cancelable: true })
    form.dispatchEvent(event)

    await waitFor(() => {
      expect(screen.getByText('メールアドレスを入力してください')).toBeInTheDocument()
    })
    // Server Action が呼ばれない
    expect(mockRequestPasswordReset).not.toHaveBeenCalled()
  })
})
