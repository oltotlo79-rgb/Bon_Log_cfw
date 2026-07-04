import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'

const mockConfirmEmailChange = vi.fn()
vi.mock('@/lib/actions/account-security', () => ({
  confirmEmailChange: (...args: unknown[]) => mockConfirmEmailChange(...args),
}))

import EmailChangeConfirmPage from '@/app/(auth)/email-change/confirm/page'
import { ERR_EMAIL_CHANGE_LINK_INVALID, ERR_EMAIL_ALREADY_IN_USE } from '@/lib/constants/errors'
import { ROUTE_LOGIN, ROUTE_SETTINGS_ACCOUNT } from '@/lib/constants/routes'

describe('EmailChangeConfirmPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('token が無い場合はエラー表示し confirmEmailChange を呼び出さない', async () => {
    render(await EmailChangeConfirmPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByText('メールアドレスの変更に失敗しました')).toBeInTheDocument()
    expect(screen.getByText(ERR_EMAIL_CHANGE_LINK_INVALID)).toBeInTheDocument()
    expect(mockConfirmEmailChange).not.toHaveBeenCalled()

    const loginLink = screen.getByRole('link', { name: 'ログインページへ' })
    expect(loginLink).toHaveAttribute('href', ROUTE_LOGIN)
  })

  it('有効な token で成功した場合、完了メッセージと導線を表示する', async () => {
    mockConfirmEmailChange.mockResolvedValueOnce({ success: true })

    render(
      await EmailChangeConfirmPage({
        searchParams: Promise.resolve({ token: 'valid-token-123' }),
      })
    )

    expect(mockConfirmEmailChange).toHaveBeenCalledWith('valid-token-123')
    expect(screen.getByText('メールアドレスを変更しました')).toBeInTheDocument()
    expect(screen.getByText('新しいメールアドレスでログインできます。')).toBeInTheDocument()

    const settingsLink = screen.getByRole('link', { name: 'アカウント設定へ戻る' })
    expect(settingsLink).toHaveAttribute('href', ROUTE_SETTINGS_ACCOUNT)
    const loginLink = screen.getByRole('link', { name: 'ログインページへ' })
    expect(loginLink).toHaveAttribute('href', ROUTE_LOGIN)
  })

  it('無効/期限切れ token で失敗した場合、エラーメッセージを表示する', async () => {
    mockConfirmEmailChange.mockResolvedValueOnce({
      success: false,
      error: ERR_EMAIL_CHANGE_LINK_INVALID,
    })

    render(
      await EmailChangeConfirmPage({
        searchParams: Promise.resolve({ token: 'expired-token' }),
      })
    )

    expect(mockConfirmEmailChange).toHaveBeenCalledWith('expired-token')
    expect(screen.getByText('メールアドレスの変更に失敗しました')).toBeInTheDocument()
    expect(screen.getByText(ERR_EMAIL_CHANGE_LINK_INVALID)).toBeInTheDocument()
  })

  it('新しいメールアドレスが既に使用されている場合のエラーメッセージを表示する', async () => {
    mockConfirmEmailChange.mockResolvedValueOnce({
      success: false,
      error: ERR_EMAIL_ALREADY_IN_USE,
    })

    render(
      await EmailChangeConfirmPage({
        searchParams: Promise.resolve({ token: 'some-token' }),
      })
    )

    expect(screen.getByText(ERR_EMAIL_ALREADY_IN_USE)).toBeInTheDocument()
  })

  it('metadata は noindex/nofollow を設定している', async () => {
    const mod = await import('@/app/(auth)/email-change/confirm/page')
    expect(mod.metadata.title).toBe('メールアドレス変更の確認')
    expect(mod.metadata.robots).toEqual({ index: false, follow: false })
  })
})
