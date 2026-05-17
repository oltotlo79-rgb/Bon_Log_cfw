import { vi } from 'vitest'
/**
 * Batch test for (main) pages with auth+redirect pattern:
 * feed, notifications, drafts, bonsai, bonsai/new, messages, analytics
 */

// Common mocks
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => { mockRedirect(...args); throw new Error('REDIRECT') },
  notFound: vi.fn(),
  // BonsaiViewSwitcher / BonsaiCalendarToolbar 等で利用する Client フック
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
}))

vi.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('next/image', () => ({ __esModule: true, default: function MockImage(_props: Record<string, unknown>) { return <div data-testid="next-image" /> } }))

// Feed mocks
const mockGetTimeline = vi.fn()
const mockGetGenres = vi.fn()
const mockGetDraftCount = vi.fn()
const mockGetBonsaisAction = vi.fn()
vi.mock('@/lib/actions/feed', () => ({ getTimeline: () => mockGetTimeline() }))
vi.mock('@/lib/actions/post', () => ({ getGenres: () => mockGetGenres() }))
vi.mock('@/lib/actions/draft', () => ({
  getDrafts: vi.fn().mockResolvedValue({ success: true, data: { drafts: [] } }),
  getDraftCount: () => mockGetDraftCount(),
}))
vi.mock('@/lib/actions/bonsai', () => ({ getBonsais: () => mockGetBonsaisAction() }))
vi.mock('@/lib/premium', () => ({
  getMembershipLimits: vi.fn().mockResolvedValue({ maxPostLength: 500, maxImages: 4, maxVideos: 1, canSchedulePost: false, canViewAnalytics: false }),
  isPremiumUser: vi.fn().mockResolvedValue(false),
  // 未認証フォールバック用（feed/page.tsx で直接 import される）
  FREE_LIMITS: { maxPostLength: 500, maxImages: 4, maxVideos: 1, maxDailyPosts: 20, canSchedulePost: false, canViewAnalytics: false },
}))

// Notification mocks
const mockGetNotifications = vi.fn()
vi.mock('@/lib/actions/notification', () => ({ getNotifications: () => mockGetNotifications() }))
vi.mock('@/lib/services/notification-core', () => ({ getNotifications: () => mockGetNotifications() }))

// Message mocks
const mockGetConversations = vi.fn()
vi.mock('@/lib/actions/message', () => ({ getConversations: () => mockGetConversations() }))

// Analytics mocks — ActionResult<T> 形式に合わせる
vi.mock('@/lib/actions/analytics', () => ({
  getPostAnalytics: vi.fn().mockResolvedValue({ success: false, error: 'x' }),
  getLikeAnalytics: vi.fn().mockResolvedValue({ success: false, error: 'x' }),
  getQuoteAnalytics: vi.fn().mockResolvedValue({ success: false, error: 'x' }),
  getKeywordAnalytics: vi.fn().mockResolvedValue({ success: false, error: 'x' }),
  getEngagementTrend: vi.fn().mockResolvedValue({ success: false, error: 'x' }),
  getGenrePerformance: vi.fn().mockResolvedValue({ success: false, error: 'x' }),
  getFollowerGrowth: vi.fn().mockResolvedValue({ success: false, error: 'x' }),
  getPeriodComparison: vi.fn().mockResolvedValue({ success: false, error: 'x' }),
}))

// Block/Mute mocks
const mockGetBlockedUsers = vi.fn()
const mockGetMutedUsers = vi.fn()
vi.mock('@/lib/actions/block', () => ({ getBlockedUsers: () => mockGetBlockedUsers() }))
vi.mock('@/lib/actions/mute', () => ({ getMutedUsers: () => mockGetMutedUsers() }))

// Follow request mocks
const mockGetReceivedFollowRequests = vi.fn()
const mockGetSentFollowRequests = vi.fn()
vi.mock('@/lib/actions/follow-request', () => ({
  getReceivedFollowRequests: () => mockGetReceivedFollowRequests(),
  getSentFollowRequests: () => mockGetSentFollowRequests(),
}))

