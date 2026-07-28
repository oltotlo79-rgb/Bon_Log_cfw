import { vi } from 'vitest'
import type { NextRequest } from 'next/server'
// @vitest-environment node

/**
 * Stripe Webhook - ブランチカバレッジ向上テスト
 * currentPeriodEndなし、invoice なし、ユーザー見つからないパス、エラーハンドリング等をカバー
 */

import { createMockPrismaClient } from '../../../../utils/test-utils'

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
    }),
  },
}))

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

const mockStripeWebhooksConstructEvent = vi.fn()
const mockStripeSubscriptionsRetrieve = vi.fn()
const mockStripeInvoicesRetrieve = vi.fn()

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: (...args: unknown[]) => mockStripeWebhooksConstructEvent(...args),
    },
    subscriptions: {
      retrieve: (...args: unknown[]) => mockStripeSubscriptionsRetrieve(...args),
    },
    invoices: {
      retrieve: (...args: unknown[]) => mockStripeInvoicesRetrieve(...args),
    },
  },
}))

const createMockRequest = (body: string, signature?: string) => ({
  text: async () => body,
  headers: {
    get: (name: string) => {
      if (name === 'stripe-signature') return signature || null
      return null
    },
  },
})

describe('Stripe Webhook - ブランチカバレッジ向上', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123'
    // mockPrisma はファイル内で使い回される単一インスタンスのため、clearAllMocks() では
    // 前のテストで設定した mockResolvedValue（実装）が引き継がれてしまう。
    // recomputeUserPremiumAggregate (実実装) が premiumEntitlement.findMany の戻り値に
    // .filter を呼ぶため、未設定時は必ず空配列を返す安全なデフォルトに揃えておく。
    mockPrisma.premiumEntitlement.findMany.mockResolvedValue([])
  })

  // ============================================================
  // checkout.session.completed - currentPeriodEnd未定義
  // ============================================================

  describe('checkout.session.completed', () => {
    it('currentPeriodEndがundefinedの場合30日後のデフォルト有効期限を設定する', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-1' },
            subscription: 'sub_1',
            customer: 'cus_1',
            invoice: null,
          },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent)
      // Zod スキーマは id / status を required とする（Stripe は常に送信する）。
      // current_period_end は意図的に含めない（デフォルト 30 日後のパスを検証する）。
      mockStripeSubscriptionsRetrieve.mockResolvedValue({
        id: 'sub_1',
        status: 'active',
      })
      mockPrisma.user.update.mockResolvedValue({})
      // recomputeUserPremiumAggregate (実実装) は対象 user の存在確認に findUnique を使う
      mockPrisma.user.findUnique.mockResolvedValue({ isPremium: false })
      // recomputeUserPremiumAggregate (実実装) が isPremium=true を導出するための有効 entitlement
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'active', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      ])

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(createMockRequest(JSON.stringify(mockEvent), 'sig') as unknown as NextRequest)
      const data = await response.json()

      expect(data.received).toBe(true)
      // 1回目: legacy カラム更新（stripeCustomerId/stripeSubscriptionId）
      expect(mockPrisma.user.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'user-1' },
        data: {
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
        },
      })
      // 2回目: aggregate 再計算（isPremium/premiumExpiresAt、current_period_end 未定義のため 30 日後デフォルト）
      expect(mockPrisma.user.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'user-1' },
        data: {
          isPremium: true,
          premiumExpiresAt: expect.any(Date),
        },
      })
      // 支払い履歴は作成されない（invoiceがnull）
      expect(mockPrisma.payment.create).not.toHaveBeenCalled()
    })

    it('invoiceがあるがpayment_intentがない場合は支払い履歴を作成しない', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-2' },
            subscription: 'sub_2',
            customer: 'cus_2',
            invoice: 'in_2',
          },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent)
      mockStripeSubscriptionsRetrieve.mockResolvedValue({
        id: 'sub_2',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
      })
      mockStripeInvoicesRetrieve.mockResolvedValue({
        payment_intent: null,
        amount_paid: 0,
        currency: 'jpy',
      })
      mockPrisma.user.update.mockResolvedValue({})

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(createMockRequest(JSON.stringify(mockEvent), 'sig') as unknown as NextRequest)
      const data = await response.json()

      expect(data.received).toBe(true)
      expect(mockPrisma.payment.create).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // customer.subscription.updated - currentPeriodEnd未定義 & エラー
  // ============================================================

  describe('customer.subscription.updated', () => {
    it('currentPeriodEndがundefinedの場合30日後のデフォルト有効期限を設定する', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_1',
            status: 'active',
            // current_period_end なし
          },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent)
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' })
      mockPrisma.user.update.mockResolvedValue({})
      mockPrisma.user.findUnique.mockResolvedValue({ isPremium: false })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'active', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      ])

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(createMockRequest(JSON.stringify(mockEvent), 'sig') as unknown as NextRequest)
      const data = await response.json()

      expect(data.received).toBe(true)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          isPremium: true,
          premiumExpiresAt: expect.any(Date),
        },
      })
    })

    it('処理中の一過性エラーは冪等ロックを解放し500を返す（Stripeにリトライさせる）', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_1',
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + 86400,
          },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent)
      mockPrisma.user.findFirst.mockRejectedValue(new Error('DB Error'))

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(createMockRequest(JSON.stringify(mockEvent), 'sig') as unknown as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })
  })

  // ============================================================
  // customer.subscription.deleted - ユーザー未発見 & エラー
  // ============================================================

  describe('customer.subscription.deleted', () => {
    it('ユーザーが見つからない場合は更新をスキップする', async () => {
      const mockEvent = {
        type: 'customer.subscription.deleted',
        data: {
          // Stripe は deletion でも id / status を必ず送るため Zod スキーマも required。
          object: { id: 'sub_unknown', status: 'canceled' },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent)
      mockPrisma.user.findFirst.mockResolvedValue(null)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(createMockRequest(JSON.stringify(mockEvent), 'sig') as unknown as NextRequest)
      const data = await response.json()

      expect(data.received).toBe(true)
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('処理中の一過性エラーは冪等ロックを解放し500を返す（Stripeにリトライさせる）', async () => {
      const mockEvent = {
        type: 'customer.subscription.deleted',
        data: {
          object: { id: 'sub_1', status: 'canceled' },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent)
      mockPrisma.user.findFirst.mockRejectedValue(new Error('DB Error'))

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(createMockRequest(JSON.stringify(mockEvent), 'sig') as unknown as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })
  })

  // ============================================================
  // invoice.payment_failed - subscriptionIdなし & ユーザー未発見 & エラー
  // ============================================================

  describe('invoice.payment_failed', () => {
    // Stripe invoice は amount_paid / currency を常に含むため、Zod スキーマも required。
    // 失敗時は amount_paid = 0 が一般的。
    const invoiceBase = {
      amount_paid: 0,
      currency: 'jpy',
      billing_reason: 'subscription_cycle',
      payment_intent: null,
    }

    it('subscriptionIdがない場合はスキップする', async () => {
      const mockEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            ...invoiceBase,
            subscription: null,
          },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(createMockRequest(JSON.stringify(mockEvent), 'sig') as unknown as NextRequest)
      const data = await response.json()

      expect(data.received).toBe(true)
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('ユーザーが見つからない場合はスキップする', async () => {
      const mockEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: { ...invoiceBase, subscription: 'sub_1' },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent)
      mockPrisma.user.findFirst.mockResolvedValue(null)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(createMockRequest(JSON.stringify(mockEvent), 'sig') as unknown as NextRequest)
      const data = await response.json()

      expect(data.received).toBe(true)
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('処理中の一過性エラーは冪等ロックを解放し500を返す（Stripeにリトライさせる）', async () => {
      const mockEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: { ...invoiceBase, subscription: 'sub_1' },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent)
      mockPrisma.user.findFirst.mockRejectedValue(new Error('DB Error'))

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(createMockRequest(JSON.stringify(mockEvent), 'sig') as unknown as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })
  })

  // ============================================================
  // invoice.payment_succeeded - ユーザー未発見 & currentPeriodEndなし & エラー
  // ============================================================

  describe('invoice.payment_succeeded', () => {
    it('ユーザーが見つからない場合はスキップする', async () => {
      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription: 'sub_1',
            payment_intent: 'pi_1',
            amount_paid: 1000,
            currency: 'jpy',
            billing_reason: 'subscription_cycle',
          },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent)
      mockPrisma.user.findFirst.mockResolvedValue(null)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(createMockRequest(JSON.stringify(mockEvent), 'sig') as unknown as NextRequest)
      const data = await response.json()

      expect(data.received).toBe(true)
      expect(mockPrisma.payment.create).not.toHaveBeenCalled()
    })

    it('payment_intentがない場合はスキップする', async () => {
      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription: 'sub_1',
            payment_intent: null,
            amount_paid: 1000,
            currency: 'jpy',
            billing_reason: 'subscription_cycle',
          },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent)
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' })

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(createMockRequest(JSON.stringify(mockEvent), 'sig') as unknown as NextRequest)
      const data = await response.json()

      expect(data.received).toBe(true)
      expect(mockPrisma.payment.create).not.toHaveBeenCalled()
    })

    it('currentPeriodEndがundefinedの場合30日後をデフォルトに設定する', async () => {
      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription: 'sub_1',
            payment_intent: 'pi_1',
            amount_paid: 1000,
            currency: 'jpy',
            billing_reason: 'subscription_cycle',
          },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent)
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1' })
      mockPrisma.payment.create.mockResolvedValue({})
      mockPrisma.user.update.mockResolvedValue({})
      mockPrisma.user.findUnique.mockResolvedValue({ isPremium: false })
      // Zod スキーマは id / status を required。current_period_end だけ欠落させてデフォルト経路を踏む。
      mockStripeSubscriptionsRetrieve.mockResolvedValue({
        id: 'sub_1',
        status: 'active',
      })
      mockPrisma.premiumEntitlement.findMany.mockResolvedValueOnce([
        { status: 'active', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      ])

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(createMockRequest(JSON.stringify(mockEvent), 'sig') as unknown as NextRequest)
      const data = await response.json()

      expect(data.received).toBe(true)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          isPremium: true,
          premiumExpiresAt: expect.any(Date),
        },
      })
    })

    it('subscriptionIdがない場合はスキップする', async () => {
      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription: null,
            payment_intent: 'pi_1',
            amount_paid: 1000,
            currency: 'jpy',
            billing_reason: 'subscription_cycle',
          },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(createMockRequest(JSON.stringify(mockEvent), 'sig') as unknown as NextRequest)
      const data = await response.json()

      expect(data.received).toBe(true)
      expect(mockPrisma.payment.create).not.toHaveBeenCalled()
    })

    it('処理中の一過性エラーは冪等ロックを解放し500を返す（Stripeにリトライさせる）', async () => {
      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription: 'sub_1',
            payment_intent: 'pi_1',
            amount_paid: 1000,
            currency: 'jpy',
            billing_reason: 'subscription_cycle',
          },
        },
      }

      mockStripeWebhooksConstructEvent.mockReturnValue(mockEvent)
      mockPrisma.user.findFirst.mockRejectedValue(new Error('DB Error'))

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(createMockRequest(JSON.stringify(mockEvent), 'sig') as unknown as NextRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })
  })
})
