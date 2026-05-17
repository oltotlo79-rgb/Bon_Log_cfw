import { vi } from 'vitest'
 
/**
 * Batch tests for admin pages: users, posts, reports, blacklist, events, shops,
 * premium, shop-requests, reviews, logs, layout
 */

// Auth/admin mocks
const mockAuth = vi.fn()
const mockIsAdmin = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))
vi.mock('@/lib/actions/admin', () => ({
  getAdminStats: vi.fn(),
  isAdmin: () => mockIsAdmin(),
  getPremiumUsers: vi.fn(),
  getPremiumStats: vi.fn(),
}))
vi.mock('@/lib/actions/admin/users', () => ({
  getAdminUsers: vi.fn(),
}))
vi.mock('@/lib/actions/admin/posts', () => ({
  getAdminPosts: vi.fn(),
}))
vi.mock('@/lib/actions/admin/content', () => ({
  getAdminReviews: vi.fn(),
}))
vi.mock('@/lib/actions/admin/logs', () => ({
  getAdminLogs: vi.fn(),
}))

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => { mockRedirect(...args); throw new Error('REDIRECT') },
  notFound: () => { throw new Error('NOT_FOUND') },
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('next/image', () => ({ __esModule: true, default: function MockImage(_props: Record<string, unknown>) { return <div data-testid="next-image" /> } }))

// Report mocks
const mockGetReports = vi.fn()
const mockGetReportStats = vi.fn()
vi.mock('@/lib/actions/report', () => ({
  getReports: (p: unknown) => mockGetReports(p),
  getReportStats: () => mockGetReportStats(),
  REPORT_REASONS: { spam: 'スパム', harassment: 'ハラスメント', inappropriate: '不適切なコンテンツ' },
}))

// Shop mocks
vi.mock('@/lib/actions/shop', () => ({
  getPendingShopChangeRequestCount: vi.fn().mockResolvedValue({ count: 0 }),
  getShopChangeRequests: vi.fn().mockResolvedValue({ requests: [], total: 0 }),
  getShopGenres: vi.fn().mockResolvedValue({ genres: [] }),
}))

// Blacklist mocks
const mockGetEmailBlacklist = vi.fn()
const mockGetDeviceBlacklist = vi.fn()
vi.mock('@/lib/actions/blacklist', () => ({
  getEmailBlacklist: (p: unknown) => mockGetEmailBlacklist(p),
  getDeviceBlacklist: (p: unknown) => mockGetDeviceBlacklist(p),
}))