// Component mocks
vi.mock('@/components/feed/Timeline', () => ({ Timeline: () => <div data-testid="timeline" /> }))
vi.mock('@/components/feed/TimelineSkeleton', () => ({ TimelineSkeleton: () => <div data-testid="timeline-skeleton" /> }))
vi.mock('@/components/feed/ComposeButton', () => ({ ComposeButton: () => <div data-testid="compose-btn" /> }))
vi.mock('@/components/notification/NotificationList', () => ({ NotificationList: () => <div data-testid="notification-list" /> }))
vi.mock('@/components/draft/DraftCard', () => ({ DraftCard: ({ draft }: { draft: { id: string } }) => <div data-testid={`draft-${draft.id}`} /> }))
vi.mock('@/components/bonsai/BonsaiListClient', () => ({ BonsaiListClient: () => <div data-testid="bonsai-list" /> }))
vi.mock('@/components/bonsai/BonsaiForm', () => ({ BonsaiForm: () => <div data-testid="bonsai-form" /> }))
vi.mock('@/components/analytics/AnalyticsDashboard', () => ({ AnalyticsDashboard: () => <div data-testid="analytics-dashboard" /> }))
vi.mock('@/components/analytics/PeriodFilter', () => ({ PeriodFilter: () => <div data-testid="period-filter" /> }))
vi.mock('@/components/subscription/PremiumUpgradeCard', () => ({ PremiumUpgradeCard: ({ title }: { title: string }) => <div data-testid="premium-card">{title}</div> }))
vi.mock('@/components/user/BlockedUserList', () => ({ BlockedUserList: () => <div data-testid="blocked-list" /> }))
vi.mock('@/components/user/MutedUserList', () => ({ MutedUserList: () => <div data-testid="muted-list" /> }))
vi.mock('@/app/(main)/settings/follow-requests/FollowRequestsClient', () => ({ FollowRequestsClient: () => <div data-testid="follow-requests-client" /> }))
vi.mock('lucide-react', () => {
  const icon = (name: string) => { const Icon = () => <span data-testid={`icon-${name}`} />; Icon.displayName = name; return Icon }
  return {
    __esModule: true,
    Heart: icon('Heart'), MessageSquare: icon('MessageSquare'), Search: icon('Search'),
    Bell: icon('Bell'), BellOff: icon('BellOff'), Crown: icon('Crown'), Check: icon('Check'),
    Star: icon('Star'), Settings: icon('Settings'), User: icon('User'), Users: icon('Users'),
    Shield: icon('Shield'), Ban: icon('Ban'), VolumeX: icon('VolumeX'),
    Bookmark: icon('Bookmark'), Plus: icon('Plus'), MoreHorizontal: icon('MoreHorizontal'),
    Edit: icon('Edit'), Trash2: icon('Trash2'), Flag: icon('Flag'), Share: icon('Share'),
    X: icon('X'), Image: icon('Image'), Camera: icon('Camera'), Clock: icon('Clock'),
    Loader2: icon('Loader2'), AlertCircle: icon('AlertCircle'), FileText: icon('FileText'),
    Calendar: icon('Calendar'), MapPin: icon('MapPin'), Home: icon('Home'),
    ArrowLeft: icon('ArrowLeft'), ArrowRight: icon('ArrowRight'), List: icon('List'),
    CalendarPlus: icon('CalendarPlus'), CalendarDays: icon('CalendarDays'), BarChart3: icon('BarChart3'),
    Activity: icon('Activity'), Mail: icon('Mail'),
    CheckCircle: icon('CheckCircle'), XCircle: icon('XCircle'),
    ChevronDown: icon('ChevronDown'), ChevronUp: icon('ChevronUp'),
    ChevronLeft: icon('ChevronLeft'), ChevronRight: icon('ChevronRight'),
    Pencil: icon('Pencil'),
    MessageCircle: icon('MessageCircle'), TrendingUp: icon('TrendingUp'),
  }
})

import { render, screen } from '@testing-library/react'
import React from 'react'

describe('FeedPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockGetTimeline.mockResolvedValue({ posts: [] })
    mockGetGenres.mockResolvedValue({ genres: {} })
    mockGetDraftCount.mockResolvedValue(0)
    mockGetBonsaisAction.mockResolvedValue({ bonsais: [] })
  })

  it('renders feed page with compose button', async () => {
    const { default: Page } = await import('@/app/(main)/feed/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('タイムライン')).toBeInTheDocument()
    expect(screen.getByTestId('compose-btn')).toBeInTheDocument()
  })

  it('renders without session', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/feed/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('タイムライン')).toBeInTheDocument()
  })

  it('handles undefined posts in timeline result', async () => {
    mockGetTimeline.mockResolvedValue({ posts: undefined })
    const { default: Page } = await import('@/app/(main)/feed/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('タイムライン')).toBeInTheDocument()
  })

  it('handles undefined genres in genres result', async () => {
    mockGetGenres.mockResolvedValue({ genres: undefined })
    const { default: Page } = await import('@/app/(main)/feed/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('タイムライン')).toBeInTheDocument()
  })

  it('handles undefined bonsais in bonsais result', async () => {
    mockGetBonsaisAction.mockResolvedValue({ bonsais: undefined })
    const { default: Page } = await import('@/app/(main)/feed/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('タイムライン')).toBeInTheDocument()
  })
})

describe('NotificationsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetNotifications.mockResolvedValue({ notifications: [] })
  })

  it('renders notification page', async () => {
    const { default: Page } = await import('@/app/(main)/notifications/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('通知')).toBeInTheDocument()
    expect(screen.getByTestId('notification-list')).toBeInTheDocument()
  })

  it('handles missing notifications', async () => {
    mockGetNotifications.mockResolvedValue({})
    const { default: Page } = await import('@/app/(main)/notifications/page')
    const result = await Page()
    render(result)
    expect(screen.getByTestId('notification-list')).toBeInTheDocument()
  })
})

