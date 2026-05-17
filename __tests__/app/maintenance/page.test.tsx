import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// モック
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/actions/maintenance', () => ({
  getMaintenanceSettings: vi.fn(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

vi.mock('@/app/maintenance/logout-button', () => ({
  MaintenanceLogoutButton: () => <button data-testid="logout-button">ログアウト</button>,
}))

describe('MaintenancePage', async () => {
  const { auth } = await import('@/lib/auth')
  const { getMaintenanceSettings } = await import('@/lib/actions/maintenance')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ログイン済みの場合はログアウトボタンを表示', async () => {
     
    auth.mockResolvedValue({ user: { id: 'user1' } } as any)
    getMaintenanceSettings.mockResolvedValue({
      message: 'メンテナンス中です',
      startTime: null,
      endTime: null,
     
    } as any)

    const { default: Page } = await import('@/app/maintenance/page')
    const result = await Page()
    render(result)

    expect(screen.getByTestId('logout-button')).toBeInTheDocument()
    expect(screen.getByText('メンテナンス中')).toBeInTheDocument()
    expect(screen.getByText('メンテナンス中です')).toBeInTheDocument()
  })

  it('未ログインの場合はログアウトボタンを非表示', async () => {
     
    auth.mockResolvedValue(null as any)
    getMaintenanceSettings.mockResolvedValue({
      message: 'システムメンテナンス実施中',
      startTime: null,
      endTime: null,
     
    } as any)

    const { default: Page } = await import('@/app/maintenance/page')
    const result = await Page()
    render(result)

    expect(screen.queryByTestId('logout-button')).not.toBeInTheDocument()
    expect(screen.getByText('システムメンテナンス実施中')).toBeInTheDocument()
  })

  it('メンテナンス期間を表示', async () => {
     
    auth.mockResolvedValue(null as any)
    getMaintenanceSettings.mockResolvedValue({
      message: 'メンテナンス実施中',
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-01T03:00:00.000Z',
     
    } as any)

    const { default: Page } = await import('@/app/maintenance/page')
    const result = await Page()
    render(result)

    expect(screen.getByText('メンテナンス期間')).toBeInTheDocument()
    expect(screen.getByText(/開始:/)).toBeInTheDocument()
    expect(screen.getByText(/終了予定:/)).toBeInTheDocument()
  })

  it('デフォルトメッセージを表示', async () => {
     
    auth.mockResolvedValue(null as any)
    getMaintenanceSettings.mockResolvedValue({
      message: null,
      startTime: null,
      endTime: null,
     
    } as any)

    const { default: Page } = await import('@/app/maintenance/page')
    const result = await Page()
    render(result)

    expect(screen.getByText('ただいまメンテナンス中です。しばらくお待ちください。')).toBeInTheDocument()
  })

  it('BON-LOGリンクを表示', async () => {
     
    auth.mockResolvedValue(null as any)
    getMaintenanceSettings.mockResolvedValue({
      message: 'メンテナンス中',
      startTime: null,
      endTime: null,
     
    } as any)

    const { default: Page } = await import('@/app/maintenance/page')
    const result = await Page()
    render(result)

    const logo = screen.getByText('BON-LOG')
    expect(logo.closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('盆栽愛好家のためのSNS')).toBeInTheDocument()
  })
})