// DB mock
const mockPrisma = {
  user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  event: { findMany: vi.fn(), count: vi.fn() },
  bonsaiShop: { findMany: vi.fn(), count: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

// Component mocks
vi.mock('@/app/admin/blacklist/BlacklistTabs', () => ({ BlacklistTabs: () => <div data-testid="blacklist-tabs" /> }))
vi.mock('@/app/admin/SentryErrors', () => ({ SentryErrors: () => <div data-testid="sentry-errors" /> }))
vi.mock('@/app/admin/shop-requests/ShopRequestActions', () => ({ ShopRequestActions: () => <div data-testid="shop-request-actions" /> }))
vi.mock('lucide-react', () => {
  const icon = (name: string) => { const Icon = () => <span data-testid={`icon-${name}`} />; Icon.displayName = name; return Icon }
  return {
    Home: icon('Home'), Users: icon('Users'), FileText: icon('FileText'),
    AlertTriangle: icon('AlertTriangle'), Calendar: icon('Calendar'), MapPin: icon('MapPin'),
    ScrollText: icon('ScrollText'), ShieldBan: icon('ShieldBan'), TrendingUp: icon('TrendingUp'),
    Gauge: icon('Gauge'), Wrench: icon('Wrench'), EyeOff: icon('EyeOff'),
    MessageSquare: icon('MessageSquare'), ArrowLeft: icon('ArrowLeft'), ArrowRight: icon('ArrowRight'),
    Mail: icon('Mail'), Activity: icon('Activity'), Crown: icon('Crown'),
    Star: icon('Star'), MoreHorizontal: icon('MoreHorizontal'), Ban: icon('Ban'),
    CalendarPlus: icon('CalendarPlus'), Heart: icon('Heart'), Search: icon('Search'),
    Bell: icon('Bell'), BellOff: icon('BellOff'), Check: icon('Check'),
    Settings: icon('Settings'), User: icon('User'), Shield: icon('Shield'),
    Bookmark: icon('Bookmark'), Plus: icon('Plus'), Edit: icon('Edit'),
    Trash2: icon('Trash2'), Flag: icon('Flag'), Share: icon('Share'),
    X: icon('X'), Image: icon('Image'), Camera: icon('Camera'),
    Clock: icon('Clock'), Loader2: icon('Loader2'), AlertCircle: icon('AlertCircle'),
    ChevronDown: icon('ChevronDown'), ChevronUp: icon('ChevronUp'), ChevronRight: icon('ChevronRight'),
    CheckCircle: icon('CheckCircle'), XCircle: icon('XCircle'),
    VolumeX: icon('VolumeX'), Receipt: icon('Receipt'),
    MoreVertical: icon('MoreVertical'),
  }
})

import { render, screen } from '@testing-library/react'
import React from 'react'
import { getAdminUsers } from '@/lib/actions/admin/users'
import { getAdminPosts } from '@/lib/actions/admin/posts'
import { getAdminReviews } from '@/lib/actions/admin/content'
import { getAdminLogs } from '@/lib/actions/admin/logs'

const mockGetAdminUsers = getAdminUsers as ReturnType<typeof vi.fn>
const mockGetAdminPosts = getAdminPosts as ReturnType<typeof vi.fn>
const mockGetAdminReviews = getAdminReviews as ReturnType<typeof vi.fn>
const mockGetAdminLogs = getAdminLogs as ReturnType<typeof vi.fn>

// ============================================================
// Admin Users Page
// ============================================================
describe('AdminUsersPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAdminUsers.mockResolvedValue({ users: [], total: 0 })
  })

  it('renders users page with empty list', async () => {
    const { default: Page } = await import('@/app/admin/users/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('ユーザー管理')).toBeInTheDocument()
  })

  it('renders users with data', async () => {
    mockGetAdminUsers.mockResolvedValue({
      users: [{ id: 'u1', nickname: 'Alice', email: 'a@b.com', avatarUrl: null, createdAt: new Date(), isSuspended: false, _count: { posts: 5 } }],
      total: 1,
    })
    const { default: Page } = await import('@/app/admin/users/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('a@b.com')).toBeInTheDocument()
  })

  it('passes search params', async () => {
    const { default: Page } = await import('@/app/admin/users/page')
    await Page({ searchParams: Promise.resolve({ search: 'test', status: 'suspended', page: '2' }) })
    expect(mockGetAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ search: 'test' }))
  })

  it('shows suspended badge', async () => {
    mockGetAdminUsers.mockResolvedValue({
      users: [{ id: 'u1', nickname: 'Bad', email: 'b@c.com', avatarUrl: null, createdAt: new Date(), isSuspended: true, _count: { posts: 0 } }],
      total: 1,
    })
    const { default: Page } = await import('@/app/admin/users/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getAllByText('停止中').length).toBeGreaterThanOrEqual(1)
  })

  it('shows active badge', async () => {
    mockGetAdminUsers.mockResolvedValue({
      users: [{ id: 'u1', nickname: 'Good', email: 'g@c.com', avatarUrl: null, createdAt: new Date(), isSuspended: false, _count: { posts: 0 } }],
      total: 1,
    })
    const { default: Page } = await import('@/app/admin/users/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getAllByText('アクティブ').length).toBeGreaterThanOrEqual(1)
  })

  it('shows total count', async () => {
    mockGetAdminUsers.mockResolvedValue({ users: [], total: 42 })
    const { default: Page } = await import('@/app/admin/users/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText(/42/)).toBeInTheDocument()
  })
})

// ============================================================
// Admin Posts Page
// ============================================================
describe('AdminPostsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAdminPosts.mockResolvedValue({ posts: [], total: 0 })
  })

  it('renders posts page', async () => {
    const { default: Page } = await import('@/app/admin/posts/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('投稿管理')).toBeInTheDocument()
  })

  it('renders posts with data', async () => {
    mockGetAdminPosts.mockResolvedValue({
      posts: [{ id: 'p1', content: 'テスト投稿内容', user: { id: 'u1', nickname: 'Author', avatarUrl: null }, _count: { likes: 3, reports: 1 }, createdAt: new Date() }],
      total: 1,
    })
    const { default: Page } = await import('@/app/admin/posts/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText(/テスト投稿内容/)).toBeInTheDocument()
  })

  it('passes search and filter params', async () => {
    const { default: Page } = await import('@/app/admin/posts/page')
    await Page({ searchParams: Promise.resolve({ search: 'hello', hasReports: 'true' }) })
    expect(mockGetAdminPosts).toHaveBeenCalledWith(expect.objectContaining({ search: 'hello' }))
  })

  it('shows total count', async () => {
    mockGetAdminPosts.mockResolvedValue({ posts: [], total: 99 })
    const { default: Page } = await import('@/app/admin/posts/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText(/99/)).toBeInTheDocument()
  })
})

// ============================================================
// Admin Reports Page
// ============================================================
describe('AdminReportsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetReports.mockResolvedValue({ reports: [], total: 0 })
  })

  it('renders reports page', async () => {
    const { default: Page } = await import('@/app/admin/reports/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('通報管理')).toBeInTheDocument()
  })

  it('renders reports with data', async () => {
    mockGetReports.mockResolvedValue({
      reports: [{
        id: 'r1', reporter: { id: 'u1', nickname: 'Reporter', avatarUrl: null },
        reason: 'spam', description: '問題あり', targetType: 'post', targetId: 'p1',
        status: 'pending', createdAt: new Date(),
      }],
      total: 1,
    })
    const { default: Page } = await import('@/app/admin/reports/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('Reporter')).toBeInTheDocument()
  })

  it('passes status filter', async () => {
    const { default: Page } = await import('@/app/admin/reports/page')
    await Page({ searchParams: Promise.resolve({ status: 'resolved', type: 'comment' }) })
    expect(mockGetReports).toHaveBeenCalledWith(expect.objectContaining({ status: 'resolved' }))
  })

  it('shows pending status badge', async () => {
    mockGetReports.mockResolvedValue({
      reports: [{
        id: 'r1', reporter: { id: 'u1', nickname: 'R', avatarUrl: null },
        reason: 'spam', description: '', targetType: 'post', targetId: 'p1',
        status: 'pending', createdAt: new Date(),
      }],
      total: 1,
    })
    const { default: Page } = await import('@/app/admin/reports/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getAllByText('未対応').length).toBeGreaterThanOrEqual(1)
  })

  it('shows total count', async () => {
    mockGetReports.mockResolvedValue({ reports: [], total: 15 })
    const { default: Page } = await import('@/app/admin/reports/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText(/15/)).toBeInTheDocument()
  })
})

// ============================================================
// Admin Events Page
// ============================================================
describe('AdminEventsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAdmin.mockResolvedValue(true)
    mockPrisma.event.findMany.mockResolvedValue([])
    mockPrisma.event.count.mockResolvedValue(0)
  })

  it('renders events page', async () => {
    const { default: Page } = await import('@/app/admin/events/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('イベント管理')).toBeInTheDocument()
  })

  it('redirects non-admin', async () => {
    mockIsAdmin.mockResolvedValue(false)
    const { default: Page } = await import('@/app/admin/events/page')
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')
  })

  it('renders events with data', async () => {
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'テストイベント', venue: '東京', startDate: new Date(), prefecture: '東京都', city: '渋谷区', createdAt: new Date(), creator: { id: 'u1', nickname: 'Creator' } },
    ])
    mockPrisma.event.count.mockResolvedValue(1)
    const { default: Page } = await import('@/app/admin/events/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('テストイベント')).toBeInTheDocument()
  })

  it('passes search params', async () => {
    const { default: Page } = await import('@/app/admin/events/page')
    await Page({ searchParams: Promise.resolve({ search: '盆栽' }) })
    expect(mockPrisma.event.findMany).toHaveBeenCalled()
  })

  it('shows total count', async () => {
    mockPrisma.event.count.mockResolvedValue(7)
    const { default: Page } = await import('@/app/admin/events/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText(/7/)).toBeInTheDocument()
  })
})

