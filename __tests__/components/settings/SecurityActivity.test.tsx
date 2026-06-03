import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'

const mockGetMySecurityEvents = vi.fn()
vi.mock('@/lib/actions/security-activity', () => ({
  getMySecurityEvents: () => mockGetMySecurityEvents(),
}))

import { SecurityActivity } from '@/components/settings/SecurityActivity'

describe('SecurityActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('イベントをラベル付きで一覧表示する', async () => {
    mockGetMySecurityEvents.mockResolvedValue({
      events: [
        { id: 'e1', eventType: 'failed_login', ipAddress: '1.2.3.4', userAgent: 'Mozilla', createdAt: new Date('2026-01-02T10:00:00Z') },
        { id: 'e2', eventType: 'password_change', ipAddress: null, userAgent: null, createdAt: new Date('2026-01-01T10:00:00Z') },
      ],
    })

    render(await SecurityActivity())

    expect(screen.getByText('ログイン失敗')).toBeInTheDocument()
    expect(screen.getByText('パスワード変更')).toBeInTheDocument()
    expect(screen.getByText(/1\.2\.3\.4/)).toBeInTheDocument()
    expect(screen.getByTestId('security-activity-list')).toBeInTheDocument()
  })

  it('未知の eventType はそのまま表示する', async () => {
    mockGetMySecurityEvents.mockResolvedValue({
      events: [{ id: 'e3', eventType: 'unknown_event', ipAddress: null, userAgent: null, createdAt: new Date('2026-01-01') }],
    })

    render(await SecurityActivity())
    expect(screen.getByText('unknown_event')).toBeInTheDocument()
  })

  it('イベントが無い場合は空メッセージを表示する', async () => {
    mockGetMySecurityEvents.mockResolvedValue({ events: [] })

    render(await SecurityActivity())
    expect(screen.getByText('記録された活動はありません。')).toBeInTheDocument()
  })
})
