import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { RegisterForm } from '@/components/auth/RegisterForm'

// Next-Auth モック
const mockSignIn = vi.fn()
vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

// Next.js navigation モック
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// Server Actionモック
const mockRegisterUser = vi.fn()
vi.mock('@/lib/actions/auth', () => ({
  registerUser: (...args: unknown[]) => mockRegisterUser(...args),
}))

describe('RegisterForm', () => {
  const originalLocation = window.location
  const assignMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // 登録成功後は window.location.assign でハードナビゲーションするためモックする。
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, assign: assignMock },
      writable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    })
  })

  // ヘルパー関数
  const getNicknameInput = () => screen.getByPlaceholderText('表示名')
  const getEmailInput = () => screen.getByPlaceholderText('mail@example.com')
  const getPasswordInput = () => screen.getByPlaceholderText('8文字以上（英字・数字を含む）')
  const getConfirmPasswordInput = () => screen.getByPlaceholderText('もう一度入力')
  const getTermsCheckbox = () => screen.getByRole('checkbox')
  const getSubmitButton = () => screen.getByRole('button', { name: /新規登録/i })

  it('登録フォームを表示する', () => {
    render(<RegisterForm />)
    expect(getNicknameInput()).toBeInTheDocument()
    expect(getEmailInput()).toBeInTheDocument()
    expect(getPasswordInput()).toBeInTheDocument()
    expect(getConfirmPasswordInput()).toBeInTheDocument()
    expect(getTermsCheckbox()).toBeInTheDocument()
    expect(getSubmitButton()).toBeInTheDocument()
  })

  it('ニックネームを入力できる', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    const nicknameInput = getNicknameInput()
    await user.type(nicknameInput, 'テストユーザー')
    expect(nicknameInput).toHaveValue('テストユーザー')
  })

  it('メールアドレスを入力できる', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    const emailInput = getEmailInput()
    await user.type(emailInput, 'test@example.com')
    expect(emailInput).toHaveValue('test@example.com')
  })

  it('パスワードを入力できる', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    const passwordInput = getPasswordInput()
    await user.type(passwordInput, 'password123')
    expect(passwordInput).toHaveValue('password123')
  })

  it('利用規約に同意しない状態で送信するとエラーを表示しregisterUserを呼ばない', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.type(getConfirmPasswordInput(), 'password123')
    // 同意チェックはしない
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/利用規約とプライバシーポリシーに同意してください/i)).toBeInTheDocument()
    })
    expect(mockRegisterUser).not.toHaveBeenCalled()
  })

  it('パスワードが一致しない場合エラーを表示する', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.type(getConfirmPasswordInput(), 'differentpassword')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/パスワードが一致しません/i)).toBeInTheDocument()
    })
    expect(mockRegisterUser).not.toHaveBeenCalled()
  })

  it('パスワードが8文字未満の場合エラーを表示する', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'pass1')
    await user.type(getConfirmPasswordInput(), 'pass1')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/パスワードは8文字以上で入力してください/i)).toBeInTheDocument()
    })
    expect(mockRegisterUser).not.toHaveBeenCalled()
  })

  it('パスワードに英字がない場合エラーを表示する', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), '12345678')
    await user.type(getConfirmPasswordInput(), '12345678')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/パスワードはアルファベットを含めてください/i)).toBeInTheDocument()
    })
    expect(mockRegisterUser).not.toHaveBeenCalled()
  })

  it('パスワードに数字がない場合エラーを表示する', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'abcdefgh')
    await user.type(getConfirmPasswordInput(), 'abcdefgh')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/パスワードは数字を含めてください/i)).toBeInTheDocument()
    })
    expect(mockRegisterUser).not.toHaveBeenCalled()
  })

  it('登録成功時に確認メール送信完了ページへリダイレクトする', async () => {
    mockRegisterUser.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.type(getConfirmPasswordInput(), 'password123')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(mockRegisterUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'password123',
          nickname: 'テストユーザー',
        })
      )
    })

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith('/register/verify-email-sent')
    })
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('登録APIがエラーを返した場合エラーメッセージを表示する', async () => {
    mockRegisterUser.mockResolvedValue({ error: 'このメールアドレスは既に登録されています' })

    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'existing@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.type(getConfirmPasswordInput(), 'password123')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/このメールアドレスは既に登録されています/i)).toBeInTheDocument()
    })
  })

  it('確認メール送信失敗時はエラーメッセージを表示する', async () => {
    mockRegisterUser.mockResolvedValue({
      error: '確認メールの送信に失敗しました。しばらく経ってからお試しください。',
    })

    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.type(getConfirmPasswordInput(), 'password123')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(
        screen.getByText(/確認メールの送信に失敗しました。しばらく経ってからお試しください。/i)
      ).toBeInTheDocument()
    })
  })

  it('登録中はボタンが無効化される', async () => {
    mockRegisterUser.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
    )

    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.type(getConfirmPasswordInput(), 'password123')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    expect(screen.getByRole('button', { name: /登録中/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /登録中/i })).toBeDisabled()
  })

  it('パスワード表示/非表示を切り替えられる', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    const passwordInput = getPasswordInput()

    // 初期状態はパスワードが非表示
    expect(passwordInput).toHaveAttribute('type', 'password')

    // トグルボタンをクリック
    const toggleButton = screen.getAllByRole('button', { name: /パスワードを表示/i })[0]!
    await user.click(toggleButton)

    // パスワードが表示される
    expect(passwordInput).toHaveAttribute('type', 'text')

    // もう一度クリックして非表示に戻す
    const hideButton = screen.getAllByRole('button', { name: /パスワードを隠す/i })[0]!
    await user.click(hideButton)

    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('確認用パスワード表示/非表示を切り替えられる', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    const confirmPasswordInput = getConfirmPasswordInput()

    // 初期状態はパスワードが非表示
    expect(confirmPasswordInput).toHaveAttribute('type', 'password')

    // トグルボタンをクリック（2番目のトグルボタン）
    const toggleButtons = screen.getAllByRole('button', { name: /パスワードを表示/i })
    await user.click(toggleButtons[1]!)

    // パスワードが表示される
    expect(confirmPasswordInput).toHaveAttribute('type', 'text')
  })

  it('ログインリンクを表示する', () => {
    render(<RegisterForm />)
    expect(screen.getByText(/既にアカウントをお持ちの方/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ログイン/i })).toHaveAttribute('href', '/login')
  })

  it('利用規約リンクを表示する', () => {
    render(<RegisterForm />)
    expect(screen.getByRole('link', { name: /利用規約/i })).toHaveAttribute('href', '/terms')
  })

  it('プライバシーポリシーリンクを表示する', () => {
    render(<RegisterForm />)
    expect(screen.getByRole('link', { name: /プライバシーポリシー/i })).toHaveAttribute('href', '/privacy')
  })

  it('初期表示では送信ボタンは有効（同意は送信時に検証）', () => {
    render(<RegisterForm />)
    expect(getSubmitButton()).not.toBeDisabled()
  })

  it('利用規約に同意するとボタンが有効化される', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.click(getTermsCheckbox())
    expect(getSubmitButton()).not.toBeDisabled()
  })

  // Google OAuth テスト
  it('Googleで登録ボタンを表示する', () => {
    render(<RegisterForm />)
    expect(screen.getByRole('button', { name: /Googleで登録/i })).toBeInTheDocument()
  })

  it('Googleで登録ボタンをクリックするとsignIn("google")が呼ばれる', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.click(screen.getByRole('button', { name: /Googleで登録/i }))

    expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/feed' })
  })

  it('登録中はGoogleで登録ボタンが無効化される', async () => {
    mockRegisterUser.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
    )

    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(getNicknameInput(), 'テストユーザー')
    await user.type(getEmailInput(), 'test@example.com')
    await user.type(getPasswordInput(), 'password123')
    await user.type(getConfirmPasswordInput(), 'password123')
    await user.click(getTermsCheckbox())
    await user.click(getSubmitButton())

    expect(screen.getByRole('button', { name: /Googleで登録/i })).toBeDisabled()
  })

  it('「または」区切り線を表示する', () => {
    render(<RegisterForm />)
    expect(screen.getByText('または')).toBeInTheDocument()
  })
})
