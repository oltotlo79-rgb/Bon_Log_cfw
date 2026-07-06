// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    event: {
      deleteMany: vi.fn(),
    },
    webhookEvent: {
      deleteMany: vi.fn(),
    },
    // 失効トークン掃除。多くのテストでは関心外のため既定 0 件（clearAllMocks は実装を消さない）
    emailVerificationToken: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    passwordResetToken: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
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
    vi.mocked(prisma.webhookEvent.deleteMany).mockResolvedValue({ count: 0 })

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
    vi.mocked(prisma.webhookEvent.deleteMany).mockResolvedValue({ count: 0 })

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest({
      authorization: 'HMAC test',
      'x-cron-timestamp': Date.now().toString(),
    }))

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.deletedCount).toBe(0)
    expect(data.webhookDeletedCount).toBe(0)
  })

  it('30 日経過した webhook 冪等性レコードを削除する', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.event.deleteMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.webhookEvent.deleteMany).mockResolvedValue({ count: 42 })

    const beforeRequest = Date.now()

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest({
      authorization: 'HMAC test',
      'x-cron-timestamp': Date.now().toString(),
    }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.webhookDeletedCount).toBe(42)
    expect(data.webhookCutoffDate).toBeDefined()

    // webhook cutoff は約 30 日前であること（5 秒の許容）
    const webhookCutoff = new Date(data.webhookCutoffDate).getTime()
    const expectedCutoff = beforeRequest - 30 * 24 * 60 * 60 * 1000
    expect(Math.abs(webhookCutoff - expectedCutoff)).toBeLessThan(5000)

    expect(prisma.webhookEvent.deleteMany).toHaveBeenCalledWith({
      where: { processedAt: { lt: expect.any(Date) } },
    })
  })

  it('失効したメール確認/パスワードリセットトークンを削除する', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.event.deleteMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.webhookEvent.deleteMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.emailVerificationToken.deleteMany).mockResolvedValue({ count: 3 })
    vi.mocked(prisma.passwordResetToken.deleteMany).mockResolvedValue({ count: 2 })

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest({
      authorization: 'HMAC test',
      'x-cron-timestamp': Date.now().toString(),
    }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.expiredTokensDeleted).toBe(5)
    expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: { expires: { lt: expect.any(Date) } },
    })
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { expires: { lt: expect.any(Date) } },
    })
  })

  it('DB エラー時に500を返す', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.event.deleteMany).mockRejectedValue(new Error('DB error'))
    vi.mocked(prisma.webhookEvent.deleteMany).mockResolvedValue({ count: 0 })

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
    vi.mocked(prisma.webhookEvent.deleteMany).mockResolvedValue({ count: 0 })

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
    vi.mocked(prisma.webhookEvent.deleteMany).mockResolvedValue({ count: 0 })

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest({
      authorization: 'HMAC test',
      'x-cron-timestamp': Date.now().toString(),
    }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.deletedCount).toBe(7)

    // Verify that the query includes OR conditions for both endDate and null endDate
    const callArgs = vi.mocked(prisma.event.deleteMany).mock.calls[0]?.[0] as {
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
    vi.mocked(prisma.webhookEvent.deleteMany).mockResolvedValue({ count: 0 })

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

  it('webhookEvent.deleteMany が失敗すれば 500 を返す（Promise.all の片側失敗）', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.event.deleteMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.webhookEvent.deleteMany).mockRejectedValue(new Error('Webhook DB error'))

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest({
      authorization: 'HMAC test',
      'x-cron-timestamp': Date.now().toString(),
    }))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('verifyCronAuth が error を返さない場合は既定のUnauthorizedメッセージにフォールバックする', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: false, error: undefined })

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest())

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBeDefined()
    expect(typeof data.error).toBe('string')
    expect(data.error.length).toBeGreaterThan(0)
  })

  it('CRON_SECRET未設定のテスト環境で認証がスキップされる場合は200を返す', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    // In test env without CRON_SECRET, verifyCronAuth may return valid
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.event.deleteMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.webhookEvent.deleteMany).mockResolvedValue({ count: 0 })

    const { GET } = await import('@/app/api/cron/cleanup-events/route')
    const response = await GET(createMockRequest({
      authorization: 'Bearer some-token',
    }))

    expect(response.status).toBe(200)
  })
})
