// @vitest-environment node

import { vi } from 'vitest'
// Stripe mock
const mockStripeInstance = {
  customers: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
  subscriptions: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
}

vi.mock('stripe', () => {
  return { default: vi.fn().mockImplementation(function() { return mockStripeInstance }) }
})

describe('Stripe Module', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_PRICE_ID_MONTHLY
    delete process.env.STRIPE_PRICE_ID_YEARLY
  })

  describe('stripe client', async () => {
    it('STRIPE_SECRET_KEYが未設定の場合はエラーをスローする', async () => {
      const { stripe } = await import('@/lib/stripe')

      expect(() => {
        // Proxyを通じてアクセスすると初期化が試みられる
        void stripe.customers
      }).toThrow('STRIPE_SECRET_KEY is not set')
    })

    it('STRIPE_SECRET_KEYが設定されている場合はクライアントを初期化する', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'

      const { stripe } = await import('@/lib/stripe')

      // Proxyを通じてアクセス
      const customers = stripe.customers
      expect(customers).toBeDefined()
    })

    it('遅延初期化により複数回アクセスしても同じインスタンスを返す', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'

      const { stripe } = await import('@/lib/stripe')

      // 複数回アクセス
      const customers1 = stripe.customers
      const customers2 = stripe.customers

      expect(customers1).toBe(customers2)
    })
  })

  describe('Price IDs', async () => {
    it('STRIPE_PRICE_ID_MONTHLYを環境変数から取得する', async () => {
      process.env.STRIPE_PRICE_ID_MONTHLY = 'price_monthly_xxx'

      const { STRIPE_PRICE_ID_MONTHLY } = await import('@/lib/stripe')

      expect(STRIPE_PRICE_ID_MONTHLY).toBe('price_monthly_xxx')
    })

    it('STRIPE_PRICE_ID_YEARLYを環境変数から取得する', async () => {
      process.env.STRIPE_PRICE_ID_YEARLY = 'price_yearly_xxx'

      const { STRIPE_PRICE_ID_YEARLY } = await import('@/lib/stripe')

      expect(STRIPE_PRICE_ID_YEARLY).toBe('price_yearly_xxx')
    })

    it('環境変数が未設定の場合はundefinedを返す', async () => {
      const { STRIPE_PRICE_ID_MONTHLY, STRIPE_PRICE_ID_YEARLY } = await import('@/lib/stripe')

      expect(STRIPE_PRICE_ID_MONTHLY).toBeUndefined()
      expect(STRIPE_PRICE_ID_YEARLY).toBeUndefined()
    })
  })
})
