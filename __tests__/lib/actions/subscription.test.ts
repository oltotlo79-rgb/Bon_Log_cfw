// @vitest-environment node
import { vi } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

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

// requireActiveNonGuestUser を mock：内部の DB suspension チェックを回避
// enforceUserRateLimit も mock: in-memory rate limiter のテスト間状態汚染を避ける
vi.mock('@/lib/actions/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/actions/utils')>('@/lib/actions/utils')
  return {
    ...actual,
    requireActiveNonGuestUser: async () => {
      const session = await mockAuth()
      if (!session?.user?.id) return { error: '認証が必要です' }
      return { userId: session.user.id }
    },
    enforceUserRateLimit: async () => null,
  }
})

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
    debug: vi.fn(),
  },
}))

describe('Subscription Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  })

  // ============================================================
  // createCheckoutSession
  // ============================================================

  describe('createCheckoutSession', async () => {
    it('Checkout Sessionを作成できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: mockUser.email,
        stripeCustomerId: 'cus_existing',
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
          customer: 'cus_existing',
          mode: 'subscription',
          line_items: [{ price: 'price_monthly', quantity: 1 }],
        })
      )
    })

    it('新規Stripe顧客を作成する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: mockUser.email,
        stripeCustomerId: null,
        isPremium: false,
      })
      mockStripe.customers.create.mockResolvedValueOnce({
        id: 'cus_new',
      })
      mockPrisma.user.update.mockResolvedValueOnce({})
      mockStripe.checkout.sessions.create.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session',
      })

      const { createCheckoutSession } = await import('@/lib/actions/subscription')
      const result = await createCheckoutSession('monthly')

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: mockUser.email,
        metadata: { userId: mockUser.id },
      })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { stripeCustomerId: 'cus_new' },
      })
      expect(('url' in result ? result.url : undefined)).toBeDefined()
    })

    it('年額プランを選択できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: mockUser.email,
        stripeCustomerId: 'cus_existing',
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

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { createCheckoutSession } = await import('@/lib/actions/subscription')
      const result = await createCheckoutSession('monthly')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { createCheckoutSession } = await import('@/lib/actions/subscription')
      const result = await createCheckoutSession('monthly')

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('すでに有料会員の場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: mockUser.email,
        stripeCustomerId: 'cus_existing',
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
    it('カスタマーポータルSessionを作成できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        stripeCustomerId: 'cus_existing',
      })
      mockStripe.billingPortal.sessions.create.mockResolvedValueOnce({
        url: 'https://billing.stripe.com/portal',
      })

      const { createCustomerPortalSession } = await import('@/lib/actions/subscription')
      const result = await createCustomerPortalSession()

      expect(('url' in result ? result.url : undefined)).toBe('https://billing.stripe.com/portal')
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { createCustomerPortalSession } = await import('@/lib/actions/subscription')
      const result = await createCustomerPortalSession()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('Stripe顧客IDがない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
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
    it('サブスクリプション状態を取得できる', async () => {
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + 1)

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: true,
        premiumExpiresAt: futureDate,
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_existing',
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
      expect(('subscription' in result ? result.subscription : undefined)?.cancelAtPeriodEnd).toBe(false)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
      const result = await getSubscriptionStatus()

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('サブスクリプションIDがない場合、subscriptionはnull', async () => {
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
    it('支払い履歴を取得できる', async () => {
      const mockPayments = [
        { id: 'pay-1', amount: 980, status: 'succeeded', createdAt: new Date() },
        { id: 'pay-2', amount: 980, status: 'succeeded', createdAt: new Date() },
      ]
      mockPrisma.payment.findMany.mockResolvedValueOnce(mockPayments)

      const { getPaymentHistory } = await import('@/lib/actions/subscription')
      const result = await getPaymentHistory()

      expect(('payments' in result ? result.payments : undefined)).toHaveLength(2)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getPaymentHistory } = await import('@/lib/actions/subscription')
      const result = await getPaymentHistory()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })
  })

  // ============================================================
  // cancelSubscriptionImmediately
  // ============================================================

  describe('cancelSubscriptionImmediately', async () => {
    it('サブスクリプションを即時解約できる（Stripeのみユーザー）', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ stripeSubscriptionId: 'sub_123' }) // cancelSubscriptionImmediately本体の検索
        .mockResolvedValueOnce({ isPremium: true }) // recomputeUserPremiumAggregate内の検索
      mockStripe.subscriptions.cancel.mockResolvedValueOnce({})
      mockPrisma.premiumEntitlement.findUnique.mockResolvedValueOnce(null)
      mockPrisma.premiumEntitlement.upsert.mockResolvedValueOnce({
        id: 'entitlement-1',
        userId: mockUser.id,
        provider: 'stripe',
        status: 'expired',
      })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([]) // 有効なentitlementなし
      mockPrisma.user.update.mockResolvedValue({})

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toEqual({ success: true })
      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123')
      expect(mockPrisma.user.update).toHaveBeenNthCalledWith(1, {
        where: { id: mockUser.id },
        data: { stripeSubscriptionId: null },
      })
      expect(mockPrisma.premiumEntitlement.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_provider: { userId: mockUser.id, provider: 'stripe' } },
          update: expect.objectContaining({ status: 'expired', cancelAtPeriodEnd: false, expiresAt: null }),
        })
      )
      expect(mockPrisma.user.update).toHaveBeenNthCalledWith(2, {
        where: { id: mockUser.id },
        data: { isPremium: false, premiumExpiresAt: null },
      })
    })

    it('サブスクリプションを即時解約しても他providerのentitlementが有効ならisPremiumはtrueのまま', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ stripeSubscriptionId: 'sub_123' })
        .mockResolvedValueOnce({ isPremium: true })
      mockStripe.subscriptions.cancel.mockResolvedValueOnce({})
      mockPrisma.premiumEntitlement.findUnique.mockResolvedValueOnce(null)
      mockPrisma.premiumEntitlement.upsert.mockResolvedValueOnce({
        id: 'entitlement-1',
        userId: mockUser.id,
        provider: 'stripe',
        status: 'expired',
      })
      // RevenueCat entitlementがまだ有効
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'active', expiresAt: futureDate },
      ])
      mockPrisma.user.update.mockResolvedValue({})

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenNthCalledWith(2, {
        where: { id: mockUser.id },
        data: { isPremium: true, premiumExpiresAt: futureDate },
      })
    })

    it('entitlementレコードが存在しないユーザーでも従来同様に解約できる', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ stripeSubscriptionId: 'sub_123' })
        .mockResolvedValueOnce({ isPremium: true })
      mockStripe.subscriptions.cancel.mockResolvedValueOnce({})
      mockPrisma.premiumEntitlement.findUnique.mockResolvedValueOnce(null)
      mockPrisma.premiumEntitlement.upsert.mockResolvedValueOnce({
        id: 'entitlement-1',
        userId: mockUser.id,
        provider: 'stripe',
        status: 'expired',
      })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([])
      mockPrisma.user.update.mockResolvedValue({})

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenNthCalledWith(2, {
        where: { id: mockUser.id },
        data: { isPremium: false, premiumExpiresAt: null },
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('サブスクリプションがない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        stripeSubscriptionId: null,
      })

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toMatchObject({ error: 'サブスクリプション情報が見つかりません' })
    })

    it('Stripeエラー時はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        stripeSubscriptionId: 'sub_123',
      })
      mockStripe.subscriptions.cancel.mockRejectedValueOnce(new Error('Stripe error'))

      const { cancelSubscriptionImmediately } = await import('@/lib/actions/subscription')
      const result = await cancelSubscriptionImmediately()

      expect(result).toMatchObject({ error: 'サブスクリプションのキャンセルに失敗しました' })
    })
  })

  // ============================================================
  // getMembershipInfo
  // ============================================================

  describe('getMembershipInfo', async () => {
    it('プレミアム会員の制限を取得できる', async () => {
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
      expect(result.limits.maxImages).toBe(6)
      expect(result.limits.maxVideos).toBe(1)
      expect(result.limits.canSchedulePost).toBe(true)
      expect(result.limits.canViewAnalytics).toBe(true)
    })

    it('無料会員の制限を取得できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: false,
        premiumExpiresAt: null,
      })

      const { getMembershipInfo } = await import('@/lib/actions/subscription')
      const result = await getMembershipInfo()

      expect(result.isPremium).toBe(false)
      expect(result.limits.maxPostLength).toBe(500)
      expect(result.limits.maxImages).toBe(4)
      expect(result.limits.maxVideos).toBe(0)
      expect(result.limits.canSchedulePost).toBe(false)
      expect(result.limits.canViewAnalytics).toBe(false)
    })

    it('未ログイン時は無料会員の制限を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getMembershipInfo } = await import('@/lib/actions/subscription')
      const result = await getMembershipInfo()

      expect(result.isPremium).toBe(false)
      expect(result.limits.maxPostLength).toBe(500)
    })

    it('有効期限切れの場合は無料会員として扱う', async () => {
      const pastDate = new Date()
      pastDate.setMonth(pastDate.getMonth() - 1)

      mockPrisma.user.findUnique.mockResolvedValueOnce({
        isPremium: true,
        premiumExpiresAt: pastDate,
      })

      const { getMembershipInfo } = await import('@/lib/actions/subscription')
      const result = await getMembershipInfo()

      expect(result.isPremium).toBe(false)
      expect(result.limits.maxPostLength).toBe(500)
    })
  })
})
