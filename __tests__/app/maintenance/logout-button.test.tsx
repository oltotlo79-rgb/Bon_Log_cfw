/**
 * MaintenanceLogoutButton ブランチカバレッジ向上テスト
 *
 * 対象ブランチ:
 * - ゲストユーザー: トップページへ表示
 * - 通常ユーザー: ログアウト表示
 * - loading状態: ボタン無効化+ラベル切替
 */

import { vi, describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockSignOut = vi.fn()
const mockUseSession = vi.fn()

vi.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
  useSession: () => mockUseSession(),
}))

import { MaintenanceLogoutButton } from '@/app/maintenance/logout-button'

describe('MaintenanceLogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue(undefined)
  })

  it('通常ユーザーの場合「ログアウト」と表示する', () => {
    mockUseSession.mockReturnValue({ data: { user: { email: 'user@example.com' } } })
    render(<MaintenanceLogoutButton />)
    expect(screen.getByText('ログアウト')).toBeInTheDocument()
  })

  it('ゲストユーザーの場合「トップページへ」と表示する', () => {
    mockUseSession.mockReturnValue({ data: { user: { email: 'guest@example.com' } } })
    render(<MaintenanceLogoutButton />)
    expect(screen.getByText('トップページへ')).toBeInTheDocument()
  })

  it('セッションがない場合「ログアウト」と表示する', () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<MaintenanceLogoutButton />)
    expect(screen.getByText('ログアウト')).toBeInTheDocument()
  })

  it('クリック時にsignOutを呼び出す', async () => {
    mockUseSession.mockReturnValue({ data: { user: { email: 'user@example.com' } } })
    const user = userEvent.setup()
    render(<MaintenanceLogoutButton />)

    await user.click(screen.getByRole('button'))
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })

  it('ゲストのクリック時はトップページにリダイレクト', async () => {
    mockUseSession.mockReturnValue({ data: { user: { email: 'guest@example.com' } } })
    const user = userEvent.setup()
    render(<MaintenanceLogoutButton />)

    await user.click(screen.getByRole('button'))
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' })
  })

  it('loading中はボタンが無効化される', async () => {
    mockUseSession.mockReturnValue({ data: { user: { email: 'user@example.com' } } })
    // signOutが解決しないようにする
    mockSignOut.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(<MaintenanceLogoutButton />)

    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText('ログアウト中...')).toBeInTheDocument()
  })
})
