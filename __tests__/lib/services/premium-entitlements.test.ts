// @vitest-environment node
/**
 * lib/services/premium-entitlements のユニットテスト
 *
 * Track3「provider 別 entitlement」の受入条件を網羅する:
 * - applyEntitlementEvent の部分更新セマンティクス・out-of-order 防御
 * - recomputeUserPremiumAggregate の OR 集約・premiumExpiresAt null semantics
 * - applyEntitlementEventAndRecompute / expireOverdueEntitlements(ForUser) /
 *   findUsersWithOverdueEntitlements の cron 向け副作用契約
 * - 複数 provider（Stripe/RevenueCat）の組み合わせシナリオ
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('lib/services/premium-entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ──────────────────────────────────────────────────
  // applyEntitlementEvent
  // ──────────────────────────────────────────────────

  describe('applyEntitlementEvent', () => {
    it('既存 entitlement が無ければ create（status 省略時は active が既定値）', async () => {
      const { applyEntitlementEvent } = await import('@/lib/services/premium-entitlements')
      mockPrisma.premiumEntitlement.findUnique.mockResolvedValueOnce(null)
      mockPrisma.premiumEntitlement.upsert.mockResolvedValueOnce({ id: 'ent-1' })

      const eventAt = new Date('2026-01-01T00:00:00Z')
      const result = await applyEntitlementEvent(mockPrisma, {
        userId: 'user-1',
        provider: 'stripe',
        providerRef: 'sub_1',
        expiresAt: new Date('2026-02-01T00:00:00Z'),
        eventAt,
        eventId: 'evt-1',
      })

      expect(result.applied).toBe(true)
      expect(mockPrisma.premiumEntitlement.upsert).toHaveBeenCalledWith({
        where: { userId_provider: { userId: 'user-1', provider: 'stripe' } },
        create: expect.objectContaining({
          provider: 'stripe',
          status: 'active',
          providerRef: 'sub_1',
          cancelAtPeriodEnd: false,
          expiresAt: new Date('2026-02-01T00:00:00Z'),
          providerEventAt: eventAt,
          lastEventId: 'evt-1',
        }),
        // status を指定していないため update 側には含まれない（部分更新セマンティクス）
        update: {
          providerRef: 'sub_1',
          expiresAt: new Date('2026-02-01T00:00:00Z'),
          providerEventAt: eventAt,
          lastEventId: 'evt-1',
        },
      })
    })

    it('未指定フィールドは既存値を維持する部分更新セマンティクス', async () => {
      const { applyEntitlementEvent } = await import('@/lib/services/premium-entitlements')
      const existing = {
        id: 'ent-1',
        userId: 'user-1',
        provider: 'stripe',
        providerRef: 'sub_old',
        productId: 'prod_old',
        status: 'active',
        cancelAtPeriodEnd: false,
        expiresAt: new Date('2026-01-01T00:00:00Z'),
        providerEventAt: new Date('2026-01-01T00:00:00Z'),
        lastEventId: 'evt-0',
      }
      mockPrisma.premiumEntitlement.findUnique.mockResolvedValueOnce(existing)
      mockPrisma.premiumEntitlement.upsert.mockResolvedValueOnce({ ...existing, expiresAt: new Date('2026-03-01T00:00:00Z') })

      // status / providerRef / productId を指定せず expiresAt のみ更新
      // (invoice.payment_succeeded の期限延長パターンを模す)
      const eventAt = new Date('2026-02-01T00:00:00Z')
      await applyEntitlementEvent(mockPrisma, {
        userId: 'user-1',
        provider: 'stripe',
        expiresAt: new Date('2026-03-01T00:00:00Z'),
        eventAt,
        eventId: 'evt-1',
      })

      const upsertCall = mockPrisma.premiumEntitlement.upsert.mock.calls[0][0]
      expect(upsertCall.update).toEqual({
        expiresAt: new Date('2026-03-01T00:00:00Z'),
        providerEventAt: eventAt,
        lastEventId: 'evt-1',
      })
    })

    it('expiresAt を明示的に null にすると期限をクリアする（undefined とは区別）', async () => {
      const { applyEntitlementEvent } = await import('@/lib/services/premium-entitlements')
      mockPrisma.premiumEntitlement.findUnique.mockResolvedValueOnce({
        id: 'ent-1',
        userId: 'user-1',
        provider: 'stripe',
        status: 'active',
        expiresAt: new Date('2026-01-01T00:00:00Z'),
        providerEventAt: new Date('2026-01-01T00:00:00Z'),
      })
      mockPrisma.premiumEntitlement.upsert.mockResolvedValueOnce({})

      await applyEntitlementEvent(mockPrisma, {
        userId: 'user-1',
        provider: 'stripe',
        status: 'expired',
        expiresAt: null,
        eventAt: new Date('2026-02-01T00:00:00Z'),
        eventId: 'evt-2',
      })

      const upsertCall = mockPrisma.premiumEntitlement.upsert.mock.calls[0][0]
      expect(upsertCall.update.expiresAt).toBeNull()
    })

    it('out-of-order 防御: 既存 providerEventAt より古い eventAt は無視する（applied=false）', async () => {
      const { applyEntitlementEvent } = await import('@/lib/services/premium-entitlements')
      const existing = {
        id: 'ent-1',
        userId: 'user-1',
        provider: 'stripe',
        status: 'active',
        expiresAt: new Date('2026-02-01T00:00:00Z'),
        providerEventAt: new Date('2026-01-10T00:00:00Z'),
      }
      mockPrisma.premiumEntitlement.findUnique.mockResolvedValueOnce(existing)

      const result = await applyEntitlementEvent(mockPrisma, {
        userId: 'user-1',
        provider: 'stripe',
        status: 'expired',
        expiresAt: null,
        eventAt: new Date('2026-01-05T00:00:00Z'), // 既存より古い
        eventId: 'evt-stale',
      })

      expect(result.applied).toBe(false)
      expect(result.entitlement).toEqual(existing)
      expect(mockPrisma.premiumEntitlement.upsert).not.toHaveBeenCalled()
    })

    it('古い expiration が新しい renewal の後に届いても active を巻き戻さない', async () => {
      const { applyEntitlementEvent } = await import('@/lib/services/premium-entitlements')
      const renewalEventAt = new Date('2026-01-10T00:00:00Z')
      const staleExpirationEventAt = new Date('2026-01-05T00:00:00Z')

      // 1) renewal (新規作成)
      mockPrisma.premiumEntitlement.findUnique.mockResolvedValueOnce(null)
      const createdEntitlement = {
        id: 'ent-1',
        userId: 'user-1',
        provider: 'stripe',
        status: 'active',
        expiresAt: new Date('2026-02-01T00:00:00Z'),
        providerEventAt: renewalEventAt,
        cancelAtPeriodEnd: false,
        providerRef: 'sub_1',
        productId: null,
        lastEventId: 'evt-renewal',
      }
      mockPrisma.premiumEntitlement.upsert.mockResolvedValueOnce(createdEntitlement)

      const renewalResult = await applyEntitlementEvent(mockPrisma, {
        userId: 'user-1',
        provider: 'stripe',
        status: 'active',
        expiresAt: new Date('2026-02-01T00:00:00Z'),
        eventAt: renewalEventAt,
        eventId: 'evt-renewal',
      })
      expect(renewalResult.applied).toBe(true)

      // 2) renewal より古い expiration イベントが後から届く（webhook リトライ等）
      mockPrisma.premiumEntitlement.findUnique.mockResolvedValueOnce(createdEntitlement)

      const staleResult = await applyEntitlementEvent(mockPrisma, {
        userId: 'user-1',
        provider: 'stripe',
        status: 'expired',
        expiresAt: null,
        eventAt: staleExpirationEventAt,
        eventId: 'evt-stale-expiration',
      })

      expect(staleResult.applied).toBe(false)
      // active な renewal の状態が巻き戻されていない
      expect(staleResult.entitlement.status).toBe('active')
      expect(mockPrisma.premiumEntitlement.upsert).toHaveBeenCalledTimes(1)
    })

    it('eventAt が null（取得不可）の場合は順序判定をスキップし常に適用する', async () => {
      const { applyEntitlementEvent } = await import('@/lib/services/premium-entitlements')
      mockPrisma.premiumEntitlement.findUnique.mockResolvedValueOnce({
        id: 'ent-1',
        userId: 'user-1',
        provider: 'revenuecat',
        status: 'active',
        providerEventAt: new Date('2026-01-10T00:00:00Z'),
      })
      mockPrisma.premiumEntitlement.upsert.mockResolvedValueOnce({})

      const result = await applyEntitlementEvent(mockPrisma, {
        userId: 'user-1',
        provider: 'revenuecat',
        cancelAtPeriodEnd: true,
        eventAt: null,
        eventId: null,
      })

      expect(result.applied).toBe(true)
      // eventAt 取得不可時は既知の providerEventAt を保持する（次回以降の比較基準を維持するため）
      const upsertCall = mockPrisma.premiumEntitlement.upsert.mock.calls[0][0]
      expect(upsertCall.update.providerEventAt).toEqual(new Date('2026-01-10T00:00:00Z'))
    })
  })

  // ──────────────────────────────────────────────────
  // recomputeUserPremiumAggregate
  // ──────────────────────────────────────────────────

  describe('recomputeUserPremiumAggregate', () => {
    it('ユーザーが存在しない場合は false を返し user.update を呼ばない', async () => {
      const { recomputeUserPremiumAggregate } = await import('@/lib/services/premium-entitlements')
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([])

      const result = await recomputeUserPremiumAggregate(mockPrisma, 'ghost-user')

      expect(result).toEqual({ isPremium: false, premiumExpiresAt: null, wasPremiumBefore: false })
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('有効な entitlement が 1 件も無ければ isPremium=false, premiumExpiresAt=null', async () => {
      const { recomputeUserPremiumAggregate } = await import('@/lib/services/premium-entitlements')
      mockPrisma.user.findUnique.mockResolvedValueOnce({ isPremium: true })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'expired', expiresAt: null },
      ])
      mockPrisma.user.update.mockResolvedValueOnce({})

      const result = await recomputeUserPremiumAggregate(mockPrisma, 'user-1')

      expect(result).toEqual({ isPremium: false, premiumExpiresAt: null, wasPremiumBefore: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isPremium: false, premiumExpiresAt: null },
      })
    })

    it('有効な entitlement に expiresAt=null（期限不明）が含まれる場合は premiumExpiresAt=null', async () => {
      const { recomputeUserPremiumAggregate } = await import('@/lib/services/premium-entitlements')
      mockPrisma.user.findUnique.mockResolvedValueOnce({ isPremium: false })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'active', expiresAt: null },
      ])
      mockPrisma.user.update.mockResolvedValueOnce({})

      const result = await recomputeUserPremiumAggregate(mockPrisma, 'user-1')

      expect(result.isPremium).toBe(true)
      expect(result.premiumExpiresAt).toBeNull()
    })

    it('有効な entitlement が全て expiresAt を持つ場合は最大値を premiumExpiresAt にする', async () => {
      const { recomputeUserPremiumAggregate } = await import('@/lib/services/premium-entitlements')
      mockPrisma.user.findUnique.mockResolvedValueOnce({ isPremium: false })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'active', expiresAt: new Date('2026-03-01T00:00:00Z') },
        { status: 'active', expiresAt: new Date('2026-05-01T00:00:00Z') },
      ])
      mockPrisma.user.update.mockResolvedValueOnce({})

      // 明示的に過去の基準時刻を渡す（デフォルトの現在時刻だとテストデータの日付が
      // 実行時点より過去になり得るため、expiresAt の前後関係を固定して検証する）
      const now = new Date('2026-01-01T00:00:00Z')
      const result = await recomputeUserPremiumAggregate(mockPrisma, 'user-1', now)

      expect(result.isPremium).toBe(true)
      expect(result.premiumExpiresAt).toEqual(new Date('2026-05-01T00:00:00Z'))
    })

    it('expired 判定は now 基準（期限切れの expiresAt は無効扱い）', async () => {
      const { recomputeUserPremiumAggregate } = await import('@/lib/services/premium-entitlements')
      mockPrisma.user.findUnique.mockResolvedValueOnce({ isPremium: true })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'active', expiresAt: new Date('2020-01-01T00:00:00Z') },
      ])
      mockPrisma.user.update.mockResolvedValueOnce({})

      const now = new Date('2026-01-01T00:00:00Z')
      const result = await recomputeUserPremiumAggregate(mockPrisma, 'user-1', now)

      expect(result.isPremium).toBe(false)
      expect(result.premiumExpiresAt).toBeNull()
    })

    it('status=active でも cancelAtPeriodEnd=true なら期限までは有効扱い', async () => {
      const { recomputeUserPremiumAggregate } = await import('@/lib/services/premium-entitlements')
      mockPrisma.user.findUnique.mockResolvedValueOnce({ isPremium: true })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'active', expiresAt: new Date('2026-06-01T00:00:00Z'), cancelAtPeriodEnd: true },
      ])
      mockPrisma.user.update.mockResolvedValueOnce({})

      const now = new Date('2026-01-01T00:00:00Z')
      const result = await recomputeUserPremiumAggregate(mockPrisma, 'user-1', now)

      expect(result.isPremium).toBe(true)
      expect(result.premiumExpiresAt).toEqual(new Date('2026-06-01T00:00:00Z'))
    })

    // ──────────────────────────────────────────────────
    // 複数 provider の組み合わせシナリオ（Track3 受入条件）
    // ──────────────────────────────────────────────────

    it('Stripe active → RC active → Stripe expired: aggregate は true を維持する', async () => {
      const { recomputeUserPremiumAggregate } = await import('@/lib/services/premium-entitlements')
      mockPrisma.user.findUnique.mockResolvedValueOnce({ isPremium: true })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'expired', expiresAt: null }, // stripe（失効済み）
        { status: 'active', expiresAt: new Date('2026-07-01T00:00:00Z') }, // revenuecat（有効）
      ])
      mockPrisma.user.update.mockResolvedValueOnce({})

      const now = new Date('2026-01-01T00:00:00Z')
      const result = await recomputeUserPremiumAggregate(mockPrisma, 'user-1', now)

      expect(result.isPremium).toBe(true)
      expect(result.premiumExpiresAt).toEqual(new Date('2026-07-01T00:00:00Z'))
    })

    it('RC active → Stripe active → RC expired: aggregate は true を維持する', async () => {
      const { recomputeUserPremiumAggregate } = await import('@/lib/services/premium-entitlements')
      mockPrisma.user.findUnique.mockResolvedValueOnce({ isPremium: true })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'expired', expiresAt: null }, // revenuecat（失効済み）
        { status: 'active', expiresAt: new Date('2026-08-01T00:00:00Z') }, // stripe（有効）
      ])
      mockPrisma.user.update.mockResolvedValueOnce({})

      const now = new Date('2026-01-01T00:00:00Z')
      const result = await recomputeUserPremiumAggregate(mockPrisma, 'user-1', now)

      expect(result.isPremium).toBe(true)
      expect(result.premiumExpiresAt).toEqual(new Date('2026-08-01T00:00:00Z'))
    })

    it('両方 expired なら isPremium=false', async () => {
      const { recomputeUserPremiumAggregate } = await import('@/lib/services/premium-entitlements')
      mockPrisma.user.findUnique.mockResolvedValueOnce({ isPremium: true })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'expired', expiresAt: null },
        { status: 'expired', expiresAt: null },
      ])
      mockPrisma.user.update.mockResolvedValueOnce({})

      const result = await recomputeUserPremiumAggregate(mockPrisma, 'user-1')

      expect(result).toMatchObject({ isPremium: false, premiumExpiresAt: null })
    })
  })

  // ──────────────────────────────────────────────────
  // applyEntitlementEventAndRecompute（webhook 用トランザクションラッパー）
  // ──────────────────────────────────────────────────

  describe('applyEntitlementEventAndRecompute', () => {
    it('apply と recompute を単一トランザクションで実行し結果を統合して返す', async () => {
      const { applyEntitlementEventAndRecompute } = await import('@/lib/services/premium-entitlements')

      mockPrisma.premiumEntitlement.findUnique.mockResolvedValueOnce(null)
      mockPrisma.premiumEntitlement.upsert.mockResolvedValueOnce({ id: 'ent-1' })
      mockPrisma.user.findUnique.mockResolvedValueOnce({ isPremium: false })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'active', expiresAt: new Date('2026-04-01T00:00:00Z') },
      ])
      mockPrisma.user.update.mockResolvedValueOnce({})

      const result = await applyEntitlementEventAndRecompute(
        {
          userId: 'user-1',
          provider: 'stripe',
          status: 'active',
          expiresAt: new Date('2026-04-01T00:00:00Z'),
          eventAt: new Date('2026-01-01T00:00:00Z'),
          eventId: 'evt-1',
        },
        // 明示的に過去の基準時刻を渡し、expiresAt との前後関係を固定する
        new Date('2026-01-01T00:00:00Z'),
      )

      expect(mockPrisma.$transaction).toHaveBeenCalled()
      expect(result).toEqual({
        applied: true,
        wasPremiumBefore: false,
        isPremiumAfter: true,
        premiumExpiresAt: new Date('2026-04-01T00:00:00Z'),
      })
    })
  })

  // ──────────────────────────────────────────────────
  // expireOverdueEntitlements / expireOverdueEntitlementsForUser
  // ──────────────────────────────────────────────────

  describe('expireOverdueEntitlements', () => {
    it('期限切れの active entitlement を expired に確定し件数を返す', async () => {
      const { expireOverdueEntitlements } = await import('@/lib/services/premium-entitlements')
      mockPrisma.premiumEntitlement.updateMany.mockResolvedValueOnce({ count: 2 })

      const now = new Date('2026-01-01T00:00:00Z')
      const count = await expireOverdueEntitlements(mockPrisma, 'user-1', now)

      expect(count).toBe(2)
      expect(mockPrisma.premiumEntitlement.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'active', expiresAt: { not: null, lt: now } },
        data: { status: 'expired' },
      })
    })
  })

  describe('expireOverdueEntitlementsForUser', () => {
    it('一方の provider のみ期限切れなら、他方が有効な限り isPremiumAfter=true（副作用なし）', async () => {
      const { expireOverdueEntitlementsForUser } = await import('@/lib/services/premium-entitlements')

      mockPrisma.premiumEntitlement.updateMany.mockResolvedValueOnce({ count: 1 }) // stripe だけ期限切れ確定
      mockPrisma.user.findUnique.mockResolvedValueOnce({ isPremium: true })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'expired', expiresAt: null }, // stripe（失効確定済み）
        { status: 'active', expiresAt: new Date('2026-09-01T00:00:00Z') }, // revenuecat（有効）
      ])
      mockPrisma.user.update.mockResolvedValueOnce({})

      const now = new Date('2026-01-01T00:00:00Z')
      const result = await expireOverdueEntitlementsForUser('user-1', now)

      expect(result.wasPremiumBefore).toBe(true)
      expect(result.isPremiumAfter).toBe(true)
      expect(result.expiredCount).toBe(1)
    })

    it('最後に有効だった provider が失効した時だけ true→false の transition を返す', async () => {
      const { expireOverdueEntitlementsForUser } = await import('@/lib/services/premium-entitlements')

      mockPrisma.premiumEntitlement.updateMany.mockResolvedValueOnce({ count: 1 })
      mockPrisma.user.findUnique.mockResolvedValueOnce({ isPremium: true })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'expired', expiresAt: null },
      ])
      mockPrisma.user.update.mockResolvedValueOnce({})

      const now = new Date('2026-01-01T00:00:00Z')
      const result = await expireOverdueEntitlementsForUser('user-1', now)

      expect(result.wasPremiumBefore).toBe(true)
      expect(result.isPremiumAfter).toBe(false)
      expect(result.expiredCount).toBe(1)
    })

    it('同一ユーザーへの重複実行では 2 回目の expiredCount は 0（status が既に expired のため再ヒットしない）', async () => {
      const { expireOverdueEntitlementsForUser } = await import('@/lib/services/premium-entitlements')

      // 1 回目: 失効確定 + true→false transition
      mockPrisma.premiumEntitlement.updateMany.mockResolvedValueOnce({ count: 1 })
      mockPrisma.user.findUnique.mockResolvedValueOnce({ isPremium: true })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([{ status: 'expired', expiresAt: null }])
      mockPrisma.user.update.mockResolvedValueOnce({})

      const now = new Date('2026-01-01T00:00:00Z')
      const first = await expireOverdueEntitlementsForUser('user-1', now)
      expect(first.wasPremiumBefore).toBe(true)
      expect(first.isPremiumAfter).toBe(false)
      expect(first.expiredCount).toBe(1)

      // 2 回目（同日 cron 再実行等）: updateMany の対象条件（status='active'）に
      // 既に一致しないため count=0、aggregate も false のまま transition なし
      mockPrisma.premiumEntitlement.updateMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.user.findUnique.mockResolvedValueOnce({ isPremium: false })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([{ status: 'expired', expiresAt: null }])
      mockPrisma.user.update.mockResolvedValueOnce({})

      const second = await expireOverdueEntitlementsForUser('user-1', now)
      expect(second.expiredCount).toBe(0)
      expect(second.wasPremiumBefore).toBe(false)
      expect(second.isPremiumAfter).toBe(false)
    })
  })

  describe('findUsersWithOverdueEntitlements', () => {
    it('status=active かつ期限切れの entitlement を持つユーザー ID を重複なく返す', async () => {
      const { findUsersWithOverdueEntitlements } = await import('@/lib/services/premium-entitlements')
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ])

      const now = new Date('2026-01-01T00:00:00Z')
      const result = await findUsersWithOverdueEntitlements(now)

      expect(result).toEqual(['user-1', 'user-2'])
      expect(mockPrisma.premiumEntitlement.findMany).toHaveBeenCalledWith({
        where: { status: 'active', expiresAt: { not: null, lt: now } },
        select: { userId: true },
        distinct: ['userId'],
      })
    })

    it('該当ユーザーがいなければ空配列を返す', async () => {
      const { findUsersWithOverdueEntitlements } = await import('@/lib/services/premium-entitlements')
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([])

      const result = await findUsersWithOverdueEntitlements(new Date())

      expect(result).toEqual([])
    })
  })
})
