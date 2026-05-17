import { vi } from 'vitest'
 
/**
 * Batch tests for detail/edit pages:
 * bonsai/[id], bonsai/[id]/edit, events/[id], events/[id]/edit,
 * shops/[id], shops/[id]/edit, messages/[conversationId],
 * posts/scheduled/new, posts/scheduled/[id]/edit,
 * posts/[id] error/not-found/loading
 */

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRedirect = vi.fn()
const mockNotFound = vi.fn(() => { throw new Error('NOT_FOUND') })
vi.mock('next/navigation', () => ({
  redirect: (url: any) => { mockRedirect(url); throw new Error('REDIRECT') },
  notFound: () => mockNotFound(),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('next/image', () => ({ __esModule: true, default: function MockImage(_props: Record<string, unknown>) { return <div data-testid="next-image" /> } }))

// Bonsai mocks
const mockGetBonsai = vi.fn()
const mockGetPostsByBonsai = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  getBonsai: (id: string) => mockGetBonsai(id),
  getPostsByBonsai: (id: string) => mockGetPostsByBonsai(id),
}))

// Event mocks
const mockGetEvent = vi.fn()
vi.mock('@/lib/actions/event', () => ({
  getEvent: (id: string) => mockGetEvent(id),
  getEvents: vi.fn().mockResolvedValue({ events: [] }),
}))

// Shop mocks
const mockGetShop = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  getShop: (id: string) => mockGetShop(id),
  getShopGenres: vi.fn().mockResolvedValue({ genres: [] }),
  getShops: vi.fn().mockResolvedValue({ shops: [] }),
}))

// Message mocks
const mockGetConversation = vi.fn()
const mockGetMessages = vi.fn()
vi.mock('@/lib/actions/message', () => ({
  getConversation: (id: string) => mockGetConversation(id),
  getMessages: (id: string) => mockGetMessages(id),
  getConversations: vi.fn().mockResolvedValue({ success: true, data: { conversations: [] } }),
}))

// DB mock for scheduled posts
const mockPrisma = {
  scheduledPost: { findFirst: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

// Premium mock
vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn().mockResolvedValue(false),
  getMembershipLimits: vi.fn().mockResolvedValue({ maxPostLength: 500, maxImages: 4, maxVideos: 1, canSchedulePost: true, canViewAnalytics: true }),
}))

// Genre & membership mocks
vi.mock('@/lib/actions/post', () => ({
  getGenres: vi.fn().mockResolvedValue({ genres: {} }),
  getPostsByBonsai: vi.fn().mockResolvedValue({ success: true, data: { posts: [] } }),
}))
// getMembershipLimits is in @/lib/premium (already mocked above)

