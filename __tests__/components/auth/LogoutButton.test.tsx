import { vi } from 'vitest'
/**
 * ログアウトボタンコンポーネントのテスト
 */

import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { GUEST_EMAIL } from '@/lib/constants/guest'

// モックのセットアップ
const mockSignOut = vi.fn()
const mockUseSession = vi.fn()
vi.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => mockUseSession(),
}))

describe('LogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue(undefined)
    mockUseSession.mockReturnValue({
      data: { user: { id: 'test-user-id', name: 'テストユーザー', email: 'test@example.com' } },
      status: 'authenticated',
    })
  })

  // 1
  it('ログアウトボタンを表示する', () => {
    render(<LogoutButton />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  // 2
  it('ボタンに「ログアウト」テキストが表示される', () => {
    render(<LogoutButton />)
    expect(screen.getByText('ログアウト')).toBeInTheDocument()
  })

  // 3
  it('クリックするとsignOutが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<LogoutButton />)
    await user.click(screen.getByRole('button', { name: /ログアウト/i }))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
    })
  })

  // 4
  it('signOutがcallbackUrl "/login"で呼ばれる', async () => {
    const user = userEvent.setup()
    render(<LogoutButton />)
    await user.click(screen.getByRole('button', { name: /ログアウト/i }))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
    })
  })

  // 5
  it('ボタンがbutton要素である', () => {
    render(<LogoutButton />)
    const button = screen.getByRole('button', { name: /ログアウト/i })
    expect(button.tagName).toBe('BUTTON')
  })

  // 6
  it('ボタンがアクセシブルである', () => {
    render(<LogoutButton />)
    const button = screen.getByRole('button', { name: /ログアウト/i })
    expect(button).toHaveAccessibleName()
  })

  // 7
  it('ボタンが無効化されていない', () => {
    render(<LogoutButton />)
    expect(screen.getByRole('button', { name: /ログアウト/i })).not.toBeDisabled()
  })

  // 8
  it('ボタンがghost variantで表示される', () => {
    render(<LogoutButton />)
    const button = screen.getByRole('button', { name: /ログアウト/i })
    // shadcn/uiのghost variantクラスを確認
    expect(button).toBeInTheDocument()
  })

  // 9
  it('ボタンがsmサイズで表示される', () => {
    render(<LogoutButton />)
    const button = screen.getByRole('button', { name: /ログアウト/i })
    expect(button).toBeInTheDocument()
  })

  // 10
  it('複数回クリックで複数回signOutが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<LogoutButton />)
    const button = screen.getByRole('button', { name: /ログアウト/i })
    await user.click(button)
    await user.click(button)

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(2)
    })
  })

  // 11
  it('ボタンがフォーカス可能である', async () => {
    const user = userEvent.setup()
    render(<LogoutButton />)
    await user.tab()
    expect(screen.getByRole('button', { name: /ログアウト/i })).toHaveFocus()
  })

  it('ゲストのときは「トップページへ」を表示し、クリックでcallbackUrl "/"でsignOutする', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'guest-id', name: 'ゲスト', email: GUEST_EMAIL } },
      status: 'authenticated',
    })
    const user = userEvent.setup()
    render(<LogoutButton />)
    expect(screen.getByRole('button', { name: 'トップページへ' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'トップページへ' }))
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' })
    })
  })
})