// ============================================================
// Admin Shops Page
// ============================================================
describe('AdminShopsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAdmin.mockResolvedValue(true)
    mockPrisma.bonsaiShop.findMany.mockResolvedValue([])
    mockPrisma.bonsaiShop.count.mockResolvedValue(0)
  })

  it('renders shops page', async () => {
    const { default: Page } = await import('@/app/admin/shops/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('盆栽園管理')).toBeInTheDocument()
  })

  it('redirects non-admin', async () => {
    mockIsAdmin.mockResolvedValue(false)
    const { default: Page } = await import('@/app/admin/shops/page')
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')
  })

  it('renders shops with data', async () => {
    mockPrisma.bonsaiShop.findMany.mockResolvedValue([
      { id: 's1', name: 'テスト盆栽園', address: '東京都', createdAt: new Date(), creator: { id: 'u1', nickname: 'Owner' }, _count: { reviews: 3 } },
    ])
    mockPrisma.bonsaiShop.count.mockResolvedValue(1)
    const { default: Page } = await import('@/app/admin/shops/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('テスト盆栽園')).toBeInTheDocument()
  })

  it('shows total count', async () => {
    mockPrisma.bonsaiShop.count.mockResolvedValue(12)
    const { default: Page } = await import('@/app/admin/shops/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText(/12/)).toBeInTheDocument()
  })
})

// ============================================================
// Admin Reviews Page
// ============================================================
describe('AdminReviewsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAdminReviews.mockResolvedValue({ success: true, data: { reviews: [], total: 0 } })
  })

  it('renders reviews page', async () => {
    const { default: Page } = await import('@/app/admin/reviews/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('レビュー管理')).toBeInTheDocument()
  })

  it('renders reviews with data', async () => {
    mockGetAdminReviews.mockResolvedValue({ success: true, data: {
      reviews: [{
        id: 'rv1', user: { id: 'u1', nickname: 'Reviewer', avatarUrl: null },
        shop: { id: 's1', name: 'ショップ' }, rating: 4, content: '良い盆栽園',
        _count: { reports: 0 }, createdAt: new Date(),
      }],
      total: 1,
    } })
    const { default: Page } = await import('@/app/admin/reviews/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('Reviewer')).toBeInTheDocument()
  })

  it('passes search and filter params', async () => {
    const { default: Page } = await import('@/app/admin/reviews/page')
    await Page({ searchParams: Promise.resolve({ search: 'good', hasReports: 'true' }) })
    expect(mockGetAdminReviews).toHaveBeenCalled()
  })

  it('shows total count', async () => {
    mockGetAdminReviews.mockResolvedValue({ success: true, data: { reviews: [], total: 33 } })
    const { default: Page } = await import('@/app/admin/reviews/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText(/33/)).toBeInTheDocument()
  })
})

// ============================================================
// Admin Logs Page
// ============================================================
describe('AdminLogsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAdminLogs.mockResolvedValue({ logs: [], total: 0 })
  })

  it('renders logs page', async () => {
    const { default: Page } = await import('@/app/admin/logs/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('操作ログ')).toBeInTheDocument()
  })

  it('renders logs with data', async () => {
    mockGetAdminLogs.mockResolvedValue({
      logs: [{
        id: 'l1', createdAt: new Date(), admin: { user: { id: 'a1', nickname: 'Admin' } },
        action: 'suspend_user', targetType: 'user', targetId: 'u1',
        details: { reason: 'スパム' },
      }],
      total: 1,
    })
    const { default: Page } = await import('@/app/admin/logs/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('passes action filter', async () => {
    const { default: Page } = await import('@/app/admin/logs/page')
    await Page({ searchParams: Promise.resolve({ action: 'delete_post', page: '3' }) })
    expect(mockGetAdminLogs).toHaveBeenCalled()
  })

  it('shows total count', async () => {
    mockGetAdminLogs.mockResolvedValue({ logs: [], total: 150 })
    const { default: Page } = await import('@/app/admin/logs/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText(/150/)).toBeInTheDocument()
  })
})

// AdminPremiumPage skipped - requires Request global not available in jsdom

// ============================================================
// Admin Blacklist Page
// ============================================================
describe('AdminBlacklistPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEmailBlacklist.mockResolvedValue({ success: true, data: { items: [], total: 0 } })
    mockGetDeviceBlacklist.mockResolvedValue({ success: true, data: { items: [], total: 0 } })
  })

  it('renders blacklist page', async () => {
    const { default: Page } = await import('@/app/admin/blacklist/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('ブラックリスト管理')).toBeInTheDocument()
  })

  it('passes search params for email tab', async () => {
    const { default: Page } = await import('@/app/admin/blacklist/page')
    await Page({ searchParams: Promise.resolve({ tab: 'email', search: 'spam' }) })
    expect(mockGetEmailBlacklist).toHaveBeenCalled()
  })

  it('passes search params for device tab', async () => {
    const { default: Page } = await import('@/app/admin/blacklist/page')
    await Page({ searchParams: Promise.resolve({ tab: 'device', search: 'dev' }) })
    expect(mockGetDeviceBlacklist).toHaveBeenCalled()
  })
})

