/**
 * AdminPremiumPage - coverage boost
 *
 * Targets uncovered branches:
 * - Error from getPremiumUsers/getPremiumStats/getAdminPremiumStatus
 * - User with expiring-soon premiumExpiresAt (isExpiringSoon)
 * - User with expired premiumExpiresAt (isExpired)
 * - User with no avatarUrl (fallback div)
 * - totalRevenue being null/0 (the || 0 fallback)
 * - adminStatus being null (no AdminPremiumToggle rendered)
 * - Page 1 (no "prev" button)
 * - Last page (no "next" button)
 */

import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/actions/admin/premium', () => ({
  getPremiumUsers: vi.fn(),
  getPremiumStats: vi.fn(),
  getAdminPremiumStatus: vi.fn(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

vi.mock('@/app/admin/premium/PremiumActionsDropdown', () => ({
  PremiumActionsDropdown: ({ userName }: { userName: string }) => (
    <div data-testid="actions-dropdown">{userName}</div>
  ),
}))

vi.mock('@/app/admin/premium/AdminPremiumToggle', () => ({
  AdminPremiumToggle: ({ isPremium }: { isPremium: boolean }) => (
    <div data-testid="admin-toggle">{isPremium ? 'ON' : 'OFF'}</div>
  ),
}))

describe('AdminPremiumPage - coverage boost', () => {
  let getPremiumUsers: ReturnType<typeof vi.fn>
  let getPremiumStats: ReturnType<typeof vi.fn>
  let getAdminPremiumStatus: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/lib/actions/admin/premium')
    getPremiumUsers = mod.getPremiumUsers as ReturnType<typeof vi.fn>
    getPremiumStats = mod.getPremiumStats as ReturnType<typeof vi.fn>
    getAdminPremiumStatus = mod.getAdminPremiumStatus as ReturnType<typeof vi.fn>
  })

  it('handles error from getPremiumUsers gracefully (empty table)', async () => {
    getPremiumUsers.mockResolvedValue({ error: 'Not authorized' })
    getPremiumStats.mockResolvedValue({ totalPremiumUsers: 0, newThisMonth: 0, expiringIn7Days: 0, totalRevenue: 0 })
    getAdminPremiumStatus.mockResolvedValue({ error: 'Not authorized' })

    const { default: Page } = await import('@/app/admin/premium/page')
    const result = await Page({ searchParams: Promise.resolve({}) } as never)
    render(result)

    expect(screen.getByText('プレミアム会員が見つかりません')).toBeInTheDocument()
    expect(screen.getByText('全 0 件')).toBeInTheDocument()
  })

  it('handles error from getPremiumStats (no stats cards)', async () => {
    getPremiumUsers.mockResolvedValue({ users: [], total: 0 })
    getPremiumStats.mockResolvedValue({ error: 'DB error' })
    getAdminPremiumStatus.mockResolvedValue({ isPremium: false })

    const { default: Page } = await import('@/app/admin/premium/page')
    const result = await Page({ searchParams: Promise.resolve({}) } as never)
    render(result)

    // Stats section should not render
    expect(screen.queryByText('総プレミアム会員')).not.toBeInTheDocument()
    // But admin toggle should still render
    expect(screen.getByTestId('admin-toggle')).toBeInTheDocument()
  })

  it('handles null adminStatus (no admin toggle)', async () => {
    getPremiumUsers.mockResolvedValue({ users: [], total: 0 })
    getPremiumStats.mockResolvedValue({ totalPremiumUsers: 0, newThisMonth: 0, expiringIn7Days: 0, totalRevenue: 0 })
    getAdminPremiumStatus.mockResolvedValue({ error: 'error' })

    const { default: Page } = await import('@/app/admin/premium/page')
    const result = await Page({ searchParams: Promise.resolve({}) } as never)
    render(result)

    expect(screen.queryByTestId('admin-toggle')).not.toBeInTheDocument()
  })

  it('displays expired user with correct status badge', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString() // yesterday
    getPremiumUsers.mockResolvedValue({
      users: [{
        id: 'u1',
        nickname: 'Expired User',
        email: 'expired@test.com',
        avatarUrl: null,
        isPremium: true,
        premiumExpiresAt: pastDate,
        stripeSubscriptionId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      }],
      total: 1,
    })
    getPremiumStats.mockResolvedValue({ totalPremiumUsers: 1, newThisMonth: 0, expiringIn7Days: 0, totalRevenue: null })
    getAdminPremiumStatus.mockResolvedValue({ isPremium: false })

    const { default: Page } = await import('@/app/admin/premium/page')
    const result = await Page({ searchParams: Promise.resolve({}) } as never)
    render(result)

    expect(screen.getByText('期限切れ')).toBeInTheDocument()
    // totalRevenue null should fallback to 0
    expect(screen.getByText('¥0')).toBeInTheDocument()
  })

  it('displays expiring-soon user with highlighted date', async () => {
    // 3 days from now (within 7-day warning window but not expired)
    const soonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    getPremiumUsers.mockResolvedValue({
      users: [{
        id: 'u2',
        nickname: 'Expiring User',
        email: 'expiring@test.com',
        avatarUrl: '/avatar.jpg',
        isPremium: true,
        premiumExpiresAt: soonDate,
        stripeSubscriptionId: 'sub_123',
        createdAt: null,
      }],
      total: 1,
    })
    getPremiumStats.mockResolvedValue({ totalPremiumUsers: 1, newThisMonth: 1, expiringIn7Days: 1, totalRevenue: 5000 })
    getAdminPremiumStatus.mockResolvedValue({ isPremium: true })

    const { default: Page } = await import('@/app/admin/premium/page')
    const result = await Page({ searchParams: Promise.resolve({}) } as never)
    render(result)

    // Should show Stripe badge (not expired, has stripeSubscriptionId)
    expect(screen.getByText('Stripe連携')).toBeInTheDocument()
    // Avatar image should render
    expect(screen.getByAltText('Expiring User')).toBeInTheDocument()
    // createdAt is null, should show "-"
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('renders user with no premiumExpiresAt as "無期限"', async () => {
    getPremiumUsers.mockResolvedValue({
      users: [{
        id: 'u3',
        nickname: 'Unlimited',
        email: 'unlimited@test.com',
        avatarUrl: null,
        isPremium: true,
        premiumExpiresAt: null,
        stripeSubscriptionId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      }],
      total: 1,
    })
    getPremiumStats.mockResolvedValue({ totalPremiumUsers: 1, newThisMonth: 0, expiringIn7Days: 0, totalRevenue: 0 })
    getAdminPremiumStatus.mockResolvedValue({ error: 'err' })

    const { default: Page } = await import('@/app/admin/premium/page')
    const result = await Page({ searchParams: Promise.resolve({}) } as never)
    render(result)

    expect(screen.getByText('無期限')).toBeInTheDocument()
    expect(screen.getByText('手動付与')).toBeInTheDocument()
  })

  it('first page: 前へ はリンクではなく span、nextCursor があれば 次へ はリンク', async () => {
    const users = Array.from({ length: 20 }, (_, i) => ({
      id: `u${i}`,
      nickname: `User ${i}`,
      email: `u${i}@test.com`,
      avatarUrl: null,
      isPremium: true,
      premiumExpiresAt: null,
      stripeSubscriptionId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    }))
    getPremiumUsers.mockResolvedValue({ users, total: 40, nextCursor: 'next-id' })
    getPremiumStats.mockResolvedValue({ totalPremiumUsers: 40, newThisMonth: 0, expiringIn7Days: 0, totalRevenue: 0 })
    getAdminPremiumStatus.mockResolvedValue({ error: 'err' })

    const { default: Page } = await import('@/app/admin/premium/page')
    const result = await Page({ searchParams: Promise.resolve({}) } as never)
    render(result)

    const prev = screen.getByText('前へ')
    expect(prev.tagName).toBe('SPAN')
    const next = screen.getByText('次へ')
    expect(next.tagName).toBe('A')
  })

  it('last page (cursor set, no nextCursor): 前へ はリンク、次へ は span', async () => {
    const users = Array.from({ length: 10 }, (_, i) => ({
      id: `u${i}`,
      nickname: `User ${i}`,
      email: `u${i}@test.com`,
      avatarUrl: null,
      isPremium: true,
      premiumExpiresAt: null,
      stripeSubscriptionId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    }))
    getPremiumUsers.mockResolvedValue({ users, total: 30 })
    getPremiumStats.mockResolvedValue({ totalPremiumUsers: 30, newThisMonth: 0, expiringIn7Days: 0, totalRevenue: 0 })
    getAdminPremiumStatus.mockResolvedValue({ error: 'err' })

    const { default: Page } = await import('@/app/admin/premium/page')
    const result = await Page({ searchParams: Promise.resolve({ cursor: 'c2' }) } as never)
    render(result)

    const prev = screen.getByText('前へ')
    expect(prev.tagName).toBe('A')
    const next = screen.getByText('次へ')
    expect(next.tagName).toBe('SPAN')
  })
})