describe('DraftsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('renders normally when not authenticated (proxy handles auth)', async () => {
    mockAuth.mockResolvedValue(null)
    const { getDrafts } = await import('@/lib/actions/draft')
    ;(getDrafts as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: '認証が必要です' })
    const { default: Page } = await import('@/app/(main)/drafts/page')
    const result = await Page()
    render(result)
    // Page renders with 0 drafts when getDrafts returns error
    expect(screen.getByText('下書き')).toBeInTheDocument()
    expect(screen.getByText('0件の下書き')).toBeInTheDocument()
  })

  it('renders empty drafts', async () => {
    const { getDrafts } = await import('@/lib/actions/draft')
    ;(getDrafts as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ drafts: [] })
    const { default: Page } = await import('@/app/(main)/drafts/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('下書き')).toBeInTheDocument()
    expect(screen.getByText('下書きがありません')).toBeInTheDocument()
    expect(screen.getByText('0件の下書き')).toBeInTheDocument()
  })

  it('renders drafts list', async () => {
    const { getDrafts } = await import('@/lib/actions/draft')
    ;(getDrafts as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, data: { drafts: [{ id: 'd1', content: 'test', createdAt: new Date(), updatedAt: new Date(), media: [], genres: [] }] } })
    const { default: Page } = await import('@/app/(main)/drafts/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('1件の下書き')).toBeInTheDocument()
    expect(screen.getByTestId('draft-d1')).toBeInTheDocument()
  })
})

describe('BonsaiListPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockGetBonsaisAction.mockResolvedValue({ bonsais: [] })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/bonsai/page')
    // ページは searchParams: Promise を受ける（Next.js 16 仕様）
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')
  })

  it('renders bonsai list', async () => {
    const { default: Page } = await import('@/app/(main)/bonsai/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByTestId('bonsai-list')).toBeInTheDocument()
  })
})

describe('NewBonsaiPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/bonsai/new/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
  })

  it('renders bonsai form', async () => {
    const { default: Page } = await import('@/app/(main)/bonsai/new/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('盆栽を登録')).toBeInTheDocument()
    expect(screen.getByTestId('bonsai-form')).toBeInTheDocument()
  })
})

