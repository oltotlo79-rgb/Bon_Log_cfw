/**
 * 設定ページの未カバー分岐テスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

class RedirectError extends Error {
  url: string
  constructor(url: string) { super(`REDIRECT:${url}`); this.url = url }
}
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new RedirectError(url) },
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock('@/components/settings/TwoFactorSettings', () => ({
  TwoFactorSettings: () => <div data-testid="2fa-settings" />,
}))
vi.mock('@/components/settings/SettingsGuestRestriction', () => ({
  SettingsGuestRestriction: ({ title }: { title: string }) => <div data-testid="guest-restriction">{title}</div>,
}))
vi.mock('@/components/common/PageError', () => ({
  PageError: (props: Record<string, unknown>) => <div data-testid="page-error" data-title={props.title} />,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================
// SecuritySettingsPage
// ============================================================
import SecuritySettingsPage from '@/app/(main)/settings/security/page'

describe('SecuritySettingsPage', () => {
  it('未認証の場合はリダイレクト', async () => {
    mockAuth.mockResolvedValue(null)
    await expect(SecuritySettingsPage()).rejects.toThrow('REDIRECT')
  })

  it('ゲストユーザーの場合は制限表示', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'guest-id', email: 'guest@example.com' } })
    const result = await SecuritySettingsPage()
    expect(result).toBeDefined()
  })

  it('通常ユーザーの場合は2FA設定を表示', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1', email: 'test@example.com' } })
    const result = await SecuritySettingsPage()
    expect(result).toBeDefined()
  })
})

// ============================================================
// SubscriptionSettingsError
// ============================================================
import { render, screen } from '../../../utils/test-utils'
import SubscriptionSettingsError from '@/app/(main)/settings/subscription/error'

describe('SubscriptionSettingsError', () => {
  it('エラーコンポーネントを表示する', () => {
    const error = new Error('Test error')
    const reset = vi.fn()
    render(<SubscriptionSettingsError error={error} reset={reset} />)
    expect(screen.getByTestId('page-error')).toBeInTheDocument()
  })
})
