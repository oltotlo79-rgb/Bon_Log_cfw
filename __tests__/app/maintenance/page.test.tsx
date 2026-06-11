import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Session } from 'next-auth'
import type { MaintenanceSettings } from '@/lib/actions/maintenance'

const mockAuth = vi.fn<() => Promise<Session | null>>()
const mockGetMaintenanceSettings = vi.fn<() => Promise<MaintenanceSettings>>()

vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('@/lib/actions/maintenance', () => ({
  getMaintenanceSettings: () => mockGetMaintenanceSettings(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/app/maintenance/logout-button', () => ({
  MaintenanceLogoutButton: () => <button data-testid="logout-button">ログアウト</button>,
}))

const SESSION: Session = {
  user: { id: 'user1' },
  expires: '2099-01-01',
}

const SETTINGS_BASE: MaintenanceSettings = {
  enabled: true,
  message: 'メンテナンス中です',
  startTime: null,
  endTime: null,
}

describe('MaintenancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('ログイン済みの場合はログアウトボタンを表示', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetMaintenanceSettings.mockResolvedValue({
      ...SETTINGS_BASE,
      message: 'メンテナンス中です',
    })

    const { default: Page } = await import('@/app/maintenance/page')
    const result = await Page()
    render(result)

    expect(screen.getByTestId('logout-button')).toBeInTheDocument()
    expect(screen.getByText('メンテナンス中')).toBeInTheDocument()
    expect(screen.getByText('メンテナンス中です')).toBeInTheDocument()
  })

  it('未ログインの場合はログアウトボタンを非表示', async () => {
    mockAuth.mockResolvedValue(null)
    mockGetMaintenanceSettings.mockResolvedValue({
      ...SETTINGS_BASE,
      message: 'システムメンテナンス実施中',
    })

    const { default: Page } = await import('@/app/maintenance/page')
    const result = await Page()
    render(result)

    expect(screen.queryByTestId('logout-button')).not.toBeInTheDocument()
    expect(screen.getByText('システムメンテナンス実施中')).toBeInTheDocument()
  })

  it('メンテナンス期間を表示', async () => {
    mockAuth.mockResolvedValue(null)
    mockGetMaintenanceSettings.mockResolvedValue({
      ...SETTINGS_BASE,
      message: 'メンテナンス実施中',
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-01T03:00:00.000Z',
    })

    const { default: Page } = await import('@/app/maintenance/page')
    const result = await Page()
    render(result)

    expect(screen.getByText('メンテナンス期間')).toBeInTheDocument()
    expect(screen.getByText(/開始:/)).toBeInTheDocument()
    expect(screen.getByText(/終了予定:/)).toBeInTheDocument()
  })

  it('デフォルトメッセージを表示', async () => {
    mockAuth.mockResolvedValue(null)
    mockGetMaintenanceSettings.mockResolvedValue({
      ...SETTINGS_BASE,
      message: '',
    })

    const { default: Page } = await import('@/app/maintenance/page')
    const result = await Page()
    render(result)

    expect(screen.getByText('ただいまメンテナンス中です。しばらくお待ちください。')).toBeInTheDocument()
  })

  it('BON-LOGリンクを表示', async () => {
    mockAuth.mockResolvedValue(null)
    mockGetMaintenanceSettings.mockResolvedValue({
      ...SETTINGS_BASE,
      message: 'メンテナンス中',
    })

    const { default: Page } = await import('@/app/maintenance/page')
    const result = await Page()
    render(result)

    const logo = screen.getByText('BON-LOG')
    expect(logo.closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('盆栽愛好家のためのSNS')).toBeInTheDocument()
  })
})
