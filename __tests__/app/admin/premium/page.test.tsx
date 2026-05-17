import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// モック
vi.mock('@/lib/actions/admin/premium', () => ({
  getPremiumUsers: vi.fn(),
  getPremiumStats: vi.fn(),
  getAdminPremiumStatus: vi.fn().mockResolvedValue({ isAdmin: true, isPremiumConfirmMode: false }),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,  // eslint-disable-line @next/next/no-img-element
}))

vi.mock('@/app/admin/premium/PremiumActionsDropdown', () => ({
  PremiumActionsDropdown: ({ userName }: any) => <div data-testid="actions-dropdown">{userName}</div>,
}))

describe('AdminPremiumPage', async () => {
  const { getPremiumUsers, getPremiumStats } = await import('@/lib/actions/admin/premium')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('プレミアムユーザーと統計を表示', async () => {
    const mockUsers = [
      {
        id: 'user1',
        nickname: 'User 1',
        email: 'user1@example.com',
        avatarUrl: '/avatar1.jpg',
        isPremium: true,
        premiumExpiresAt: '2027-12-31T23:59:59.000Z', // Future date
        stripeSubscriptionId: 'sub_123',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'user2',
        nickname: 'User 2',
        email: 'user2@example.com',
        avatarUrl: null,
        isPremium: true,
        premiumExpiresAt: null,
        stripeSubscriptionId: null,
        createdAt: '2024-01-15T00:00:00.000Z',
      },
    ]

    const mockStats = {
      totalPremiumUsers: 100,
      newThisMonth: 10,
      expiringIn7Days: 5,
      totalRevenue: 350000,
    }

     
    getPremiumUsers.mockResolvedValue({ users: mockUsers, total: 2 } as any)
     
    getPremiumStats.mockResolvedValue(mockStats as any)

    const { default: Page } = await import('@/app/admin/premium/page')
     
    const result = await Page({ searchParams: Promise.resolve({}) } as any)
    render(result)

    // タイトル
    expect(screen.getByText('プレミアム会員管理')).toBeInTheDocument()
    expect(screen.getByText('全 2 件')).toBeInTheDocument()

    // 統計カード
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('¥350,000')).toBeInTheDocument()

    // ユーザーテーブル
    expect(screen.getAllByText('User 1').length).toBeGreaterThan(0)
    expect(screen.getByText('user1@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('User 2').length).toBeGreaterThan(0)
    expect(screen.getByText('user2@example.com')).toBeInTheDocument()

    // ステータス
    expect(screen.getByText('Stripe連携')).toBeInTheDocument()
    expect(screen.getByText('手動付与')).toBeInTheDocument()
  })

  it('ユーザーがいない場合', async () => {
     
    getPremiumUsers.mockResolvedValue({ users: [], total: 0 } as any)
    getPremiumStats.mockResolvedValue({
      totalPremiumUsers: 0,
      newThisMonth: 0,
      expiringIn7Days: 0,
      totalRevenue: 0,
     
    } as any)

    const { default: Page } = await import('@/app/admin/premium/page')
     
    const result = await Page({ searchParams: Promise.resolve({}) } as any)
    render(result)

    expect(screen.getByText('プレミアム会員が見つかりません')).toBeInTheDocument()
  })

  it('検索パラメータを反映', async () => {
     
    getPremiumUsers.mockResolvedValue({ users: [], total: 0 } as any)
    getPremiumStats.mockResolvedValue({
      totalPremiumUsers: 0,
      newThisMonth: 0,
      expiringIn7Days: 0,
      totalRevenue: 0,
     
    } as any)

    const { default: Page } = await import('@/app/admin/premium/page')
    const result = await Page({
      searchParams: Promise.resolve({ search: 'test', page: '2' }),
     
    } as any)
    render(result)

    const searchInput = screen.getByPlaceholderText('ニックネーム・メールアドレスで検索')
    expect(searchInput).toHaveValue('test')
  })

  it('cursor がセットされると CursorPagination が「前へ」リンクと「次へ」リンク（nextCursor がある場合）を表示する', async () => {
    const mockUsers = Array.from({ length: 20 }, (_, i) => ({
      id: `user${i}`,
      nickname: `User ${i}`,
      email: `user${i}@example.com`,
      avatarUrl: null,
      isPremium: true,
      premiumExpiresAt: null,
      stripeSubscriptionId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    }))


    getPremiumUsers.mockResolvedValue({ users: mockUsers, total: 50, nextCursor: 'next-id' } as any)
    getPremiumStats.mockResolvedValue({
      totalPremiumUsers: 50,
      newThisMonth: 5,
      expiringIn7Days: 2,
      totalRevenue: 175000,

    } as any)

    const { default: Page } = await import('@/app/admin/premium/page')

    const result = await Page({ searchParams: Promise.resolve({ cursor: 'cur1' }) } as any)
    render(result)

    // cursor があるので「前へ」はリンク
    const prev = screen.getByText('前へ')
    expect(prev.tagName).toBe('A')
    // nextCursor があるので「次へ」もリンク
    const next = screen.getByText('次へ')
    expect(next.tagName).toBe('A')
    expect(screen.getByText(/全 50 件/)).toBeInTheDocument()
  })
})