// Component mocks
// Bonsai components
vi.mock('@/components/bonsai/BonsaiForm', () => ({ BonsaiForm: () => <div data-testid="bonsai-form" /> }))
vi.mock('@/components/bonsai/BonsaiTimeline', () => ({ BonsaiTimeline: () => <div data-testid="bonsai-timeline" /> }))
vi.mock('@/components/bonsai/BonsaiRecordForm', () => ({ BonsaiRecordForm: () => <div data-testid="bonsai-record-form" /> }))
vi.mock('@/components/bonsai/BonsaiActions', () => ({ BonsaiActions: () => <div data-testid="bonsai-actions" /> }))
// Event components
vi.mock('@/components/event/EventForm', () => ({ EventForm: () => <div data-testid="event-form" /> }))
vi.mock('@/components/event/EventActionsDropdown', () => ({ EventActionsDropdown: () => <div data-testid="event-actions" /> }))
// Shop components
vi.mock('@/components/shop/ShopForm', () => ({ ShopForm: () => <div data-testid="shop-form" /> }))
vi.mock('@/components/shop/MapWrapper', () => ({ MapWrapper: () => <div data-testid="map-wrapper" />, MapWrapperSmall: () => <div data-testid="map-small" /> }))
vi.mock('@/components/shop/StarRating', () => ({ StarRatingDisplay: () => <div data-testid="star-rating" /> }))
vi.mock('@/components/shop/ReviewForm', () => ({ ReviewForm: () => <div data-testid="review-form" /> }))
vi.mock('@/components/shop/ReviewList', () => ({ ReviewList: () => <div data-testid="review-list" /> }))
vi.mock('@/components/shop/ShopActions', () => ({ ShopActions: () => <div data-testid="shop-actions" /> }))
vi.mock('@/components/shop/ShopGenreEditor', () => ({ ShopGenreEditor: () => <div data-testid="genre-editor" /> }))
// Message components
vi.mock('@/components/message/MessageList', () => ({ MessageList: () => <div data-testid="message-list" /> }))
vi.mock('@/components/message/MessageForm', () => ({ MessageForm: () => <div data-testid="message-form" /> }))
// Post components
vi.mock('@/components/post/ScheduledPostForm', () => ({ ScheduledPostForm: () => <div data-testid="scheduled-form" /> }))
vi.mock('@/components/common/LoadingScreen', () => ({ LoadingScreen: () => <div data-testid="loading-screen" /> }))
// Draft components
vi.mock('@/components/draft/DraftEditForm', () => ({ DraftEditForm: () => <div data-testid="draft-edit-form" /> }))
vi.mock('@/lib/actions/draft', () => ({
  getDraft: vi.fn().mockResolvedValue({ draft: { id: 'd1', content: 'draft', genres: [], media: [] } }),
}))
vi.mock('lucide-react', () => {
  const icon = (name: string) => { const Icon = () => <span data-testid={`icon-${name}`} />; Icon.displayName = name; return Icon }
  return {
    Heart: icon('Heart'), MessageSquare: icon('MessageSquare'), Search: icon('Search'),
    Bell: icon('Bell'), BellOff: icon('BellOff'), Crown: icon('Crown'), Check: icon('Check'),
    Star: icon('Star'), Settings: icon('Settings'), User: icon('User'), Users: icon('Users'),
    Shield: icon('Shield'), Ban: icon('Ban'), VolumeX: icon('VolumeX'),
    Bookmark: icon('Bookmark'), Plus: icon('Plus'), MoreHorizontal: icon('MoreHorizontal'),
    Edit: icon('Edit'), Trash2: icon('Trash2'), Flag: icon('Flag'), Share: icon('Share'),
    X: icon('X'), Image: icon('Image'), ImageIcon: icon('ImageIcon'), Camera: icon('Camera'),
    Clock: icon('Clock'), Loader2: icon('Loader2'), AlertCircle: icon('AlertCircle'),
    FileText: icon('FileText'), Calendar: icon('Calendar'), MapPin: icon('MapPin'),
    Home: icon('Home'), ArrowLeft: icon('ArrowLeft'), ArrowRight: icon('ArrowRight'),
    CalendarPlus: icon('CalendarPlus'), CheckCircle: icon('CheckCircle'),
    XCircle: icon('XCircle'), ChevronDown: icon('ChevronDown'), ChevronUp: icon('ChevronUp'),
    ChevronLeft: icon('ChevronLeft'), ChevronRight: icon('ChevronRight'),
    MessageCircle: icon('MessageCircle'), TrendingUp: icon('TrendingUp'),
    ExternalLink: icon('ExternalLink'), Receipt: icon('Receipt'),
  }
})

import { render, screen } from '@testing-library/react'
import React from 'react'

