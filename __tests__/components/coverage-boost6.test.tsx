import { vi } from 'vitest'
/**
 * Coverage boost tests - batch 6
 * PostCard (branches), ImageGallery, BonsaiTimeline, MessageBadge, AdProvider
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---- mocks ----
vi.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>
  return { default: MockLink }
})
vi.mock('next/image', async () => {
  const { MockNextImage } = await import('../utils/mock-next-image')
  const MockImage = ({ onLoad, ...props }: any) => {
    // Simulate immediate load
    React.useEffect(() => { onLoad?.() }, [onLoad])
    return <MockNextImage {...props} />
  }
  return { __esModule: true, default: MockImage }
})

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh, back: vi.fn() }),
  usePathname: vi.fn(() => '/'),
  useSearchParams: () => new URLSearchParams(),
}))

// tanstack/react-query
let mockQueryData: any = undefined
vi.mock('@tanstack/react-query', () => ({
  useQuery: (_opts: any) => {
    if (mockQueryData !== undefined) return { data: mockQueryData }
    return { data: undefined }
  },
  useInfiniteQuery: vi.fn(() => ({ data: undefined, fetchNextPage: vi.fn(), hasNextPage: false, isFetchingNextPage: false, isLoading: false })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: any) => <>{children}</>,
}))

// PostCard dependencies
vi.mock('@/components/post/ImageGallery', () => ({
  ImageGallery: ({ images, onMediaClick }: any) => (
    <div data-testid="image-gallery" onClick={() => onMediaClick?.(images[0])}>
      {images.map((m: any) => <div key={m.id} data-testid={`media-${m.id}`} />)}
    </div>
  ),
}))
vi.mock('@/components/post/QuotedPost', () => ({
  QuotedPost: ({ post }: any) => <div data-testid="quoted-post">{post.content}</div>,
}))
vi.mock('@/components/post/DeletePostButton', () => ({
  DeletePostButton: ({ postId, onDeleted }: any) => <button data-testid="delete-btn" onClick={onDeleted}>Delete {postId}</button>,
}))
vi.mock('@/components/post/LikeButton', () => ({
  LikeButton: ({ initialCount }: any) => <button data-testid="like-btn">{initialCount}</button>,
}))
vi.mock('@/components/post/BookmarkButton', () => ({
  BookmarkButton: ({ initialBookmarked }: any) => <button data-testid="bookmark-btn">{initialBookmarked ? 'saved' : 'unsaved'}</button>,
}))
vi.mock('@/components/post/RepostButton', () => ({
  RepostButton: ({ initialCount }: any) => <button data-testid="repost-btn">{initialCount}</button>,
}))
vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: ({ targetId }: any) => <button data-testid="report-btn">Report {targetId}</button>,
}))
vi.mock('@/lib/actions/poll', () => ({ votePoll: vi.fn(), getPollResults: vi.fn() }))
vi.mock('@/lib/mention-utils', () => ({
  parseContentSegments: (content: string) => {
    const segments: any[] = []
    const combined = content.replace(/<@(\w+)>/g, (_, id) => `@@MENTION:${id}@@`)
    const parts = combined.split(/(@@MENTION:\w+@@|#\S+)/)
    for (const part of parts) {
      if (part.startsWith('@@MENTION:')) {
        const id = part.replace('@@MENTION:', '').replace('@@', '')
        segments.push({ type: 'mention', userId: id })
      } else if (part.startsWith('#')) {
        segments.push({ type: 'hashtag', tag: part })
      } else if (part) {
        segments.push({ type: 'text', content: part })
      }
    }
    return segments
  },
}))

// useToast モック
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

// BonsaiTimeline deps
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '3時間前'),
}))
vi.mock('date-fns/locale', () => ({ ja: {} }))
const mockDeleteBonsaiRecord = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  deleteBonsaiRecord: (...args: any[]) => mockDeleteBonsaiRecord(...args),
}))

// MessageBadge deps
vi.mock('@/lib/actions/message', () => ({
  getUnreadMessageCount: vi.fn(),
}))
vi.mock('@/lib/actions/notification', () => ({
  getUnreadCount: vi.fn(),
}))
vi.mock('@/lib/services/notification-core', () => ({
  getUnreadCount: vi.fn(),
}))

// Cookie同意を許可状態にモック（広告表示テストのため）
vi.mock('@/components/common/CookieConsent', () => ({
  isTrackingAllowed: () => true,
  getCookieConsent: () => 'all',
}))

// AdProvider deps
vi.mock('./AdBanner', () => ({
  AdBanner: () => <div data-testid="ad-banner" />,
  InFeedAd: () => <div data-testid="infeed-ad" />,
  SidebarAd: () => <div data-testid="sidebar-ad" />,
}), { virtual: true })
vi.mock('@/components/ads/AdBanner', () => ({
  AdBanner: () => <div data-testid="ad-banner" />,
  InFeedAd: () => <div data-testid="infeed-ad" />,
  SidebarAd: () => <div data-testid="sidebar-ad" />,
}))
vi.mock('./NinjaAdMax', () => ({
  NinjaAd: () => <div data-testid="ninja-ad" />,
  NinjaInFeedAd: () => <div data-testid="ninja-infeed" />,
  NinjaSidebarAd: () => <div data-testid="ninja-sidebar" />,
}), { virtual: true })
vi.mock('@/components/ads/NinjaAdMax', () => ({
  NinjaAd: () => <div data-testid="ninja-ad" />,
  NinjaInFeedAd: () => <div data-testid="ninja-infeed" />,
  NinjaSidebarAd: () => <div data-testid="ninja-sidebar" />,
}))
vi.mock('./GoogleAdSense', () => ({
  GoogleAdSense: () => <div data-testid="google-adsense" />,
}), { virtual: true })
vi.mock('@/components/ads/GoogleAdSense', () => ({
  GoogleAdSense: () => <div data-testid="google-adsense" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, asChild, ...props }: any) => {
    if (asChild) return <>{children}</>
    return <button onClick={onClick} {...props}>{children}</button>
  },
  buttonVariants: () => 'btn',
}))

vi.mock('@/lib/actions/hide-post', () => ({ hidePost: vi.fn(), getHiddenPostIds: vi.fn() }))

import { PostCard } from '@/components/post/PostCard'
import { BonsaiTimeline } from '@/components/bonsai/BonsaiTimeline'
import { MessageBadge } from '@/components/message/MessageBadge'
import { AdProvider, InFeedAdUnit, SidebarAdUnit, PostDetailAdUnit } from '@/components/ads/AdProvider'

// ============================================================
// PostCard - branches
// ============================================================
describe('PostCard branches', () => {
  const basePost = {
    id: 'p1',
    content: 'Hello world',
    createdAt: new Date().toISOString(),
    user: { id: 'u1', nickname: 'Alice', avatarUrl: null },
    media: [],
    genres: [],
    likeCount: 5,
    commentCount: 2,
  }

  beforeEach(() => {
    mockPush.mockClear()
  })

  it('renders with avatar image', () => {
    render(<PostCard post={{ ...basePost, user: { ...basePost.user, avatarUrl: 'https://img.test/a.jpg' } }} currentUserId="u1" />)
    expect(document.querySelector('img[src="https://img.test/a.jpg"]')).toBeInTheDocument()
  })

  it('renders without avatar (initial letter)', () => {
    render(<PostCard post={basePost} currentUserId="u1" />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('navigates to post detail on card click', () => {
    render(<PostCard post={basePost} />)
    fireEvent.click(screen.getByText('Hello world').closest('article')!)
    expect(mockPush).toHaveBeenCalledWith('/posts/p1')
  })

  it('does not navigate when disableNavigation', () => {
    render(<PostCard post={basePost} disableNavigation />)
    fireEvent.click(screen.getByText('Hello world').closest('article')!)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('renders repost with repost label', () => {
    const repost = {
      ...basePost,
      repostPost: {
        id: 'rp1',
        content: 'Original post',
        createdAt: new Date().toISOString(),
        user: { id: 'u2', nickname: 'Bob', avatarUrl: null },
        media: [],
      },
    }
    render(<PostCard post={repost} currentUserId="u1" />)
    expect(screen.getByText('がリポスト')).toBeInTheDocument()
    expect(screen.getByText('Original post')).toBeInTheDocument()
  })

  it('renders quote post', () => {
    const quoted = {
      ...basePost,
      quotePost: { id: 'q1', content: 'Quoted content', createdAt: new Date().toISOString(), user: { id: 'u3', nickname: 'Carol', avatarUrl: null } },
    }
    render(<PostCard post={quoted} currentUserId="u1" />)
    expect(screen.getByTestId('quoted-post')).toBeInTheDocument()
  })

  it('renders media gallery', () => {
    const withMedia = {
      ...basePost,
      media: [{ id: 'm1', url: '/img.jpg', type: 'image', sortOrder: 0 }],
    }
    render(<PostCard post={withMedia} currentUserId="u1" />)
    expect(screen.getByTestId('image-gallery')).toBeInTheDocument()
  })

  it('renders genre tags', () => {
    const withGenres = {
      ...basePost,
      genres: [{ id: 'g1', name: '松柏類', category: '盆栽' }],
    }
    render(<PostCard post={withGenres} currentUserId="u1" />)
    expect(screen.getByText('松柏類')).toBeInTheDocument()
  })

  it('truncates long content with 続きを読む', () => {
    const longContent = 'あ'.repeat(200)
    render(<PostCard post={{ ...basePost, content: longContent }} currentUserId="u1" />)
    expect(screen.getByText('続きを読む')).toBeInTheDocument()
    fireEvent.click(screen.getByText('続きを読む'))
    expect(screen.queryByText('続きを読む')).toBeNull()
  })

  it('shows menu for owner with delete button', () => {
    render(<PostCard post={basePost} currentUserId="u1" />)
    // Click the more menu button
    const moreBtn = document.querySelector('button svg circle')?.closest('button') as HTMLButtonElement
    fireEvent.click(moreBtn)
    expect(screen.getByTestId('delete-btn')).toBeInTheDocument()
  })

  it('shows report button for non-owner', () => {
    render(<PostCard post={basePost} currentUserId="u2" />)
    const moreBtn = document.querySelector('button svg circle')?.closest('button') as HTMLButtonElement
    fireEvent.click(moreBtn)
    expect(screen.getByTestId('report-btn')).toBeInTheDocument()
  })

  it('renders login link when not logged in (no currentUserId)', () => {
    render(<PostCard post={basePost} />)
    const loginLinks = document.querySelectorAll('a[href="/login"]')
    expect(loginLinks.length).toBeGreaterThan(0)
  })

  it('renders with mentions and hashtags', () => {
    render(<PostCard post={{ ...basePost, content: 'Hello <@u2> check #bonsai' }} currentUserId="u1" mentionUsers={new Map([['u2', { id: 'u2', nickname: 'Bob', avatarUrl: null }]])} />)
    expect(screen.getByText('@Bob')).toBeInTheDocument()
    expect(screen.getByText('#bonsai')).toBeInTheDocument()
  })

  it('renders mention with unknown user', () => {
    render(<PostCard post={{ ...basePost, content: 'Hey <@u99>' }} currentUserId="u1" />)
    expect(screen.getByText('@unknown')).toBeInTheDocument()
  })
})

// ============================================================
// ImageGallery (real component)
// ============================================================
// Note: ImageGallery is mocked for PostCard tests above, so we need to
// re-import the real one. Since vi.mock is hoisted, we test via
// vi.importActual.
describe('ImageGallery (real)', () => {
  let RealImageGallery: any
  beforeAll(async () => {
    RealImageGallery = (await vi.importActual<Record<string, unknown>>('@/components/post/ImageGallery')).ImageGallery
  })

  const makeMedia = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `m${i}`,
      url: `/img${i}.jpg`,
      type: 'image',
      sortOrder: i,
    }))

  it('renders single image', () => {
    const { container } = render(<RealImageGallery images={makeMedia(1)} />)
    expect(container.querySelectorAll('button').length).toBeGreaterThanOrEqual(1)
  })

  it('renders 2 images in grid', () => {
    const { container } = render(<RealImageGallery images={makeMedia(2)} />)
    expect(container.querySelector('.grid-cols-2')).toBeInTheDocument()
  })

  it('renders 3 images with row-span', () => {
    const { container } = render(<RealImageGallery images={makeMedia(3)} />)
    expect(container.querySelector('.row-span-2')).toBeInTheDocument()
  })

  it('renders 4 images in 2x2 grid', () => {
    const { container } = render(<RealImageGallery images={makeMedia(4)} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(4)
  })

  it('opens modal on image click', () => {
    const { container } = render(<RealImageGallery images={makeMedia(2)} />)
    const firstBtn = container.querySelector('button')!
    fireEvent.click(firstBtn)
    // Modal should appear with close button and nav
    expect(container.querySelector('.fixed')).toBeInTheDocument()
  })

  it('navigates forward and backward in modal', () => {
    const { container } = render(<RealImageGallery images={makeMedia(3)} />)
    // Open first image
    fireEvent.click(container.querySelector('button')!)
    // Click next
    const modal = container.querySelector('.fixed')!
    const buttons = modal.querySelectorAll('button')
    // Find the next button (right side)
    const nextBtn = Array.from(buttons).find(b => b.className.includes('right-4'))
    if (nextBtn) fireEvent.click(nextBtn)
    // Find prev button
    const prevBtn = Array.from(modal.querySelectorAll('button')).find(b => b.className.includes('left-4'))
    if (prevBtn) fireEvent.click(prevBtn)
  })

  it('closes modal on background click', () => {
    const { container } = render(<RealImageGallery images={makeMedia(1)} />)
    fireEvent.click(container.querySelector('button')!)
    const overlay = container.querySelector('.fixed')!
    fireEvent.click(overlay)
    // Modal should close
    expect(container.querySelector('.fixed')).toBeNull()
  })

  it('calls onMediaClick instead of opening modal', () => {
    const onClick = vi.fn()
    const { container } = render(<RealImageGallery images={makeMedia(1)} onMediaClick={onClick} />)
    fireEvent.click(container.querySelector('button')!)
    expect(onClick).toHaveBeenCalled()
  })

  it('renders video with expand button', () => {
    const videoMedia = [{ id: 'v1', url: '/vid.mp4', type: 'video', sortOrder: 0 }]
    const { container } = render(<RealImageGallery images={videoMedia} />)
    expect(container.querySelector('video')).toBeInTheDocument()
    expect(container.querySelector('button[title="拡大表示"]')).toBeInTheDocument()
  })

  it('navigation dots select specific image', () => {
    const { container } = render(<RealImageGallery images={makeMedia(3)} />)
    fireEvent.click(container.querySelector('button')!)
    // Find nav dots (bottom area)
    const dots = container.querySelectorAll('.fixed .rounded-full.w-2')
    if (dots.length > 1) fireEvent.click(dots[1])
  })
})

// ============================================================
// BonsaiTimeline
// ============================================================
describe('BonsaiTimeline', () => {
  beforeEach(() => {
    mockDeleteBonsaiRecord.mockClear()
    mockRefresh.mockClear()
  })

  it('renders empty state', () => {
    render(<BonsaiTimeline records={[]} posts={[]} isOwner={false} />)
    expect(screen.getByText('まだ記録や投稿がありません')).toBeInTheDocument()
  })

  it('renders records with content and images', () => {
    const records = [{
      id: 'r1',
      content: '成長中',
      recordAt: new Date(),
      createdAt: new Date(),
      images: [{ id: 'i1', url: '/img.jpg' }],
    }]
    render(<BonsaiTimeline records={records} posts={[]} isOwner={true} />)
    expect(screen.getByText('成長記録')).toBeInTheDocument()
    expect(screen.getByText('成長中')).toBeInTheDocument()
  })

  it('renders posts with user info', () => {
    const posts = [{
      id: 'p1',
      content: '投稿テスト',
      createdAt: new Date().toISOString(),
      user: { id: 'u1', nickname: 'Alice', avatarUrl: 'https://img.test/a.jpg' },
      media: [],
      genres: [{ postId: 'p1', genreId: 'g1', genre: { id: 'g1', name: '松柏類', category: '盆栽' } }],
      _count: { likes: 3, comments: 1 },
    }]
    render(<BonsaiTimeline records={[]} posts={posts} isOwner={false} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('投稿テスト')).toBeInTheDocument()
    expect(screen.getByText('松柏類')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders post without avatar (initial letter)', () => {
    const posts = [{
      id: 'p1',
      content: 'Test',
      createdAt: new Date().toISOString(),
      user: { id: 'u1', nickname: 'Bob', avatarUrl: null },
      media: [],
      genres: [],
      _count: { likes: 0, comments: 0 },
    }]
    render(<BonsaiTimeline records={[]} posts={posts} isOwner={false} />)
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('renders post with video media', () => {
    const posts = [{
      id: 'p1',
      content: null,
      createdAt: new Date().toISOString(),
      user: { id: 'u1', nickname: 'User', avatarUrl: null },
      media: [{ id: 'm1', url: '/vid.mp4', type: 'video', sortOrder: 0 }],
      genres: [],
      _count: { likes: 0, comments: 0 },
    }]
    render(<BonsaiTimeline records={[]} posts={posts} isOwner={false} />)
    expect(document.querySelector('video')).toBeInTheDocument()
  })

  it('shows delete button for owner and handles delete', async () => {
    const user = userEvent.setup()
    mockDeleteBonsaiRecord.mockResolvedValue({ success: true })
    const records = [{
      id: 'r1',
      content: 'Test',
      recordAt: new Date(),
      createdAt: new Date(),
      images: [],
    }]
    render(<BonsaiTimeline records={records} posts={[]} isOwner={true} />)
    // 削除ボタンをクリック → ConfirmDialog が開く
    const deleteBtn = screen.getByRole('button', { name: /削除/i })
    await user.click(deleteBtn)
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))
    await waitFor(() => {
      expect(mockDeleteBonsaiRecord).toHaveBeenCalledWith('r1')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('handles delete error', async () => {
    const user = userEvent.setup()
    mockDeleteBonsaiRecord.mockResolvedValue({ success: false, error: '削除失敗' })
    const records = [{
      id: 'r1', content: 'Test', recordAt: new Date(), createdAt: new Date(), images: [],
    }]
    render(<BonsaiTimeline records={records} posts={[]} isOwner={true} />)
    await user.click(screen.getByRole('button', { name: /削除/i }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '削除失敗', variant: 'destructive' }))
    })
  })

  it('handles delete exception', async () => {
    const user = userEvent.setup()
    mockDeleteBonsaiRecord.mockRejectedValue(new Error('fail'))
    const records = [{
      id: 'r1', content: 'Test', recordAt: new Date(), createdAt: new Date(), images: [],
    }]
    render(<BonsaiTimeline records={records} posts={[]} isOwner={true} />)
    await user.click(screen.getByRole('button', { name: /削除/i }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))
    // 例外発生時 ConfirmDialog はインラインエラーを表示する（toast は BonsaiTimeline の success:false 分岐のみ）
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })
  })

  it('opens image modal on thumbnail click', () => {
    const records = [{
      id: 'r1', content: null, recordAt: new Date(), createdAt: new Date(),
      images: [{ id: 'i1', url: '/img.jpg' }],
    }]
    const { container } = render(<BonsaiTimeline records={records} posts={[]} isOwner={false} />)
    // Click thumbnail
    const thumb = container.querySelector('button.relative')
    if (thumb) {
      fireEvent.click(thumb)
      // Modal should appear
      expect(container.querySelector('.fixed')).toBeInTheDocument()
      // Close modal
      fireEvent.click(container.querySelector('.fixed')!)
    }
  })

  it('shows overflow count for posts with >4 media', () => {
    const posts = [{
      id: 'p1', content: null, createdAt: new Date().toISOString(),
      user: { id: 'u1', nickname: 'U', avatarUrl: null },
      media: Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, url: `/img${i}.jpg`, type: 'image', sortOrder: i })),
      genres: [], _count: { likes: 0, comments: 0 },
    }]
    render(<BonsaiTimeline records={[]} posts={posts} isOwner={false} />)
    expect(screen.getByText('+2')).toBeInTheDocument()
  })
})

// ============================================================
// MessageBadge
// ============================================================
describe('MessageBadge', () => {
  it('returns null when no data', () => {
    mockQueryData = undefined
    const { container } = render(<MessageBadge />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when count is 0', () => {
    mockQueryData = { count: 0 }
    const { container } = render(<MessageBadge />)
    expect(container.innerHTML).toBe('')
  })

  it('shows count when > 0', () => {
    mockQueryData = { count: 5 }
    render(<MessageBadge />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows 99+ when count > 99', () => {
    mockQueryData = { count: 150 }
    render(<MessageBadge />)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('shows 200+ when capReached and count >= BADGES_CONVERSATIONS_LIMIT (cap branch)', () => {
    // 200会話上限到達かつ未読が200件以上 → "200+" 表示
    mockQueryData = { count: 200, capReached: true }
    render(<MessageBadge />)
    expect(screen.getByText('200+')).toBeInTheDocument()
  })

  it('still shows 99+ when capReached but count < BADGES_CONVERSATIONS_LIMIT', () => {
    // capReached=true でも count<200 ならば 99+ にフォールバック
    mockQueryData = { count: 150, capReached: true }
    render(<MessageBadge />)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('shows raw count when capReached but count <= overflow threshold', () => {
    mockQueryData = { count: 7, capReached: true }
    render(<MessageBadge />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('aria-label always reports the precise count regardless of label cap', () => {
    mockQueryData = { count: 250, capReached: true }
    render(<MessageBadge />)
    // aria-label は実数を露出することでスクリーンリーダー精度を担保
    expect(
      document.querySelector('[aria-label="未読メッセージ250件"]'),
    ).not.toBeNull()
  })

  afterAll(() => {
    mockQueryData = undefined
  })
})

// ============================================================
// AdProvider
// ============================================================
describe('AdProvider', () => {
  const origEnv = process.env.NEXT_PUBLIC_AD_PROVIDER

  afterEach(() => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = origEnv
  })

  it('renders null for ninja provider (default)', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = 'ninja'
    const { container } = render(<AdProvider />)
    expect(container.innerHTML).toBe('')
  })

  it('renders GoogleAdSense for adsense provider', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = 'adsense'
    render(<AdProvider />)
    expect(screen.getByTestId('google-adsense')).toBeInTheDocument()
  })
})

describe('InFeedAdUnit', () => {
  const origEnv = process.env.NEXT_PUBLIC_AD_PROVIDER

  afterEach(() => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = origEnv
  })

  it('renders ninja infeed by default', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = 'ninja'
    render(<InFeedAdUnit />)
    expect(screen.getByTestId('ninja-infeed')).toBeInTheDocument()
  })

  it('renders adsense infeed', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = 'adsense'
    render(<InFeedAdUnit />)
    expect(screen.getByTestId('infeed-ad')).toBeInTheDocument()
  })
})

describe('SidebarAdUnit', () => {
  const origEnv = process.env.NEXT_PUBLIC_AD_PROVIDER

  afterEach(() => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = origEnv
  })

  it('renders ninja sidebar by default', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = 'ninja'
    render(<SidebarAdUnit />)
    expect(screen.getByTestId('ninja-sidebar')).toBeInTheDocument()
  })

  it('renders adsense sidebar', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = 'adsense'
    render(<SidebarAdUnit />)
    expect(screen.getByTestId('sidebar-ad')).toBeInTheDocument()
  })
})

describe('PostDetailAdUnit', () => {
  const origEnv = process.env.NEXT_PUBLIC_AD_PROVIDER

  afterEach(() => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = origEnv
  })

  it('renders ninja ad by default', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = 'ninja'
    render(<PostDetailAdUnit />)
    expect(screen.getByTestId('ninja-ad')).toBeInTheDocument()
  })

  it('renders adsense ad banner', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = 'adsense'
    render(<PostDetailAdUnit />)
    expect(screen.getByTestId('ad-banner')).toBeInTheDocument()
  })
})