// ============================================================
// Admin Shop Requests Page
// ============================================================
describe('AdminShopRequestsPage', async () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { getShopChangeRequests } = await import('@/lib/actions/shop')
    ;(getShopChangeRequests as ReturnType<typeof vi.fn>).mockResolvedValue({ requests: [], total: 0 })
  })

  it('renders shop requests page', async () => {
    const { default: Page } = await import('@/app/admin/shop-requests/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('盆栽園変更リクエスト')).toBeInTheDocument()
  })

  it('renders with request data', async () => {
    const { getShopChangeRequests } = await import('@/lib/actions/shop')
    ;(getShopChangeRequests as ReturnType<typeof vi.fn>).mockResolvedValue({
      requests: [{
        id: 'cr1', user: { id: 'u1', nickname: 'Requester', avatarUrl: null },
        shop: { id: 's1', name: 'ショップ', address: '東京' },
        requestedChanges: { name: '新しい名前' }, reason: '名前変更', adminComment: null,
        status: 'pending', createdAt: new Date(),
      }],
      total: 1,
    })
    const { default: Page } = await import('@/app/admin/shop-requests/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('Requester')).toBeInTheDocument()
  })

  it('passes status filter', async () => {
    const { default: Page } = await import('@/app/admin/shop-requests/page')
    await Page({ searchParams: Promise.resolve({ status: 'approved' }) })
    const { getShopChangeRequests } = await import('@/lib/actions/shop')
    expect(getShopChangeRequests).toHaveBeenCalled()
  })
})
