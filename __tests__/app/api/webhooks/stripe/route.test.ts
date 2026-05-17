// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
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
      findUnique: vi.fn().mockResolvedValue({ notificationPreferences: {} }),
    },
    payment: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    notification: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    // Webhook 冪等性ガード用
    webhookEvent: {
      create: vi.fn().mockResolvedValue({ id: 'we-1' }),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      // インタラクティブトランザクションは tx を渡して呼ぶ
      const tx = {
        notification: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'n-1' }),
        },
      }
      return cb(tx)
    }),
  },
}))

// createNotification は通知ロジック単体テストでカバー済み。stripe webhook テストでは委譲を確認すれば十分。
vi.mock('@/lib/actions/notification', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
}))

// idempotency helper も単体テストでカバー済み。webhook テストでは挙動を上書き。
const mockEnsureWebhookEventOnce = vi.fn().mockResolvedValue({ alreadyProcessed: false })
vi.mock('@/lib/services/webhook-idempotency', () => ({
  ensureWebhookEventOnce: (...args: unknown[]) => mockEnsureWebhookEventOnce(...args),
}))

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// 部分モック: 元モジュールのエクスポートをすべて維持しつつ必要な値だけ固定する。
// (新しい import 経路で IN_MEMORY_CLEANUP_THRESHOLD 等が必要になっても破綻しないため)
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

