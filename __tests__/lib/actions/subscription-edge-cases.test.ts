// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.unmock('@/lib/actions/subscription')

import { createMockPrismaClient } from '../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// Stripeモック
const mockStripe = {
  customers: {
    create: vi.fn(),
  },
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn(),
    },
  },
  subscriptions: {
    retrieve: vi.fn(),
    cancel: vi.fn(),
  },
}
vi.mock('@/lib/stripe', () => ({
  stripe: mockStripe,
  STRIPE_PRICE_ID_MONTHLY: 'price_monthly',
  STRIPE_PRICE_ID_YEARLY: 'price_yearly',
}))

// ロガーモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('Subscription Actions Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    // requireActiveNonGuestUser が内部で suspension check のため
    // prisma.user.findUnique を 1 回呼ぶ。デフォルトで suspension=false を返し、
    // 個別テストでは mockResolvedValueOnce を 2 回チェーンして本体用も用意する。
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
  })

  // ============================================================
  // getSubscriptionStatus — edge cases
  // ============================================================
  describe('getSubscriptionStatus', () => {
    it('Stripe retrieveが失敗してもsubscriptionはnullとして返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: true,
        premiumExpiresAt: new Date(Date.now() + 86400000),
        stripeSubscriptionId: 'sub_error',
        stripeCustomerId: 'cus_123',
      })
      mockStripe.subscriptions.retrieve.mockRejectedValueOnce(
        new Error('Stripe API unavailable')
      )

      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(('isPremium' in result ? result.isPremium : undefined)).toBe(true)
      expect(('subscription' in result ? result.subscription : undefined)).toBeNull()
    })

    it('current_period_endがnullの場合はpremiumExpiresAtにフォールバック', async () => {
      const expiresAt = new Date(Date.now() + 86400000)
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: true,
        premiumExpiresAt: expiresAt,
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
      })
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        status: 'active',
        current_period_end: null,
        cancel_at_period_end: false,
      })

      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(('subscription' in result ? result.subscription : undefined)).not.toBeNull()
      expect(('subscription' in result ? result.subscription : undefined)?.currentPeriodEnd).toEqual(expiresAt)
    })

    it('current_period_endが0の場合はフォールバックする', async () => {
      const expiresAt = new Date(Date.now() + 86400000)
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: true,
        premiumExpiresAt: expiresAt,
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
      })
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        status: 'active',
        current_period_end: 0,
        cancel_at_period_end: false,
      })

      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(('subscription' in result ? result.subscription : undefined)?.currentPeriodEnd).toEqual(expiresAt)
    })

    it('premiumExpiresAtもnullの場合は30日後にフォールバック', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: true,
        premiumExpiresAt: null,
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
      })
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        status: 'active',
        current_period_end: null,
        cancel_at_period_end: false,
      })

      const now = Date.now()
      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(('subscription' in result ? result.subscription : undefined)).not.toBeNull()
      // 30日後のフォールバック（THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000）
      const periodEnd = ('subscription' in result ? result.subscription : undefined)!.currentPeriodEnd as Date
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
      expect(periodEnd.getTime()).toBeGreaterThanOrEqual(now + thirtyDaysMs - 1000)
      expect(periodEnd.getTime()).toBeLessThanOrEqual(now + thirtyDaysMs + 1000)
    })

    it('cancelAtPeriodEndがtrueの場合を正しく返す', async () => {
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + 1)

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: true,
        premiumExpiresAt: futureDate,
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
      })
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        status: 'active',
        current_period_end: Math.floor(futureDate.getTime() / 1000),
        cancel_at_period_end: true,
      })

      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(('subscription' in result ? result.subscription : undefined)?.cancelAtPeriodEnd).toBe(true)
      expect(('subscription' in result ? result.subscription : undefined)?.status).toBe('active')
    })

    it('ステータスがcanceledの場合を正しく返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: false,
        premiumExpiresAt: null,
        stripeSubscriptionId: 'sub_canceled',
        stripeCustomerId: 'cus_123',
      })
      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        status: 'canceled',
        current_period_end: Math.floor(Date.now() / 1000) - 3600,
        cancel_at_period_end: false,
      })

      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(('isPremium' in result ? result.isPremium : undefined)).toBe(false)
      expect(('subscription' in result ? result.subscription : undefined)?.status).toBe('canceled')
    })
  })

  // ============================================================
  // getPaymentHistory — edge cases
  // ============================================================
  describe('getPaymentHistory', () => {
    it('支払い履歴をcreatedAtの降順で取得する', async () => {
      const payments = [
        { id: 'pay-2', amount: 980, status: 'succeeded', createdAt: new Date('2025-02-01') },
        { id: 'pay-1', amount: 980, status: 'succeeded', createdAt: new Date('2025-01-01') },
      ]
      mockPrisma.payment.findMany.mockResolvedValueOnce(payments)

      const { getPaymentHistory } = await import('@/lib/actions/subscription')
      const result = await getPaymentHistory()

      expect(('payments' in result ? result.payments : undefined)).toEqual(payments)
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      )
    })

    it('取得件数がDEFAULT_PAGE_LIMITに制限される', async () => {
      mockPrisma.payment.findMany.mockResolvedValueOnce([])

      const { getPaymentHistory } = await import('@/lib/actions/subscription')
      await getPaymentHistory()

      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: expect.any(Number),
        })
      )
    })
  })

  // ============================================================
  // cancelSubscriptionImmediately — edge cases
  // ============================================================
  describe('cancelSubscriptionImmediately', () => {
    it('Stripe解約後にDB更新でisPremiumをfalseにする', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuspended: false })
        .mockResolvedValueOnce({
          stripeSubscriptionId: 'sub_123',
        })
      mockStripe.subscriptions.cancel.mockResolvedValueOnce({})
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          isPremium: false,
          stripeSubscriptionId: null,
          premiumExpiresAt: null,
        },
      })
    })

    it('ユーザーが見つからない場合（findUniqueがnull）はエラー', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toMatchObject({ error: 'サブスクリプション情報が見つかりません' })
    })
  })

  // ============================================================
  // getMembershipInfo — edge cases
  // ============================================================
  describe('getMembershipInfo', () => {
    it('ユーザーが見つからない場合は無料会員として扱う', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { getMembershipInfo } = await import('@/lib/actions/subscription')
      const result = await getMembershipInfo()

      expect(result.isPremium).toBeFalsy()
      expect(result.limits.maxPostLength).toBe(500)
      expect(result.limits.canSchedulePost).toBe(false)
    })

    it('isPremiumがtrueでpremiumExpiresAtがnullの場合はプレミアムとして扱う', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: true,
        premiumExpiresAt: null,
      })

      const { getMembershipInfo } = await import('@/lib/actions/subscription')
      const result = await getMembershipInfo()

      expect(result.isPremium).toBe(true)
      expect(result.limits.maxPostLength).toBe(2000)
      expect(result.limits.maxImages).toBe(6)
      expect(result.limits.maxVideos).toBe(1)
      expect(result.limits.canSchedulePost).toBe(true)
      expect(result.limits.canViewAnalytics).toBe(true)
    })

    it('isPremiumがfalseの場合はpremiumExpiresAtに関係なく無料会員', async () => {
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + 1)

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: false,
        premiumExpiresAt: futureDate,
      })

      const { getMembershipInfo } = await import('@/lib/actions/subscription')
      const result = await getMembershipInfo()

      expect(result.isPremium).toBeFalsy()
      expect(result.limits.maxPostLength).toBe(500)
    })
  })

  // ============================================================
  // createCheckoutSession — edge cases
  // ============================================================
  describe('createCheckoutSession', () => {
    it('デフォルトのpriceTypeは月額になる', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuspended: false })
        .mockResolvedValueOnce({
          email: 'test@example.com',
          stripeCustomerId: 'cus_123',
          isPremium: false,
        })
      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session',
      })

      const { createCheckoutSession } = await import('@/lib/actions/subscription')
      await createCheckoutSession()

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_monthly', quantity: 1 }],
        })
      )
    })

    it('新規顧客作成時にstripeCustomerIdをDBに保存する', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuspended: false })
        .mockResolvedValueOnce({
          email: 'new@example.com',
          stripeCustomerId: null,
          isPremium: false,
        })
      mockStripe.customers.create.mockResolvedValueOnce({ id: 'cus_new_123' })
      mockPrisma.user.update.mockResolvedValueOnce({})
      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session',
      })

      const { createCheckoutSession } = await import('@/lib/actions/subscription')
      await createCheckoutSession('monthly')

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        metadata: { userId: 'u1' },
      })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { stripeCustomerId: 'cus_new_123' },
      })
    })
  })
})
