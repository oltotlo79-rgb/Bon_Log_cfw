// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    event: {
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/cron-auth', () => ({
  verifyCronAuth: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

function createMockRequest(headers: Record<string, string> = {}) {
  return {
    headers: {
      get: (name: string) => headers[name] || null,
    },
    nextUrl: { pathname: '/api/cron/cleanup-events' },
  } as unknown as import('next/server').NextRequest
}

describe('Cron Cleanup Events API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('認証失敗で401を返す', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: false, error: 'Invalid signature' })

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest())
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('古いイベントを正常に削除', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.event.deleteMany).mockResolvedValue({ count: 5 })

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest({
      authorization: 'HMAC test',
      'x-cron-timestamp': Date.now().toString(),
    }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.deletedCount).toBe(5)
    expect(data.cutoffDate).toBeDefined()
  })

  it('削除対象がゼロの場合も成功を返す', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.event.deleteMany).mockResolvedValue({ count: 0 })

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest({
      authorization: 'HMAC test',
      'x-cron-timestamp': Date.now().toString(),
    }))

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.deletedCount).toBe(0)
  })

  it('DB エラー時に500を返す', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.event.deleteMany).mockRejectedValue(new Error('DB error'))

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest({
      authorization: 'HMAC test',
      'x-cron-timestamp': Date.now().toString(),
    }))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('cutoffDate が約6ヶ月前であること', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.event.deleteMany).mockResolvedValue({ count: 25 })

    const beforeRequest = new Date()
    beforeRequest.setMonth(beforeRequest.getMonth() - 6)

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest({
      authorization: 'HMAC test',
      'x-cron-timestamp': Date.now().toString(),
    }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.deletedCount).toBe(25)
    expect(data.cutoffDate).toBeDefined()

    // Verify cutoffDate is approximately 6 months ago
    const cutoffDate = new Date(data.cutoffDate)
    const timeDiff = Math.abs(cutoffDate.getTime() - beforeRequest.getTime())
    expect(timeDiff).toBeLessThan(5000) // Within 5 seconds
  })

  it('endDate有りのイベントとendDate nullのイベントの両方を削除対象にする', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.event.deleteMany).mockResolvedValue({ count: 7 })

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest({
      authorization: 'HMAC test',
      'x-cron-timestamp': Date.now().toString(),
    }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.deletedCount).toBe(7)

    // Verify that the query includes OR conditions for both endDate and null endDate
    const callArgs = vi.mocked(prisma.event.deleteMany).mock.calls[0][0] as {
      where: { OR: Array<Record<string, unknown>> }
    }
    expect(callArgs.where.OR).toHaveLength(2)
    expect(callArgs.where.OR[1]).toEqual({
      endDate: null,
      startDate: expect.objectContaining({
        lt: expect.any(Date),
      }),
    })
  })

  it('Authorizationヘッダーがない場合は認証失敗を返す', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: false, error: 'Missing authorization' })

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest())

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('endDate有りのイベント削除クエリ形状を検証する', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.event.deleteMany).mockResolvedValue({ count: 10 })

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest({
      authorization: 'HMAC test',
      'x-cron-timestamp': Date.now().toString(),
    }))

    expect(response.status).toBe(200)

    // Check that deleteMany was called with correct OR conditions
    expect(prisma.event.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              endDate: expect.objectContaining({
                not: null,
                lt: expect.any(Date),
              }),
            }),
            expect.objectContaining({
              endDate: null,
              startDate: expect.objectContaining({
                lt: expect.any(Date),
              }),
            }),
          ]),
        }),
      })
    )
  })

  it('CRON_SECRET未設定のテスト環境で認証がスキップされる場合は200を返す', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    // In test env without CRON_SECRET, verifyCronAuth may return valid
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.event.deleteMany).mockResolvedValue({ count: 0 })

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest({
      authorization: 'Bearer some-token',
    }))

    expect(response.status).toBe(200)
  })
})
