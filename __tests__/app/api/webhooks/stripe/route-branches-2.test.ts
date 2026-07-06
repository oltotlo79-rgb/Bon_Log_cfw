// @vitest-environment node
/**
 * Stripe Webhook - 残存ブランチカバレッジ補完テスト。
 *
 * route.test.ts / route-boost.test.ts でカバーしきれていない分岐（各ハンドラ内の
 * ネストした Zod 検証失敗・冪等スキップ・通知失敗・返金時のユーザー特定フォールバック等）
 * を対象にする。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
    invoices: { retrieve: vi.fn() },
  },
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      update: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    notification: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    webhookEvent: {
      create: vi.fn().mockResolvedValue({ id: 'we-1' }),
    },
  },
}))

const mockCreateNotification = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}))

const mockEnsureWebhookEventOnce = vi.fn().mockResolvedValue({ alreadyProcessed: false })
vi.mock('@/lib/services/webhook-idempotency', () => ({
  ensureWebhookEventOnce: (...args: unknown[]) => mockEnsureWebhookEventOnce(...args),
  deleteWebhookEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  default: {
    log: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

const mockCheckRateLimit = vi.fn().mockResolvedValue({ success: true, remaining: 60, resetTime: Date.now() + 60_000 })
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 60, resetTime: Date.now() + 60_000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: { api: { windowMs: 60_000, maxRequests: 60 } },
}))

vi.mock('@/lib/constants/limits', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/constants/limits')>()
  return {
    ...actual,
    PREMIUM_FALLBACK_DAYS: 30,
    ONE_DAY_MS: 86400000,
    ONE_SECOND_MS: 1000,
  }
})

function makeRequest(body: string, signature?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (signature) headers['stripe-signature'] = signature
  return new NextRequest('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers,
  })
}

describe('Stripe Webhook - 残存ブランチ補完', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = { ...originalEnv, STRIPE_WEBHOOK_SECRET: 'whsec_test_secret' }
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 60, resetTime: Date.now() + 60_000 })
    mockEnsureWebhookEventOnce.mockResolvedValue({ alreadyProcessed: false })
    mockCreateNotification.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('IP レート制限超過時は署名検証前に 429 を返す', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30_000 })
    const { stripe } = await import('@/lib/stripe')

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    expect(response.status).toBe(429)
    expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled()
  })

  describe('checkout.session.completed', () => {
    it('subscription payload が不正なら premium 更新をスキップして 200 を返す', async () => {
      const { stripe } = await import('@/lib/stripe')
      const { prisma } = await import('@/lib/db')

      const mockEvent = {
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: {
          object: { metadata: { userId: 'user-1' }, subscription: 'sub_1', customer: 'cus_1' },
        },
      }
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
      // id / status を欠落させた破損 subscription payload
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({} as never)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('customer が null の場合 stripeCustomerId は null で保存される', async () => {
      const { stripe } = await import('@/lib/stripe')
      const { prisma } = await import('@/lib/db')

      const mockEvent = {
        id: 'evt_2',
        type: 'checkout.session.completed',
        data: {
          object: { metadata: { userId: 'user-1' }, subscription: 'sub_1', customer: null },
        },
      }
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        id: 'sub_1',
        status: 'active',
        current_period_end: 1700000000,
      } as never)
      vi.mocked(prisma.user.update).mockResolvedValue({} as never)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({ stripeCustomerId: null }),
      })
    })

    it('invoice payload が不正なら support 履歴を作らず 200 を返す（premium 更新は先に完了）', async () => {
      const { stripe } = await import('@/lib/stripe')
      const { prisma } = await import('@/lib/db')

      const mockEvent = {
        id: 'evt_3',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-1' },
            subscription: 'sub_1',
            customer: 'cus_1',
            invoice: 'in_1',
          },
        },
      }
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        id: 'sub_1',
        status: 'active',
        current_period_end: 1700000000,
      } as never)
      // amount_paid / currency 欠落した破損 invoice payload
      vi.mocked(stripe.invoices.retrieve).mockResolvedValue({ payment_intent: 'pi_1' } as never)
      vi.mocked(prisma.user.update).mockResolvedValue({} as never)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      expect(prisma.user.update).toHaveBeenCalled()
      expect(prisma.payment.create).not.toHaveBeenCalled()
    })

    it('payment_intent の支払いが既に記録済みなら重複作成しない（冪等性）', async () => {
      const { stripe } = await import('@/lib/stripe')
      const { prisma } = await import('@/lib/db')

      const mockEvent = {
        id: 'evt_4',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-1' },
            subscription: 'sub_1',
            customer: 'cus_1',
            invoice: 'in_1',
          },
        },
      }
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        id: 'sub_1',
        status: 'active',
        current_period_end: 1700000000,
      } as never)
      vi.mocked(stripe.invoices.retrieve).mockResolvedValue({
        payment_intent: 'pi_1',
        amount_paid: 980,
        currency: 'jpy',
      } as never)
      vi.mocked(prisma.user.update).mockResolvedValue({} as never)
      vi.mocked(prisma.payment.findUnique).mockResolvedValueOnce({ id: 'pay-existing' } as never)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      expect(prisma.payment.create).not.toHaveBeenCalled()
    })
  })

  describe('invoice.payment_failed', () => {
    it('invoice payload が不正なら 200 を返し通知も作らない', async () => {
      const { stripe } = await import('@/lib/stripe')

      const mockEvent = {
        id: 'evt_5',
        type: 'invoice.payment_failed',
        data: { object: { subscription: 'sub_1' } }, // amount_paid/currency 欠落
      }
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      expect(mockCreateNotification).not.toHaveBeenCalled()
    })

    it('createNotification が失敗しても 200 を返しログに記録する', async () => {
      const { stripe } = await import('@/lib/stripe')
      const { prisma } = await import('@/lib/db')
      const loggerModule = await import('@/lib/logger')

      const mockEvent = {
        id: 'evt_6',
        type: 'invoice.payment_failed',
        data: {
          object: {
            subscription: 'sub_1',
            payment_intent: null,
            amount_paid: 0,
            currency: 'jpy',
            billing_reason: 'subscription_cycle',
          },
        },
      }
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1' } as never)
      mockCreateNotification.mockResolvedValueOnce({ success: false, error: 'notif error' })

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      expect(loggerModule.default.error).toHaveBeenCalledWith(
        'Payment-failed notification creation failed',
        expect.objectContaining({ userId: 'user-1', error: 'notif error' }),
      )
    })
  })

  describe('invoice.payment_succeeded', () => {
    it('支払いが既に記録済みなら重複作成せず期限延長のみ行わない（冪等性）', async () => {
      const { stripe } = await import('@/lib/stripe')
      const { prisma } = await import('@/lib/db')

      const mockEvent = {
        id: 'evt_7',
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
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1' } as never)
      vi.mocked(prisma.payment.findUnique).mockResolvedValueOnce({ id: 'pay-existing' } as never)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      expect(prisma.payment.create).not.toHaveBeenCalled()
      expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
    })

    it('期限延長のための subscription payload が不正なら 200 を返し user.update をスキップする', async () => {
      const { stripe } = await import('@/lib/stripe')
      const { prisma } = await import('@/lib/db')

      const mockEvent = {
        id: 'evt_8',
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
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1' } as never)
      vi.mocked(prisma.payment.create).mockResolvedValue({} as never)
      // id / status 欠落の破損 subscription payload
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({} as never)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      expect(prisma.payment.create).toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
    })
  })

  describe('charge.refunded', () => {
    it('payload が不正なら 200 を返しユーザー特定処理を行わない', async () => {
      const { stripe } = await import('@/lib/stripe')
      const { prisma } = await import('@/lib/db')

      const mockEvent = {
        id: 'evt_9',
        type: 'charge.refunded',
        data: { object: { refunded: 'not-a-boolean' } },
      }
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      expect(prisma.payment.findUnique).not.toHaveBeenCalled()
    })

    it('payment_intent が無くても customer からユーザーを特定して失効させる', async () => {
      const { stripe } = await import('@/lib/stripe')
      const { prisma } = await import('@/lib/db')

      const mockEvent = {
        id: 'evt_10',
        type: 'charge.refunded',
        data: {
          object: { payment_intent: null, customer: 'cus_1', refunded: true, amount: 980, amount_refunded: 980 },
        },
      }
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-2' } as never)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      // payment_intent が無いので payment 経由の特定は行われない
      expect(prisma.payment.findUnique).not.toHaveBeenCalled()
      expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { stripeCustomerId: 'cus_1' } })
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { isPremium: false, premiumExpiresAt: null },
      })
    })

    it('payment_intent も customer も無い全額返金は該当ユーザーが特定できず何もしない', async () => {
      const { stripe } = await import('@/lib/stripe')
      const { prisma } = await import('@/lib/db')

      const mockEvent = {
        id: 'evt_11',
        type: 'charge.refunded',
        data: {
          object: { payment_intent: null, customer: null, refunded: true, amount: 980, amount_refunded: 980 },
        },
      }
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      expect(prisma.user.findFirst).not.toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('既に refunded 状態の payment は再更新しない（冪等性）', async () => {
      const { stripe } = await import('@/lib/stripe')
      const { prisma } = await import('@/lib/db')

      const mockEvent = {
        id: 'evt_12',
        type: 'charge.refunded',
        data: {
          object: { payment_intent: 'pi_1', customer: 'cus_1', refunded: true, amount: 980, amount_refunded: 980 },
        },
      }
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
      vi.mocked(prisma.payment.findUnique).mockResolvedValueOnce({
        id: 'pay-1',
        userId: 'user-1',
        status: 'refunded',
      } as never)
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'user-1' } as never)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      expect(prisma.payment.update).not.toHaveBeenCalled()
      // 通知・失効処理はユーザーが特定できていれば実施される
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isPremium: false, premiumExpiresAt: null },
      })
    })

    it('返金通知の createNotification が失敗してもログに記録し 200 を返す', async () => {
      const { stripe } = await import('@/lib/stripe')
      const { prisma } = await import('@/lib/db')
      const loggerModule = await import('@/lib/logger')

      const mockEvent = {
        id: 'evt_13',
        type: 'charge.refunded',
        data: {
          object: { payment_intent: 'pi_1', customer: 'cus_1', refunded: true, amount: 980, amount_refunded: 980 },
        },
      }
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
      vi.mocked(prisma.payment.findUnique).mockResolvedValueOnce({
        id: 'pay-1',
        userId: 'user-1',
        status: 'succeeded',
      } as never)
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'user-1' } as never)
      mockCreateNotification.mockResolvedValueOnce({ success: false, error: 'notif error' })

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      expect(loggerModule.default.error).toHaveBeenCalledWith(
        'Refund notification creation failed',
        expect.objectContaining({ userId: 'user-1', error: 'notif error' }),
      )
    })
  })

  describe('charge.dispute.created', () => {
    it('payload が不正なら 200 を返し payment 検索を行わない', async () => {
      const { stripe } = await import('@/lib/stripe')
      const { prisma } = await import('@/lib/db')

      const mockEvent = {
        id: 'evt_14',
        type: 'charge.dispute.created',
        data: { object: { amount: 'not-a-number' } },
      }
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      expect(prisma.payment.findUnique).not.toHaveBeenCalled()
    })

    it('payment_intent が無い場合は payment 検索をスキップし userId は null でログされる', async () => {
      const { stripe } = await import('@/lib/stripe')
      const { prisma } = await import('@/lib/db')
      const loggerModule = await import('@/lib/logger')

      const mockEvent = {
        id: 'evt_15',
        type: 'charge.dispute.created',
        data: { object: { charge: 'ch_1', payment_intent: null, reason: 'fraudulent', status: 'needs_response' } },
      }
      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)

      const { POST } = await import('@/app/api/webhooks/stripe/route')
      const response = await POST(makeRequest('{}', 'sig_valid'))

      expect(response.status).toBe(200)
      expect(prisma.payment.findUnique).not.toHaveBeenCalled()
      expect(loggerModule.default.error).toHaveBeenCalledWith(
        expect.stringContaining('dispute'),
        expect.objectContaining({ userId: null }),
      )
    })
  })
})