describe('MessagesPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockGetConversations.mockResolvedValue({ success: true, data: { conversations: [] } })
  })

  it('renders normally when not authenticated (proxy handles auth)', { timeout: 20000 }, async () => {
    mockAuth.mockResolvedValue(null)
    mockGetConversations.mockResolvedValue({ success: true, data: { conversations: [] } })
    vi.resetModules()
    const { default: Page } = await import('@/app/(main)/messages/page')
    const result = await Page()
    render(result)
    // Page renders with empty messages when not authenticated
    expect(screen.getByText('メッセージ')).toBeInTheDocument()
    expect(screen.getByText('まだメッセージはありません')).toBeInTheDocument()
  })

  it('renders empty messages', async () => {
    vi.resetModules()
    const { default: Page } = await import('@/app/(main)/messages/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('メッセージ')).toBeInTheDocument()
    expect(screen.getByText('まだメッセージはありません')).toBeInTheDocument()
  })

  it('renders conversation list', async () => {
    mockGetConversations.mockResolvedValue({ success: true, data: { conversations: [
      { id: 'c1', updatedAt: new Date(), otherUser: { id: 'u2', nickname: 'Alice', avatarUrl: null }, lastMessage: { content: 'こんにちは' }, hasUnread: true },
    ] } })
    vi.resetModules()
    const { default: Page } = await import('@/app/(main)/messages/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('こんにちは')).toBeInTheDocument()
  })

  it('renders conversation with avatar', async () => {
    mockGetConversations.mockResolvedValue({ success: true, data: { conversations: [
      { id: 'c1', updatedAt: new Date(), otherUser: { id: 'u2', nickname: 'Bob', avatarUrl: '/bob.jpg' }, lastMessage: null, hasUnread: false },
    ] } })
    vi.resetModules()
    const { default: Page } = await import('@/app/(main)/messages/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('メッセージなし')).toBeInTheDocument()
  })

  it('renders deleted user conversation', async () => {
    mockGetConversations.mockResolvedValue({ success: true, data: { conversations: [
      { id: 'c1', updatedAt: new Date(), otherUser: null, lastMessage: null, hasUnread: false },
    ] } })
    vi.resetModules()
    const { default: Page } = await import('@/app/(main)/messages/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('削除されたユーザー')).toBeInTheDocument()
  })
})

describe('AnalyticsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/analytics/page')
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT')
  })

  it('shows premium upgrade for non-premium users', async () => {
    const { default: Page } = await import('@/app/(main)/analytics/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('投稿分析')).toBeInTheDocument()
    expect(screen.getByTestId('premium-card')).toBeInTheDocument()
  })

  it('shows analytics page header for premium users', async () => {
    const { isPremiumUser } = await import('@/lib/premium')
    ;(isPremiumUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
    const { default: Page } = await import('@/app/(main)/analytics/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByText('投稿分析')).toBeInTheDocument()
    // Suspense境界内のダッシュボードは非同期サーバーコンポーネントのためunit testでは検証不可
  })

  // ============================================================
  // VALID_PERIODS の3項分岐 (7 / 30 / 90 / それ以外→30) を踏む
  // ============================================================
  it.each([
    { days: '7', label: 'days=7 (valid)' },
    { days: '30', label: 'days=30 (valid)' },
    { days: '90', label: 'days=90 (valid)' },
    { days: '999', label: 'days=999 (invalid → fallback)' },
    { days: 'foo', label: 'days=foo (NaN → fallback)' },
    { days: undefined, label: 'days undefined → fallback' },
  ])('renders for premium users with $label', async ({ days }) => {
    const { isPremiumUser } = await import('@/lib/premium')
    ;(isPremiumUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
    const { default: Page } = await import('@/app/(main)/analytics/page')
    const result = await Page({
      searchParams: Promise.resolve(days === undefined ? {} : { days }),
    })
    render(result)
    expect(screen.getByText('投稿分析')).toBeInTheDocument()
    // PeriodFilter は常に表示される
    expect(screen.getByTestId('period-filter')).toBeInTheDocument()
  })
})

describe('BlockedUsersPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockGetBlockedUsers.mockResolvedValue({ users: [] })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/settings/blocked/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
  })

  it('renders empty blocked list', async () => {
    const { default: Page } = await import('@/app/(main)/settings/blocked/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('ブロック中のユーザー')).toBeInTheDocument()
    expect(screen.getByText('ブロック中のユーザーはいません')).toBeInTheDocument()
  })

  it('renders blocked users list', async () => {
    mockGetBlockedUsers.mockResolvedValue({ users: [{ id: 'u2' }] })
    const { default: Page } = await import('@/app/(main)/settings/blocked/page')
    const result = await Page()
    render(result)
    expect(screen.getByTestId('blocked-list')).toBeInTheDocument()
  })
})

describe('MutedUsersPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockGetMutedUsers.mockResolvedValue({ users: [] })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/settings/muted/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
  })

  it('renders empty muted list', async () => {
    const { default: Page } = await import('@/app/(main)/settings/muted/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('ミュート中のユーザー')).toBeInTheDocument()
    expect(screen.getByText('ミュート中のユーザーはいません')).toBeInTheDocument()
  })

  it('renders muted users list', async () => {
    mockGetMutedUsers.mockResolvedValue({ users: [{ id: 'u2' }] })
    const { default: Page } = await import('@/app/(main)/settings/muted/page')
    const result = await Page()
    render(result)
    expect(screen.getByTestId('muted-list')).toBeInTheDocument()
  })
})

describe('FollowRequestsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockGetReceivedFollowRequests.mockResolvedValue({ requests: [] })
    mockGetSentFollowRequests.mockResolvedValue({ requests: [] })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/settings/follow-requests/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
  })

  it('renders follow requests page', async () => {
    const { default: Page } = await import('@/app/(main)/settings/follow-requests/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('フォローリクエスト')).toBeInTheDocument()
    expect(screen.getByTestId('follow-requests-client')).toBeInTheDocument()
  })
})
