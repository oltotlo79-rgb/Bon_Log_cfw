// @vitest-environment node

import { vi } from 'vitest'
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

// rate-limit モック: in-memory rate limiter のテスト間状態汚染を避ける
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 999, resetTime: 0 }),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 999, resetTime: 0 }),
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 999, resetTime: 0 }),
  RATE_LIMITS: {},
}))

describe('Subscription Actions Extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    // requireActiveNonGuestUser が内部で suspension check のため
    // prisma.user.findUnique を 1 回呼ぶ。各テストは個別の mockResolvedValueOnce を
    // セットして検索の戻り値を上書きする (今回は suspension check 用 + 本体用 2 回)。
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
  })

  // ============================================================
  // createCheckoutSession
  // ============================================================

  describe('createCheckoutSession', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createCheckoutSession } = await import('@/lib/actions/subscription')
      const result = await createCheckoutSession('monthly')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('月額セッションを作成できる', async () => {
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
      const result = await createCheckoutSession('monthly')

      expect(('url' in result ? result.url : undefined)).toBe('https://checkout.stripe.com/session')
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_monthly', quantity: 1 }],
        })
      )
    })

    it('年額セッションを作成できる', async () => {
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
      await createCheckoutSession('yearly')

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_yearly', quantity: 1 }],
        })
      )
    })

    it('すでに有料会員の場合はエラーを返す', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuspended: false })
        .mockResolvedValueOnce({
          email: 'test@example.com',
          stripeCustomerId: 'cus_123',
          isPremium: true,
        })

      const { createCheckoutSession } = await import('@/lib/actions/subscription')
      const result = await createCheckoutSession('monthly')

      expect(result).toMatchObject({ error: 'すでに有料会員です' })
    })
  })

  // ============================================================
  // createCustomerPortalSession
  // ============================================================

  describe('createCustomerPortalSession', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createCustomerPortalSession } = await import('@/lib/actions/subscription')
      const result = await createCustomerPortalSession()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ポータルセッションを作成できる', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuspended: false })
        .mockResolvedValueOnce({
          stripeCustomerId: 'cus_123',
        })
      mockStripe.billingPortal.sessions.create.mockResolvedValueOnce({
        url: 'https://billing.stripe.com/portal',
      })

      const { createCustomerPortalSession } = await import('@/lib/actions/subscription')
      const result = await createCustomerPortalSession()

      expect(('url' in result ? result.url : undefined)).toBe('https://billing.stripe.com/portal')
    })

    it('Stripe顧客IDがない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuspended: false })
        .mockResolvedValueOnce({
          stripeCustomerId: null,
        })

      const { createCustomerPortalSession } = await import('@/lib/actions/subscription')
      const result = await createCustomerPortalSession()

      expect(result).toMatchObject({ error: 'サブスクリプション情報が見つかりません' })
    })
  })

  // ============================================================
  // getSubscriptionStatus
  // ============================================================

  describe('getSubscriptionStatus', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('プレミアムステータスを返す', async () => {
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
        cancel_at_period_end: false,
      })

      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(('isPremium' in result ? result.isPremium : undefined)).toBe(true)
      expect(('subscription' in result ? result.subscription : undefined)?.status).toBe('active')
    })

    it('非プレミアムステータスを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: false,
        premiumExpiresAt: null,
        stripeSubscriptionId: null,
        stripeCustomerId: null,
      })

      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(('isPremium' in result ? result.isPremium : undefined)).toBe(false)
      expect(('subscription' in result ? result.subscription : undefined)).toBeNull()
    })
  })

  // ============================================================
  // getPaymentHistory
  // ============================================================

  describe('getPaymentHistory', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getPaymentHistory } = await import('@/lib/actions/subscription')
      const result = await getPaymentHistory()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('支払い履歴を返す', async () => {
      const mockPayments = [
        { id: 'pay-1', amount: 980, status: 'succeeded', createdAt: new Date() },
        { id: 'pay-2', amount: 980, status: 'succeeded', createdAt: new Date() },
      ]
      mockPrisma.payment.findMany.mockResolvedValueOnce(mockPayments)

      const { getPaymentHistory } = await import('@/lib/actions/subscription')
      const result = await getPaymentHistory()

      expect(('payments' in result ? result.payments : undefined)).toHaveLength(2)
    })

    it('空の支払い履歴を返す', async () => {
      mockPrisma.payment.findMany.mockResolvedValueOnce([])

      const { getPaymentHistory } = await import('@/lib/actions/subscription')
      const result = await getPaymentHistory()

      expect(('payments' in result ? result.payments : undefined)).toHaveLength(0)
    })
  })

  // ============================================================
  // cancelSubscriptionImmediately
  // ============================================================

  describe('cancelSubscriptionImmediately', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('サブスクリプションを即時解約できる', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuspended: false })
        .mockResolvedValueOnce({ stripeSubscriptionId: 'sub_123' })
        .mockResolvedValueOnce({ isPremium: true })
      mockStripe.subscriptions.cancel.mockResolvedValueOnce({})
      mockPrisma.premiumEntitlement.findUnique.mockResolvedValueOnce(null)
      mockPrisma.premiumEntitlement.upsert.mockResolvedValueOnce({
        id: 'entitlement-1',
        userId: 'u1',
        provider: 'stripe',
        status: 'expired',
      })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([])
      mockPrisma.user.update.mockResolvedValue({})

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toEqual({ success: true })
      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123')
    })

    it('サブスクリプションがない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuspended: false })
        .mockResolvedValueOnce({
          stripeSubscriptionId: null,
        })

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toMatchObject({ error: 'サブスクリプション情報が見つかりません' })
    })
  })

  // ============================================================
  // getMembershipInfo
  // ============================================================

  describe('getMembershipInfo', async () => {
    it('未ログイン時は無料会員の制限を返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getMembershipInfo } = await import('@/lib/actions/subscription')
      const result = await getMembershipInfo()

      expect(result.isPremium).toBe(false)
      expect(result.limits.maxPostLength).toBe(500)
    })

    it('プレミアム会員の制限を返す', async () => {
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + 1)

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: true,
        premiumExpiresAt: futureDate,
      })

      const { getMembershipInfo } = await import('@/lib/actions/subscription')
      const result = await getMembershipInfo()

      expect(result.isPremium).toBe(true)
      expect(result.limits.maxPostLength).toBe(2000)
      expect(result.limits.canViewAnalytics).toBe(true)
    })
  })
})
