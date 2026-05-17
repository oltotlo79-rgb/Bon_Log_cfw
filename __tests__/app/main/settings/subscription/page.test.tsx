import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { redirect as _redirect } from 'next/navigation'

// モック
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    payment: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/actions/subscription', () => ({
  getSubscriptionStatus: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/components/subscription/SubscriptionStatus', () => ({
  SubscriptionStatus: ({ isPremium }: any) => (
    <div data-testid="subscription-status">Status: {isPremium ? 'Premium' : 'Free'}</div>
  ),
}))

vi.mock('@/components/subscription/PricingCard', () => ({
  PricingCard: ({ planName, price }: any) => (
    <div data-testid="pricing-card">{planName}: ¥{price}</div>
  ),
}))

vi.mock('@/components/subscription/PaymentHistory', () => ({
  PaymentHistory: ({ payments }: any) => (
    <div data-testid="payment-history">{payments.length} payments</div>
  ),
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children, className }: any) => <div className={className}>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}))

describe('SubscriptionPage', async () => {
  const { auth } = await import('@/lib/auth')
  const { prisma } = await import('@/lib/db')
  const { getSubscriptionStatus } = await import('@/lib/actions/subscription')
  const redirect = _redirect as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_PRICE_ID_MONTHLY = 'price_monthly'
    process.env.STRIPE_PRICE_ID_YEARLY = 'price_yearly'
  })

  it('未認証の場合はリダイレクト', async () => {
     
    auth.mockResolvedValue(null as any)

    const { default: Page } = await import('@/app/(main)/settings/subscription/page')

    try {
       
      await Page({ searchParams: Promise.resolve({}) } as any)
    } catch (_error) {
      // redirect throws
    }

    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('成功メッセージを表示', async () => {
     
    auth.mockResolvedValue({ user: { id: 'user1' } } as any)
    getSubscriptionStatus.mockResolvedValue({
      isPremium: true,
      premiumExpiresAt: '2024-12-31T23:59:59.000Z',
      subscription: null,
     
    } as any)
     
    prisma.payment.findMany.mockResolvedValue([] as any)

    const { default: Page } = await import('@/app/(main)/settings/subscription/page')
     
    const result = await Page({ searchParams: Promise.resolve({ success: 'true' }) } as any)
    render(result)

    expect(screen.getByText(/プレミアム会員への登録が完了しました/)).toBeInTheDocument()
  })

  it('キャンセルメッセージを表示', async () => {
     
    auth.mockResolvedValue({ user: { id: 'user1' } } as any)
    getSubscriptionStatus.mockResolvedValue({
      isPremium: false,
      premiumExpiresAt: null,
      subscription: null,
     
    } as any)
     
    prisma.payment.findMany.mockResolvedValue([] as any)

    const { default: Page } = await import('@/app/(main)/settings/subscription/page')
     
    const result = await Page({ searchParams: Promise.resolve({ canceled: 'true' }) } as any)
    render(result)

    expect(screen.getByText(/登録がキャンセルされました/)).toBeInTheDocument()
  })

  it('プレミアム会員の場合はステータスを表示', async () => {

    auth.mockResolvedValue({ user: { id: 'user1' } } as any)
    getSubscriptionStatus.mockResolvedValue({
      isPremium: true,
      premiumExpiresAt: '2024-12-31T23:59:59.000Z',
      subscription: { id: 'sub_123' },

    } as any)
    prisma.payment.findMany.mockResolvedValue([
      { id: 'pay1', amount: 350, status: 'succeeded', createdAt: new Date() },

    ] as any)

    const { default: Page } = await import('@/app/(main)/settings/subscription/page')

    const result = await Page({ searchParams: Promise.resolve({}) } as any)
    render(result)

    expect(screen.getByTestId('subscription-status')).toHaveTextContent('Status: Premium')
    expect(screen.getByTestId('payment-history')).toHaveTextContent('1 payments')
    expect(screen.queryByTestId('pricing-card')).not.toBeInTheDocument()
  })

  it('プレミアム会員には「ご利用中の特典」ブロックが広告非表示を含めて表示される', async () => {
    auth.mockResolvedValue({ user: { id: 'user1' } } as any)
    getSubscriptionStatus.mockResolvedValue({
      isPremium: true,
      premiumExpiresAt: '2024-12-31T23:59:59.000Z',
      subscription: { id: 'sub_123' },
    } as any)
    prisma.payment.findMany.mockResolvedValue([] as any)

    const { default: Page } = await import('@/app/(main)/settings/subscription/page')
    const result = await Page({ searchParams: Promise.resolve({}) } as any)
    render(result)

    // 見出し
    expect(screen.getByRole('heading', { level: 2, name: /ご利用中の特典/ })).toBeInTheDocument()
    // 各特典項目（広告非表示が含まれていることを明示的に確認）
    expect(screen.getByText(/投稿文字数 2000 文字まで/)).toBeInTheDocument()
    expect(screen.getByText(/画像添付 6 枚・動画添付 3 本まで/)).toBeInTheDocument()
    expect(screen.getByText(/予約投稿機能/)).toBeInTheDocument()
    expect(screen.getByText(/投稿分析ダッシュボード/)).toBeInTheDocument()
    expect(screen.getByText(/広告非表示（サイト全体）/)).toBeInTheDocument()
  })

  it('非プレミアム会員には「ご利用中の特典」ブロックは表示しない', async () => {
    auth.mockResolvedValue({ user: { id: 'user1' } } as any)
    getSubscriptionStatus.mockResolvedValue({
      isPremium: false,
      premiumExpiresAt: null,
      subscription: null,
    } as any)
    prisma.payment.findMany.mockResolvedValue([] as any)

    const { default: Page } = await import('@/app/(main)/settings/subscription/page')
    const result = await Page({ searchParams: Promise.resolve({}) } as any)
    render(result)

    expect(
      screen.queryByRole('heading', { level: 2, name: /ご利用中の特典/ }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/広告非表示（サイト全体）/)).not.toBeInTheDocument()
  })

  it('非プレミアム会員の場合は料金プランを表示', async () => {
     
    auth.mockResolvedValue({ user: { id: 'user1' } } as any)
    getSubscriptionStatus.mockResolvedValue({
      isPremium: false,
      premiumExpiresAt: null,
      subscription: null,
     
    } as any)
     
    prisma.payment.findMany.mockResolvedValue([] as any)

    const { default: Page } = await import('@/app/(main)/settings/subscription/page')
     
    const result = await Page({ searchParams: Promise.resolve({}) } as any)
    render(result)

    expect(screen.queryByTestId('subscription-status')).not.toBeInTheDocument()

    const pricingCards = screen.getAllByTestId('pricing-card')
    expect(pricingCards).toHaveLength(2)
    expect(pricingCards[0]).toHaveTextContent('月額プラン: ¥350')
    expect(pricingCards[1]).toHaveTextContent('年額プラン: ¥3500')
  })

  it('支払い履歴がない場合は表示しない', async () => {
     
    auth.mockResolvedValue({ user: { id: 'user1' } } as any)
    getSubscriptionStatus.mockResolvedValue({
      isPremium: false,
      premiumExpiresAt: null,
      subscription: null,
     
    } as any)
     
    prisma.payment.findMany.mockResolvedValue([] as any)

    const { default: Page } = await import('@/app/(main)/settings/subscription/page')
     
    const result = await Page({ searchParams: Promise.resolve({}) } as any)
    render(result)

    expect(screen.queryByTestId('payment-history')).not.toBeInTheDocument()
  })
})
