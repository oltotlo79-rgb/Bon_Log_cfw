// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    adminUser: { findUnique: vi.fn() },
    systemSetting: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: { api: { limit: 60, window: 60 } },
}))

const mockRequest = new Request('http://localhost/api/maintenance/status')

describe('GET /api/maintenance/status', async () => {
  const { auth } = await import('@/lib/auth')
  const { prisma } = await import('@/lib/db')

  const mockAuth = auth as ReturnType<typeof vi.fn>
  const mockAdminFindUnique = prisma.adminUser.findUnique as ReturnType<typeof vi.fn>
  const mockSettingFindUnique = prisma.systemSetting.findUnique as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('セッションなし・メンテナンスなしの場合 false/false を返す', async () => {
    mockAuth.mockResolvedValue(null)
    mockSettingFindUnique.mockResolvedValue(null)

    const { GET } = await import('@/app/api/maintenance/status/route')
    const response = await GET(mockRequest as never)
    const data = await response.json()

    expect(data).toEqual({ isMaintenanceMode: false, isAdmin: false })
  })

  it('メンテナンス有効（時間窓なし）の場合 true を返す', async () => {
    mockAuth.mockResolvedValue(null)
    mockSettingFindUnique.mockResolvedValue({
      value: { enabled: true, startTime: null, endTime: null, message: 'メンテナンス中' },
    })

    const { GET } = await import('@/app/api/maintenance/status/route')
    const response = await GET(mockRequest as never)
    const data = await response.json()

    expect(data.isMaintenanceMode).toBe(true)
  })

  it('メンテナンス有効だが開始前の場合 false を返す', async () => {
    mockAuth.mockResolvedValue(null)
    const futureDate = new Date(Date.now() + 86400000).toISOString() // 24時間後
    mockSettingFindUnique.mockResolvedValue({
      value: { enabled: true, startTime: futureDate, endTime: null, message: '' },
    })

    const { GET } = await import('@/app/api/maintenance/status/route')
    const response = await GET(mockRequest as never)
    const data = await response.json()

    expect(data.isMaintenanceMode).toBe(false)
  })

  it('メンテナンス有効だが終了後の場合 false を返す', async () => {
    mockAuth.mockResolvedValue(null)
    const pastDate = new Date(Date.now() - 86400000).toISOString() // 24時間前
    mockSettingFindUnique.mockResolvedValue({
      value: { enabled: true, startTime: null, endTime: pastDate, message: '' },
    })

    const { GET } = await import('@/app/api/maintenance/status/route')
    const response = await GET(mockRequest as never)
    const data = await response.json()

    expect(data.isMaintenanceMode).toBe(false)
  })

  it('メンテナンス有効で時間窓内の場合 true を返す', async () => {
    mockAuth.mockResolvedValue(null)
    const pastDate = new Date(Date.now() - 3600000).toISOString() // 1時間前
    const futureDate = new Date(Date.now() + 3600000).toISOString() // 1時間後
    mockSettingFindUnique.mockResolvedValue({
      value: { enabled: true, startTime: pastDate, endTime: futureDate, message: '' },
    })

    const { GET } = await import('@/app/api/maintenance/status/route')
    const response = await GET(mockRequest as never)
    const data = await response.json()

    expect(data.isMaintenanceMode).toBe(true)
  })

  it('管理者ユーザーの場合 isAdmin=true を返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin1' } })
    mockAdminFindUnique.mockResolvedValue({ userId: 'admin1' })
    mockSettingFindUnique.mockResolvedValue(null)

    const { GET } = await import('@/app/api/maintenance/status/route')
    const response = await GET(mockRequest as never)
    const data = await response.json()

    expect(data.isAdmin).toBe(true)
    expect(data.isMaintenanceMode).toBe(false)
  })

  it('非管理者ユーザーの場合 isAdmin=false を返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } })
    mockAdminFindUnique.mockResolvedValue(null)
    mockSettingFindUnique.mockResolvedValue(null)

    const { GET } = await import('@/app/api/maintenance/status/route')
    const response = await GET(mockRequest as never)
    const data = await response.json()

    expect(data.isAdmin).toBe(false)
  })

  it('enabled=false の場合は時間窓に関係なく false を返す', async () => {
    mockAuth.mockResolvedValue(null)
    const pastDate = new Date(Date.now() - 3600000).toISOString()
    const futureDate = new Date(Date.now() + 3600000).toISOString()
    mockSettingFindUnique.mockResolvedValue({
      value: { enabled: false, startTime: pastDate, endTime: futureDate, message: '' },
    })

    const { GET } = await import('@/app/api/maintenance/status/route')
    const response = await GET(mockRequest as never)
    const data = await response.json()

    expect(data.isMaintenanceMode).toBe(false)
  })

  it('エラー発生時に false/false を返す', async () => {
    mockAuth.mockRejectedValue(new Error('DB error'))

    const { GET } = await import('@/app/api/maintenance/status/route')
    const response = await GET(mockRequest as never)
    const data = await response.json()

    expect(data).toEqual({ isMaintenanceMode: false, isAdmin: false })
  })

  it('レート制限超過時は 429 + API_ERR_TOO_MANY_REQUESTS を返す', async () => {
    const rateLimitMod = await import('@/lib/rate-limit')
    ;(rateLimitMod.rateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: false,
    })

    const { GET } = await import('@/app/api/maintenance/status/route')
    const response = await GET(mockRequest as never)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data).toEqual({ error: 'Too many requests' })
  })

  it('systemSetting.value の形状が不正な場合は fail-safe で false を返し例外を投げない', async () => {
    mockAuth.mockResolvedValue(null)
    // enabled が boolean でない Zod 違反
    mockSettingFindUnique.mockResolvedValue({
      value: { enabled: 'yes', startTime: null, endTime: null, message: '' },
    })

    const { GET } = await import('@/app/api/maintenance/status/route')
    const response = await GET(mockRequest as never)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isMaintenanceMode).toBe(false)
  })

  it('systemSetting の検索キーは maintenance_mode 固定', async () => {
    mockAuth.mockResolvedValue(null)
    mockSettingFindUnique.mockResolvedValue(null)

    const { GET } = await import('@/app/api/maintenance/status/route')
    await GET(mockRequest as never)

    expect(mockSettingFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'maintenance_mode' },
      }),
    )
  })
})
