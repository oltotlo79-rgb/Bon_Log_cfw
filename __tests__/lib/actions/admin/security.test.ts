// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

vi.mock('@/lib/rate-limit', () => ({ checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }), RATE_LIMITS: {} }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])) }))
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn().mockResolvedValue(false), getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }) }))

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

describe('セキュリティイベント管理アクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)

    // securityEvent モデルを追加
    if (!(mockPrisma as Record<string, unknown>).securityEvent) {
      ;(mockPrisma as Record<string, unknown>).securityEvent = {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      }
    } else {
      const se = (mockPrisma as Record<string, unknown>).securityEvent as Record<string, ReturnType<typeof vi.fn>>
      se.create = vi.fn()
      se.findMany = vi.fn()
      se.count = vi.fn()
      se.groupBy = vi.fn()
    }

    // $queryRaw モック
    ;(mockPrisma as Record<string, unknown>).$queryRaw = vi.fn().mockResolvedValue([])
  })

  const getSecurityEvent = () => (mockPrisma as Record<string, unknown>).securityEvent as Record<string, ReturnType<typeof vi.fn>>

  // ============================================================
  // logSecurityEvent
  // ============================================================

  describe('logSecurityEvent', () => {
    it('全フィールド指定でイベントを記録する', async () => {
      getSecurityEvent().create.mockResolvedValue({ id: 'event-1' })

      const { logSecurityEvent } = await import('@/lib/services/security-events')
      await logSecurityEvent({
        eventType: 'failed_login',
        userId: 'user-1',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        details: { reason: 'invalid_password' },
      })

      expect(getSecurityEvent().create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'failed_login',
          userId: 'user-1',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      })
    })

    it('最小フィールドでイベントを記録する', async () => {
      getSecurityEvent().create.mockResolvedValue({ id: 'event-2' })

      const { logSecurityEvent } = await import('@/lib/services/security-events')
      await logSecurityEvent({ eventType: 'password_change' })

      expect(getSecurityEvent().create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'password_change',
          userId: null,
          ipAddress: null,
          userAgent: null,
        }),
      })
    })

    it('認証チェックなしで実行できる（ユーティリティ関数）', async () => {
      mockAuth.mockResolvedValue(null)
      getSecurityEvent().create.mockResolvedValue({ id: 'event-3' })

      const { logSecurityEvent } = await import('@/lib/services/security-events')
      await logSecurityEvent({ eventType: '2fa_toggle' })

      expect(getSecurityEvent().create).toHaveBeenCalled()
    })

    it('detailsがundefinedの場合はundefinedが渡される', async () => {
      getSecurityEvent().create.mockResolvedValue({ id: 'event-4' })

      const { logSecurityEvent } = await import('@/lib/services/security-events')
      await logSecurityEvent({ eventType: 'test_event' })

      expect(getSecurityEvent().create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: undefined,
        }),
      })
    })
  })

  // ============================================================
  // getSecurityEvents
  // ============================================================

  describe('getSecurityEvents', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      const result = await getSecurityEvents()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      const result = await getSecurityEvents()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('オプションなしで全件取得する', async () => {
      getSecurityEvent().findMany.mockResolvedValue([])
      getSecurityEvent().count.mockResolvedValue(0)

      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      const result = await getSecurityEvents()

      if ('error' in result) throw new Error('Expected events, got error')
      expect(result.events).toEqual([])
      expect(result.total).toBe(0)
    })

    it('イベント一覧と総件数を正常に返す', async () => {
      const mockEvents = [
        { id: 'e1', eventType: 'failed_login', userId: 'u1', createdAt: new Date() },
        { id: 'e2', eventType: 'password_change', userId: 'u2', createdAt: new Date() },
      ]
      getSecurityEvent().findMany.mockResolvedValue(mockEvents)
      getSecurityEvent().count.mockResolvedValue(2)

      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      const result = await getSecurityEvents()

      if ('error' in result) throw new Error('Expected events, got error')
      expect(result.events).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('eventTypeフィルタが適用される', async () => {
      getSecurityEvent().findMany.mockResolvedValue([])
      getSecurityEvent().count.mockResolvedValue(0)

      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      await getSecurityEvents({ eventType: 'failed_login' })

      expect(getSecurityEvent().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ eventType: 'failed_login' }),
        })
      )
    })

    it('userIdフィルタが適用される', async () => {
      getSecurityEvent().findMany.mockResolvedValue([])
      getSecurityEvent().count.mockResolvedValue(0)

      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      await getSecurityEvents({ userId: 'user-123' })

      expect(getSecurityEvent().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-123' }),
        })
      )
    })

    it('ipAddressフィルタが部分一致で適用される', async () => {
      getSecurityEvent().findMany.mockResolvedValue([])
      getSecurityEvent().count.mockResolvedValue(0)

      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      await getSecurityEvents({ ipAddress: '192.168' })

      expect(getSecurityEvent().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ipAddress: { contains: '192.168' },
          }),
        })
      )
    })

    it('日付範囲フィルタが適用される', async () => {
      getSecurityEvent().findMany.mockResolvedValue([])
      getSecurityEvent().count.mockResolvedValue(0)

      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      await getSecurityEvents({
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      })

      expect(getSecurityEvent().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      )
    })

    it('dateFromのみでもフィルタが適用される', async () => {
      getSecurityEvent().findMany.mockResolvedValue([])
      getSecurityEvent().count.mockResolvedValue(0)

      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      await getSecurityEvents({ dateFrom: '2024-06-01' })

      expect(getSecurityEvent().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      )
    })

    it('cursor ページネーションが適用される', async () => {
      getSecurityEvent().findMany.mockResolvedValue([])
      getSecurityEvent().count.mockResolvedValue(100)

      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      await getSecurityEvents({ limit: 10, cursor: 'sec-cursor' })

      expect(getSecurityEvent().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'sec-cursor' },
          skip: 1,
        })
      )
    })

    it('デフォルトでは limit=20、cursor/skip なし', async () => {
      getSecurityEvent().findMany.mockResolvedValue([])
      getSecurityEvent().count.mockResolvedValue(0)

      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      await getSecurityEvents()

      const call = getSecurityEvent().findMany.mock.calls[0][0]
      expect(call.take).toBe(20)
      expect(call.cursor).toBeUndefined()
      expect(call.skip).toBeUndefined()
    })

    it('複数フィルタを組み合わせて適用できる', async () => {
      getSecurityEvent().findMany.mockResolvedValue([])
      getSecurityEvent().count.mockResolvedValue(0)

      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      await getSecurityEvents({
        eventType: 'failed_login',
        userId: 'user-1',
        ipAddress: '10.0',
      })

      expect(getSecurityEvent().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: 'failed_login',
            userId: 'user-1',
            ipAddress: { contains: '10.0' },
          }),
        })
      )
    })
  })

  // ============================================================
  // getSecurityDashboard
  // ============================================================

  describe('getSecurityDashboard', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getSecurityDashboard } = await import('@/lib/actions/admin/security')
      const result = await getSecurityDashboard()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getSecurityDashboard } = await import('@/lib/actions/admin/security')
      const result = await getSecurityDashboard()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('ダッシュボードサマリーを正常に返す', async () => {
      getSecurityEvent().count
        .mockResolvedValueOnce(5)   // failedLoginsToday
        .mockResolvedValueOnce(30)  // failedLoginsWeek
        .mockResolvedValueOnce(2)   // passwordChangesToday
        .mockResolvedValueOnce(1)   // twoFactorTogglesToday
      getSecurityEvent().groupBy.mockResolvedValue([
        { eventType: 'failed_login', _count: 30 },
        { eventType: 'password_change', _count: 5 },
      ])
      ;(mockPrisma as Record<string, unknown>).$queryRaw = vi.fn().mockResolvedValue([
        { ip_address: '192.168.1.1', cnt: BigInt(10) },
        { ip_address: '10.0.0.1', cnt: BigInt(5) },
      ])

      const { getSecurityDashboard } = await import('@/lib/actions/admin/security')
      const result = await getSecurityDashboard()

      if ('error' in result) throw new Error('Expected dashboard, got error')
      expect(result.failedLoginsToday).toBe(5)
      expect(result.failedLoginsWeek).toBe(30)
      expect(result.passwordChangesToday).toBe(2)
      expect(result.twoFactorTogglesToday).toBe(1)
      expect(result.eventsByType).toEqual([
        { type: 'failed_login', count: 30 },
        { type: 'password_change', count: 5 },
      ])
      expect(result.topFailedIps).toEqual([
        { ipAddress: '192.168.1.1', count: 10 },
        { ipAddress: '10.0.0.1', count: 5 },
      ])
    })

    it('全統計が0の場合でも正常に返す', async () => {
      getSecurityEvent().count.mockResolvedValue(0)
      getSecurityEvent().groupBy.mockResolvedValue([])
      ;(mockPrisma as Record<string, unknown>).$queryRaw = vi.fn().mockResolvedValue([])

      const { getSecurityDashboard } = await import('@/lib/actions/admin/security')
      const result = await getSecurityDashboard()

      if ('error' in result) throw new Error('Expected dashboard, got error')
      expect(result.failedLoginsToday).toBe(0)
      expect(result.failedLoginsWeek).toBe(0)
      expect(result.passwordChangesToday).toBe(0)
      expect(result.twoFactorTogglesToday).toBe(0)
      expect(result.eventsByType).toEqual([])
      expect(result.topFailedIps).toEqual([])
    })

    it('topFailedIpsのbigintがnumberに変換される', async () => {
      getSecurityEvent().count.mockResolvedValue(0)
      getSecurityEvent().groupBy.mockResolvedValue([])
      ;(mockPrisma as Record<string, unknown>).$queryRaw = vi.fn().mockResolvedValue([
        { ip_address: '1.2.3.4', cnt: BigInt(999) },
      ])

      const { getSecurityDashboard } = await import('@/lib/actions/admin/security')
      const result = await getSecurityDashboard()

      if ('error' in result) throw new Error('Expected dashboard, got error')
      expect(result.topFailedIps[0].count).toBe(999)
      expect(typeof result.topFailedIps[0].count).toBe('number')
    })

    it('eventsByTypeの_countがcount名に変換される', async () => {
      getSecurityEvent().count.mockResolvedValue(0)
      getSecurityEvent().groupBy.mockResolvedValue([
        { eventType: '2fa_toggle', _count: 7 },
      ])
      ;(mockPrisma as Record<string, unknown>).$queryRaw = vi.fn().mockResolvedValue([])

      const { getSecurityDashboard } = await import('@/lib/actions/admin/security')
      const result = await getSecurityDashboard()

      if ('error' in result) throw new Error('Expected dashboard, got error')
      expect(result.eventsByType).toEqual([
        { type: '2fa_toggle', count: 7 },
      ])
    })
  })

  // ============================================================
  // logSecurityEvent data accuracy (追加テスト)
  // ============================================================

  describe('logSecurityEvent データ精度', () => {
    it('details引数がJSON.parse可能な形でDBに保存される', async () => {
      getSecurityEvent().create.mockResolvedValue({ id: 'event-json' })

      const { logSecurityEvent } = await import('@/lib/services/security-events')
      const complexDetails = { reason: 'brute_force', attempts: 5, nested: { key: 'value' } }
      await logSecurityEvent({
        eventType: 'failed_login',
        details: complexDetails,
      })

      const createCall = getSecurityEvent().create.mock.calls[0][0]
      // details is passed through JSON.parse(JSON.stringify(...)) in implementation
      const storedDetails = createCall.data.details
      expect(() => JSON.parse(JSON.stringify(storedDetails))).not.toThrow()
      expect(storedDetails).toEqual(complexDetails)
    })

    it('userId/ipAddressがnullの場合も正常に記録される', async () => {
      getSecurityEvent().create.mockResolvedValue({ id: 'event-null' })

      const { logSecurityEvent } = await import('@/lib/services/security-events')
      await logSecurityEvent({
        eventType: 'system_event',
        userId: undefined,
        ipAddress: undefined,
      })

      expect(getSecurityEvent().create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'system_event',
          userId: null,
          ipAddress: null,
          userAgent: null,
        }),
      })
    })

    it('eventTypeが正しい値で記録される', async () => {
      getSecurityEvent().create.mockResolvedValue({ id: 'event-type' })

      const { logSecurityEvent } = await import('@/lib/services/security-events')

      for (const eventType of ['failed_login', 'password_change', '2fa_toggle', 'suspicious_activity']) {
        await logSecurityEvent({ eventType })
        const lastCall = getSecurityEvent().create.mock.calls.at(-1)![0]
        expect(lastCall.data.eventType).toBe(eventType)
      }
    })
  })

  // ============================================================
  // Dashboard calculation verification (追加テスト)
  // ============================================================

  describe('ダッシュボード計算精度', () => {
    it('failedLoginsのcreatedAt filterが24時間前と7日前を使用する', async () => {
      const now = Date.now()
      vi.spyOn(Date, 'now').mockReturnValue(now)

      getSecurityEvent().count.mockResolvedValue(0)
      getSecurityEvent().groupBy.mockResolvedValue([])
      ;(mockPrisma as Record<string, unknown>).$queryRaw = vi.fn().mockResolvedValue([])

      const { getSecurityDashboard } = await import('@/lib/actions/admin/security')
      await getSecurityDashboard()

      const countCalls = getSecurityEvent().count.mock.calls

      // 1st call: failedLoginsToday (24h ago)
      const todayFilter = countCalls[0][0].where.createdAt.gte
      expect(todayFilter).toBeInstanceOf(Date)
      expect(todayFilter.getTime()).toBeCloseTo(now - 24 * 60 * 60 * 1000, -2)

      // 2nd call: failedLoginsWeek (7 days ago)
      const weekFilter = countCalls[1][0].where.createdAt.gte
      expect(weekFilter).toBeInstanceOf(Date)
      expect(weekFilter.getTime()).toBeCloseTo(now - 7 * 24 * 60 * 60 * 1000, -2)

      vi.restoreAllMocks()
      // Restore auth mock after restoreAllMocks
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
    })

    it('eventsByTypeのgroupByがeventTypeフィールドで集約される', async () => {
      getSecurityEvent().count.mockResolvedValue(0)
      getSecurityEvent().groupBy.mockResolvedValue([])
      ;(mockPrisma as Record<string, unknown>).$queryRaw = vi.fn().mockResolvedValue([])

      const { getSecurityDashboard } = await import('@/lib/actions/admin/security')
      await getSecurityDashboard()

      expect(getSecurityEvent().groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['eventType'],
          _count: true,
        })
      )
    })

    it('topFailedIpsの$queryRawが呼ばれる', async () => {
      getSecurityEvent().count.mockResolvedValue(0)
      getSecurityEvent().groupBy.mockResolvedValue([])
      ;(mockPrisma as Record<string, unknown>).$queryRaw = vi.fn().mockResolvedValue([])

      const { getSecurityDashboard } = await import('@/lib/actions/admin/security')
      await getSecurityDashboard()

      expect((mockPrisma as Record<string, unknown>).$queryRaw).toHaveBeenCalled()
    })
  })

  // ============================================================
  // Filter combination (追加テスト)
  // ============================================================

  describe('フィルタ組み合わせ', () => {
    it('eventType + dateRangeを同時適用できる', async () => {
      getSecurityEvent().findMany.mockResolvedValue([])
      getSecurityEvent().count.mockResolvedValue(0)

      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      await getSecurityEvents({
        eventType: 'failed_login',
        dateFrom: '2024-01-01',
        dateTo: '2024-06-30',
      })

      expect(getSecurityEvent().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: 'failed_login',
            createdAt: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        })
      )
    })

    it('dateToのみ指定した場合もcreatedAtフィルタが適用される', async () => {
      getSecurityEvent().findMany.mockResolvedValue([])
      getSecurityEvent().count.mockResolvedValue(0)

      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      await getSecurityEvents({ dateTo: '2024-12-31' })

      expect(getSecurityEvent().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              lte: expect.any(Date),
            }),
          }),
        })
      )
    })

    it('dateToのみ指定した場合はgteが含まれない', async () => {
      getSecurityEvent().findMany.mockResolvedValue([])
      getSecurityEvent().count.mockResolvedValue(0)

      const { getSecurityEvents } = await import('@/lib/actions/admin/security')
      await getSecurityEvents({ dateTo: '2024-12-31' })

      const call = getSecurityEvent().findMany.mock.calls[0][0]
      expect(call.where.createdAt).not.toHaveProperty('gte')
      expect(call.where.createdAt.lte).toBeInstanceOf(Date)
    })
  })
})