describe('Stripe Webhook API', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = { ...originalEnv, STRIPE_WEBHOOK_SECRET: 'whsec_test_secret' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 503 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_test'))

    expect(response.status).toBe(503)
    const data = await response.json()
    expect(data.error).toBe('Webhook not configured')
  })

  it('returns 400 when stripe-signature header is missing', async () => {
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}'))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Missing signature')
  })

  it('returns 400 when signature verification fails', async () => {
    const { stripe } = await import('@/lib/stripe')
    vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_invalid'))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Invalid signature')
  })

  it('handles checkout.session.completed - activates premium and records payment', async () => {
    const { stripe } = await import('@/lib/stripe')
    const { prisma } = await import('@/lib/db')

    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { userId: 'user-1' },
          subscription: 'sub_123',
          customer: 'cus_123',
          invoice: 'inv_123',
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
    // 実際の Stripe API は id / status を必ず返すため、テストでも同様に模擬する。
    // （webhook route の Zod スキーマが id / status を required にしているため）
    vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      current_period_end: 1700000000,
    } as never)
    vi.mocked(stripe.invoices.retrieve).mockResolvedValue({
      payment_intent: 'pi_123',
      amount_paid: 980,
      currency: 'jpy',
    } as never)
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)
    vi.mocked(prisma.payment.create).mockResolvedValue({} as never)

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    expect(response.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        isPremium: true,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
      }),
    })
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        stripePaymentId: 'pi_123',
        amount: 980,
        currency: 'jpy',
        status: 'succeeded',
      }),
    })
  })

  it('handles customer.subscription.deleted - deactivates premium', async () => {
    const { stripe } = await import('@/lib/stripe')
    const { prisma } = await import('@/lib/db')

    const mockEvent = {
      type: 'customer.subscription.deleted',
      data: {
        // Stripe は deletion でも id/status を必ず送るため Zod スキーマも required。
        object: { id: 'sub_123', status: 'canceled' },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    expect(response.status).toBe(200)
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_123' },
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        isPremium: false,
        stripeSubscriptionId: null,
        premiumExpiresAt: null,
      },
    })
  })

  it('handles invoice.payment_failed - creates notification (createNotification経由)', async () => {
    const { stripe } = await import('@/lib/stripe')
    const { prisma } = await import('@/lib/db')
    const { createNotification } = await import('@/lib/services/notification-core')

    const mockEvent = {
      type: 'invoice.payment_failed',
      data: {
        // Stripe invoice は amount_paid / currency を常に含むため Zod スキーマも required。
        // （payment_failed では amount_paid は 0 のことが多い）
        object: {
          subscription: 'sub_123',
          payment_intent: null,
          amount_paid: 0,
          currency: 'jpy',
          billing_reason: 'subscription_cycle',
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1' } as never)

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    expect(response.status).toBe(200)
    // CLAUDE.md ルール6: prisma.notification.create を直接呼ぶのではなく createNotification 経由
    expect(createNotification).toHaveBeenCalledWith({
      userId: 'user-1',
      actorId: 'user-1',
      type: 'system',
    })
  })

  it('idempotency: duplicate event.id は処理をスキップする', async () => {
    const { stripe } = await import('@/lib/stripe')

    const mockEvent = {
      id: 'evt_dup_1',
      type: 'invoice.payment_failed',
      data: {
        object: {
          subscription: 'sub_123',
          payment_intent: null,
          amount_paid: 0,
          currency: 'jpy',
          billing_reason: 'subscription_cycle',
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
    mockEnsureWebhookEventOnce.mockResolvedValueOnce({ alreadyProcessed: true })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({ received: true, duplicate: true })
  })

  it('returns 200 for unknown event type (ignores gracefully)', async () => {
    const { stripe } = await import('@/lib/stripe')

    const mockEvent = {
      type: 'some.unknown.event',
      data: { object: {} },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.received).toBe(true)
  })

  it('handles customer.subscription.deleted when user not found', async () => {
    const { stripe } = await import('@/lib/stripe')
    const { prisma } = await import('@/lib/db')

    const mockEvent = {
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_nonexistent' },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    expect(response.status).toBe(200)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('handles checkout.session.completed with missing userId (no-op)', async () => {
    const { stripe } = await import('@/lib/stripe')
    const { prisma } = await import('@/lib/db')

    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: {},
          subscription: 'sub_123',
          customer: 'cus_123',
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.received).toBe(true)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('handles customer.subscription.updated - activates premium', async () => {
    const { stripe } = await import('@/lib/stripe')
    const { prisma } = await import('@/lib/db')

    const mockEvent = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.received).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        isPremium: true,
      }),
    })
  })

  it('handles customer.subscription.updated when user not found', async () => {
    const { stripe } = await import('@/lib/stripe')
    const { prisma } = await import('@/lib/db')

    const mockEvent = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.received).toBe(true)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('handles invoice.payment_succeeded (subscription_cycle) - records payment', async () => {
    const { stripe } = await import('@/lib/stripe')
    const { prisma } = await import('@/lib/db')

    const mockEvent = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          subscription: 'sub_123',
          payment_intent: 'pi_123',
          amount_paid: 1000,
          currency: 'jpy',
          billing_reason: 'subscription_cycle',
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(prisma.payment.create).mockResolvedValue({} as never)
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)
    vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    } as never)

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.received).toBe(true)
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        stripePaymentId: 'pi_123',
        amount: 1000,
        currency: 'jpy',
        status: 'succeeded',
      }),
    })
    expect(prisma.user.update).toHaveBeenCalled()
  })

  it('handles invoice.payment_succeeded (subscription_create) - skips', async () => {
    const { stripe } = await import('@/lib/stripe')
    const { prisma } = await import('@/lib/db')

    const mockEvent = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          subscription: 'sub_123',
          payment_intent: 'pi_123',
          amount_paid: 1000,
          currency: 'jpy',
          billing_reason: 'subscription_create',
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.received).toBe(true)
    expect(prisma.payment.create).not.toHaveBeenCalled()
  })

  // ============================================================
  // Zod 外部境界バリデーション: 不正 payload は 200 を返して DB 書き込みをスキップ
  // ============================================================

  it('returns 200 and skips DB writes when subscription payload is malformed (missing id/status)', async () => {
    const { stripe } = await import('@/lib/stripe')
    const { prisma } = await import('@/lib/db')

    const mockEvent = {
      type: 'customer.subscription.updated',
      data: {
        // 本来 Stripe は id / status を必ず送るが、破損 payload をシミュレート
        object: { current_period_end: 1700000000 },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    // Stripe の 24h リトライを止めるため 200 を返す
    expect(response.status).toBe(200)
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
  })

  it('returns 200 and skips DB writes when invoice payload is malformed (missing amount_paid/currency)', async () => {
    const { stripe } = await import('@/lib/stripe')
    const { prisma } = await import('@/lib/db')

    const mockEvent = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          subscription: 'sub_123',
          payment_intent: 'pi_123',
          billing_reason: 'subscription_cycle',
          // amount_paid / currency 欠落 = 破損 payload
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    expect(response.status).toBe(200)
    expect(prisma.payment.create).not.toHaveBeenCalled()
  })

  it('returns 200 and skips DB writes when checkout session has non-string subscription id', async () => {
    const { stripe } = await import('@/lib/stripe')
    const { prisma } = await import('@/lib/db')

    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { userId: 'user-1' },
          // 本来 string を期待する箇所に数値が来た不正 payload
          subscription: 12345,
          customer: 'cus_123',
        },
      },
    }

    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent as never)

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(makeRequest('{}', 'sig_valid'))

    expect(response.status).toBe(200)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