// ============================================================
// Bonsai Detail Page
// ============================================================
describe('BonsaiDetailPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockGetBonsai.mockResolvedValue({
      success: true,
      data: {
        bonsai: {
          id: 'b1',
          name: 'テスト松',
          species: '黒松',
          userId: 'u1',
          description: '大切な盆栽',
          acquiredDate: new Date(),
          imageUrl: '/img.jpg',
          records: [],
          // getBonsai の include 契約に合わせて JSON-LD 生成に必要なフィールドを揃える
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-15T00:00:00Z'),
          user: { id: 'u1', nickname: 'テストユーザー', avatarUrl: null },
        },
      },
    })
    mockGetPostsByBonsai.mockResolvedValue({ success: true, data: { posts: [] } })
  })

  it('renders bonsai detail', async () => {
    const { default: Page } = await import('@/app/(main)/bonsai/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'b1' }) })
    render(result)
    expect(screen.getByRole('heading', { name: 'テスト松' })).toBeInTheDocument()
  })

  it('calls notFound when bonsai missing', async () => {
    mockGetBonsai.mockResolvedValue({ success: false, error: 'Not found' })
    const { default: Page } = await import('@/app/(main)/bonsai/[id]/page')
    await expect(Page({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('shows owner actions for owner', async () => {
    const { default: Page } = await import('@/app/(main)/bonsai/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'b1' }) })
    render(result)
    expect(screen.getByText('成長記録を追加')).toBeInTheDocument()
  })

  it('hides owner actions for non-owner', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u2' } })
    const { default: Page } = await import('@/app/(main)/bonsai/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'b1' }) })
    render(result)
    expect(screen.queryByText('成長記録を追加')).not.toBeInTheDocument()
  })

  it('shows back link', async () => {
    const { default: Page } = await import('@/app/(main)/bonsai/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'b1' }) })
    render(result)
    expect(screen.getByText('マイ盆栽に戻る')).toBeInTheDocument()
  })

  it('generateMetadata returns bonsai name', async () => {
     
    const mod = await import('@/app/(main)/bonsai/[id]/page') as any
    const { generateMetadata } = mod
    if (generateMetadata) {
      const result = await generateMetadata({ params: Promise.resolve({ id: 'b1' }) })
      expect(result.title).toContain('テスト松')
    }
  })
})

// ============================================================
// Bonsai Edit Page
// ============================================================
describe('BonsaiEditPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockGetBonsai.mockResolvedValue({
      success: true,
      data: {
        bonsai: { id: 'b1', name: 'テスト松', species: '黒松', userId: 'u1' },
      },
    })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/bonsai/[id]/edit/page')
    await expect(Page({ params: Promise.resolve({ id: 'b1' }) })).rejects.toThrow('REDIRECT')
  })

  it('redirects when not owner', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u2' } })
    const { default: Page } = await import('@/app/(main)/bonsai/[id]/edit/page')
    await expect(Page({ params: Promise.resolve({ id: 'b1' }) })).rejects.toThrow('REDIRECT')
  })

  it('renders edit form for owner', async () => {
    const { default: Page } = await import('@/app/(main)/bonsai/[id]/edit/page')
    const result = await Page({ params: Promise.resolve({ id: 'b1' }) })
    render(result)
    expect(screen.getByText('盆栽を編集')).toBeInTheDocument()
  })

  it('calls notFound when bonsai missing', async () => {
    mockGetBonsai.mockResolvedValue({ success: false, error: 'Not found' })
    const { default: Page } = await import('@/app/(main)/bonsai/[id]/edit/page')
    await expect(Page({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow()
  })
})

// ============================================================
// Event Detail Page
// ============================================================
describe('EventDetailPage', async () => {
  const mockEvent = {
    id: 'e1', title: 'テストイベント', description: '盆栽展示会',
    startDate: new Date('2025-06-01'), endDate: new Date('2025-06-02'),
    venue: '東京ビッグサイト', prefecture: '東京都', city: '江東区',
    organizer: '盆栽協会', admissionFee: '無料', externalUrl: 'https://example.com',
    hasSales: true, creator: { id: 'u1', nickname: 'Creator' },
    createdAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEvent.mockResolvedValue({ success: true, data: { event: mockEvent } })
  })

  it('renders event detail', async () => {
    const { default: Page } = await import('@/app/(main)/events/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'e1' }) })
    render(result)
    expect(screen.getByRole('heading', { name: 'テストイベント' })).toBeInTheDocument()
  }, 20000)

  it('calls notFound when event missing', async () => {
    mockGetEvent.mockResolvedValue({ success: false, error: 'Not found' })
    const { default: Page } = await import('@/app/(main)/events/[id]/page')
    await expect(Page({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('shows sales badge when hasSales', async () => {
    const { default: Page } = await import('@/app/(main)/events/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'e1' }) })
    render(result)
    expect(screen.getByText('即売あり')).toBeInTheDocument()
  })

  it('shows back link', async () => {
    const { default: Page } = await import('@/app/(main)/events/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'e1' }) })
    render(result)
    expect(screen.getByText('イベント一覧に戻る')).toBeInTheDocument()
  })

  it('shows venue info', async () => {
    const { default: Page } = await import('@/app/(main)/events/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'e1' }) })
    render(result)
    expect(screen.getByText(/東京ビッグサイト/)).toBeInTheDocument()
  })

  it('generateMetadata returns event title', async () => {
    const { generateMetadata } = await import('@/app/(main)/events/[id]/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'e1' }) })
    expect(result.title).toContain('テストイベント')
  })

  it('generateMetadata returns fallback for missing event', async () => {
    mockGetEvent.mockResolvedValue({ success: false, error: 'Not found' })
    const { generateMetadata } = await import('@/app/(main)/events/[id]/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'x' }) })
    expect(result.title).toBeDefined()
  })
})

// ============================================================
// Event Edit Page
// ============================================================
describe('EventEditPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockGetEvent.mockResolvedValue({
      success: true,
      data: { event: { id: 'e1', title: 'テスト', isOwner: true, creatorId: 'u1', creator: { id: 'u1' } } },
    })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/events/[id]/edit/page')
    await expect(Page({ params: Promise.resolve({ id: 'e1' }) })).rejects.toThrow('REDIRECT')
  })

  it('redirects when not owner', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u2' } })
    mockGetEvent.mockResolvedValue({
      success: true,
      data: { event: { id: 'e1', title: 'テスト', isOwner: false, creatorId: 'u1', creator: { id: 'u1' } } },
    })
    const { default: Page } = await import('@/app/(main)/events/[id]/edit/page')
    await expect(Page({ params: Promise.resolve({ id: 'e1' }) })).rejects.toThrow('REDIRECT')
  })

  it('renders edit form for owner', async () => {
    const { default: Page } = await import('@/app/(main)/events/[id]/edit/page')
    const result = await Page({ params: Promise.resolve({ id: 'e1' }) })
    render(result)
    expect(screen.getByText('イベントを編集')).toBeInTheDocument()
  })

  it('calls notFound when event missing', async () => {
    mockGetEvent.mockResolvedValue({ success: false, error: 'not found' })
    const { default: Page } = await import('@/app/(main)/events/[id]/edit/page')
    await expect(Page({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NOT_FOUND')
  })
})

// ============================================================
// Shop Detail Page
// ============================================================
describe('ShopDetailPage', async () => {
  const mockShopData = {
    id: 's1', name: 'テスト盆栽園', address: '東京都渋谷区', phone: '03-1234-5678',
    website: 'https://example.com', businessHours: '9:00-17:00', closedDays: '月曜',
    description: '素晴らしい盆栽園', imageUrl: '/shop.jpg',
    creator: { id: 'u1', nickname: 'Owner' }, reviews: [],
    latitude: 35.6, longitude: 139.7, genres: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockGetShop.mockResolvedValue({ shop: mockShopData })
  })

  it('renders shop detail', async () => {
    const { default: Page } = await import('@/app/(main)/shops/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 's1' }) })
    render(result)
    expect(screen.getByRole('heading', { name: 'テスト盆栽園' })).toBeInTheDocument()
  })

  it('calls notFound when shop missing', async () => {
    mockGetShop.mockResolvedValue({ error: 'Not found' })
    const { default: Page } = await import('@/app/(main)/shops/[id]/page')
    await expect(Page({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('shows back link', async () => {
    const { default: Page } = await import('@/app/(main)/shops/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 's1' }) })
    render(result)
    expect(screen.getByText('盆栽園マップに戻る')).toBeInTheDocument()
  })

  it('shows address', async () => {
    const { default: Page } = await import('@/app/(main)/shops/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 's1' }) })
    render(result)
    expect(screen.getByText(/東京都渋谷区/)).toBeInTheDocument()
  })

  it('generateMetadata returns shop name', async () => {
    const { generateMetadata } = await import('@/app/(main)/shops/[id]/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 's1' }) })
    expect(result.title).toContain('テスト盆栽園')
  })

  it('generateMetadata returns fallback for missing shop', async () => {
    mockGetShop.mockResolvedValue({ error: 'Not found' })
    const { generateMetadata } = await import('@/app/(main)/shops/[id]/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'x' }) })
    expect(result.title).toBeDefined()
  })
})

// ============================================================
// Shop Edit Page
// ============================================================
describe('ShopEditPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockGetShop.mockResolvedValue({
      shop: { id: 's1', name: 'テスト盆栽園', isOwner: true, creatorId: 'u1', creator: { id: 'u1' } },
    })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/shops/[id]/edit/page')
    await expect(Page({ params: Promise.resolve({ id: 's1' }) })).rejects.toThrow('REDIRECT')
  })

  it('redirects when not owner', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u2' } })
    mockGetShop.mockResolvedValue({
      shop: { id: 's1', name: 'テスト', isOwner: false, creatorId: 'u1' },
    })
    const { default: Page } = await import('@/app/(main)/shops/[id]/edit/page')
    await expect(Page({ params: Promise.resolve({ id: 's1' }) })).rejects.toThrow('REDIRECT')
  })

  it('renders edit form for owner', async () => {
    const { default: Page } = await import('@/app/(main)/shops/[id]/edit/page')
    const result = await Page({ params: Promise.resolve({ id: 's1' }) })
    render(result)
    expect(screen.getByText('盆栽園を編集')).toBeInTheDocument()
  })

  it('calls notFound when shop missing', async () => {
    mockGetShop.mockResolvedValue({ shop: null, error: 'not found' })
    const { default: Page } = await import('@/app/(main)/shops/[id]/edit/page')
    await expect(Page({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NOT_FOUND')
  })
})

// ============================================================
// Conversation Detail Page
// ============================================================
describe('ConversationPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockGetConversation.mockResolvedValue({
      success: true,
      data: { conversation: { id: 'c1', otherUser: { id: 'u2', nickname: 'Partner', avatarUrl: null } } },
    })
    mockGetMessages.mockResolvedValue({ success: true, data: { messages: [], currentUserId: 'u1' } })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/messages/[conversationId]/page')
    await expect(Page({ params: Promise.resolve({ conversationId: 'c1' }) })).rejects.toThrow('REDIRECT')
  })

  it('renders conversation page', async () => {
    const { default: Page } = await import('@/app/(main)/messages/[conversationId]/page')
    const result = await Page({ params: Promise.resolve({ conversationId: 'c1' }) })
    render(result)
    expect(screen.getByText('Partner')).toBeInTheDocument()
  })

  it('calls notFound when conversation missing', async () => {
    mockGetConversation.mockResolvedValue({ success: true, data: { conversation: null } })
    const { default: Page } = await import('@/app/(main)/messages/[conversationId]/page')
    await expect(Page({ params: Promise.resolve({ conversationId: 'x' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('generateMetadata returns partner name', async () => {
    const { generateMetadata } = await import('@/app/(main)/messages/[conversationId]/page')
    if (generateMetadata) {
      const result = await generateMetadata({ params: Promise.resolve({ conversationId: 'c1' }) })
      expect(result.title).toContain('Partner')
    }
  })

  it('generateMetadata returns default title when conversation not found', async () => {
    mockGetConversation.mockResolvedValue({ success: false, error: '会話が見つかりません' })
    const { generateMetadata } = await import('@/app/(main)/messages/[conversationId]/page')
    if (generateMetadata) {
      const result = await generateMetadata({ params: Promise.resolve({ conversationId: 'invalid' }) })
      expect(result.title).toBe('メッセージ - BON-LOG')
    }
  })

  it('calls notFound when messages result has error', async () => {
    mockGetMessages.mockResolvedValue({ success: false, error: 'メッセージ取得に失敗しました' })
    const { default: Page } = await import('@/app/(main)/messages/[conversationId]/page')
    await expect(Page({ params: Promise.resolve({ conversationId: 'c1' }) })).rejects.toThrow('NOT_FOUND')
  })
})

// ============================================================
// Scheduled Post New Page
// ============================================================
describe('NewScheduledPostPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/posts/scheduled/new/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
  })

  it('redirects non-premium users', async () => {
    const { default: Page } = await import('@/app/(main)/posts/scheduled/new/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
  })

  it('renders for premium users', async () => {
    const { isPremiumUser } = await import('@/lib/premium')
    ;(isPremiumUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
    const { default: Page } = await import('@/app/(main)/posts/scheduled/new/page')
    const result = await Page()
    render(result)
    expect(screen.getByText(/予約投稿/)).toBeInTheDocument()
  })
})

// ============================================================
// Scheduled Post Edit Page
// ============================================================
describe('EditScheduledPostPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.scheduledPost.findFirst.mockResolvedValue({
      id: 'sp1', userId: 'u1', status: 'pending', content: 'test', scheduledAt: new Date(),
      media: [], genres: [],
    })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/posts/scheduled/[id]/edit/page')
    await expect(Page({ params: Promise.resolve({ id: 'sp1' }) })).rejects.toThrow('REDIRECT')
  })

  it('redirects non-premium users', async () => {
    const { default: Page } = await import('@/app/(main)/posts/scheduled/[id]/edit/page')
    await expect(Page({ params: Promise.resolve({ id: 'sp1' }) })).rejects.toThrow('REDIRECT')
  })

  it('calls notFound when post not found', async () => {
    const { isPremiumUser } = await import('@/lib/premium')
    ;(isPremiumUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
    mockPrisma.scheduledPost.findFirst.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/posts/scheduled/[id]/edit/page')
    await expect(Page({ params: Promise.resolve({ id: 'sp1' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('renders edit form for premium owner with pending post', async () => {
    const { isPremiumUser } = await import('@/lib/premium')
    ;(isPremiumUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
    const { default: Page } = await import('@/app/(main)/posts/scheduled/[id]/edit/page')
    const result = await Page({ params: Promise.resolve({ id: 'sp1' }) })
    render(result)
    expect(screen.getByText(/予約投稿/)).toBeInTheDocument()
  })
})

// ============================================================
// Post Error Page
// ============================================================
describe('PostErrorPage', async () => {
  it('renders error page with message', async () => {
    const { default: ErrorPage } = await import('@/app/(main)/posts/[id]/error')
    render(<ErrorPage error={new Error('test')} reset={vi.fn()} />)
    expect(screen.getByText('投稿を表示できません')).toBeInTheDocument()
  })

  it('shows retry button', async () => {
    const { default: ErrorPage } = await import('@/app/(main)/posts/[id]/error')
    render(<ErrorPage error={new Error('test')} reset={vi.fn()} />)
    expect(screen.getByText('再試行')).toBeInTheDocument()
  })

  it('shows timeline link', async () => {
    const { default: ErrorPage } = await import('@/app/(main)/posts/[id]/error')
    render(<ErrorPage error={new Error('test')} reset={vi.fn()} />)
    expect(screen.getByText('タイムラインへ')).toBeInTheDocument()
  })
})

// ============================================================
// Post Not Found Page
// ============================================================
describe('PostNotFoundPage', async () => {
  it('renders not found page', async () => {
    const { default: NotFoundPage } = await import('@/app/(main)/posts/[id]/not-found')
    render(<NotFoundPage />)
    expect(screen.getByText(/見つかりません/i)).toBeInTheDocument()
  })

  it('has link to timeline', async () => {
    const { default: NotFoundPage } = await import('@/app/(main)/posts/[id]/not-found')
    render(<NotFoundPage />)
    const link = screen.getByRole('link')
    expect(link).toBeInTheDocument()
  })
})

// ============================================================
// Post Loading Page
// ============================================================
describe('PostLoadingPage', async () => {
  it('renders loading skeleton', async () => {
    const { default: Loading } = await import('@/app/(main)/posts/[id]/loading')
    render(<Loading />)
    // Loading pages typically render skeletons/spinners
    expect(document.querySelector('.animate-pulse') || document.querySelector('[data-testid]')).toBeTruthy()
  })
})

// ============================================================
// Main Loading Page
// ============================================================
describe('MainLoadingPage', async () => {
  it('renders loading screen', async () => {
    const { default: Loading } = await import('@/app/(main)/loading')
    render(<Loading />)
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument()
  })
})
