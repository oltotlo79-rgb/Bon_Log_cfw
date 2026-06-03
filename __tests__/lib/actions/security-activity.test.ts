// @vitest-environment node

import { vi } from 'vitest'

const mockSecurityEventFindMany = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: { securityEvent: { findMany: (...args: unknown[]) => mockSecurityEventFindMany(...args) } },
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

describe('getMySecurityEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('現在のユーザーのセキュリティイベントを新しい順で返す', async () => {
    const events = [
      { id: 'e1', eventType: 'failed_login', ipAddress: '1.2.3.4', userAgent: 'UA', createdAt: new Date('2026-01-02') },
      { id: 'e2', eventType: 'password_change', ipAddress: null, userAgent: null, createdAt: new Date('2026-01-01') },
    ]
    mockSecurityEventFindMany.mockResolvedValue(events)

    const { getMySecurityEvents } = await import('@/lib/actions/security-activity')
    const result = await getMySecurityEvents()

    expect(result.events).toEqual(events)
    const call = mockSecurityEventFindMany.mock.calls[0][0]
    expect(call.where).toEqual({ userId: 'user-1' })
    expect(call.orderBy).toEqual({ createdAt: 'desc' })
    // details は機微情報を含みうるため select に含めない
    expect(call.select.details).toBeUndefined()
  })

  it('未認証なら空配列を返し DB を引かない', async () => {
    mockAuth.mockResolvedValue(null)

    const { getMySecurityEvents } = await import('@/lib/actions/security-activity')
    const result = await getMySecurityEvents()

    expect(result).toEqual({ events: [] })
    expect(mockSecurityEventFindMany).not.toHaveBeenCalled()
  })
})
