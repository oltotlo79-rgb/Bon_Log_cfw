import { vi } from 'vitest'
/**
 * Coverage boost tests - batch 4
 * Timeline, BonsaiRecordForm, SearchResults (UserSearchResults with data), PostCard additional branches
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ---- mocks ----
vi.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>
  return { default: MockLink }
})
vi.mock('next/image', async () => {
  const { MockNextImage } = await import('../utils/mock-next-image')
  return { __esModule: true, default: MockNextImage }
})
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { id: 'u1', name: 'Test' } }, status: 'authenticated' })),
  signOut: vi.fn(),
}))
vi.mock('lucide-react', () => {
  const icon = (name: string) => { const Icon = (props: any) => <div data-testid={`icon-${name}`} {...props} />; Icon.displayName = name; return Icon }
  return {
    Heart: icon('Heart'), MessageSquare: icon('MessageSquare'), Search: icon('Search'),
    Bell: icon('Bell'), BellOff: icon('BellOff'), Crown: icon('Crown'), Check: icon('Check'),
    Star: icon('Star'), Settings: icon('Settings'), User: icon('User'), Users: icon('Users'),
    Bookmark: icon('Bookmark'), Plus: icon('Plus'), MoreHorizontal: icon('MoreHorizontal'),
    Edit: icon('Edit'), Trash2: icon('Trash2'), Flag: icon('Flag'), Share: icon('Share'),
    X: icon('X'), Image: icon('Image'), Camera: icon('Camera'), Clock: icon('Clock'),
    Loader2: icon('Loader2'), AlertCircle: icon('AlertCircle'), FileText: icon('FileText'),
    Calendar: icon('Calendar'), MapPin: icon('MapPin'), Home: icon('Home'),
    ArrowLeft: icon('ArrowLeft'), Hash: icon('Hash'), Copy: icon('Copy'),
    ChevronDown: icon('ChevronDown'), ChevronUp: icon('ChevronUp'),
    MessageCircle: icon('MessageCircle'), TrendingUp: icon('TrendingUp'),
  }
})
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, asChild, disabled, ...props }: any) => {
    if (asChild) return <>{children}</>
    return <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  },
}))
vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}))

// PostCard mock to avoid deep dependency chain
vi.mock('@/components/post/PostCard', () => ({
  PostCard: ({ post }: any) => <div data-testid={`post-${post.id}`}>{post.content}</div>,
}))

// Ads mock
vi.mock('@/components/ads', () => ({
  InFeedAdUnit: ({ className }: any) => <div data-testid="ad" className={className} />,
  InFeedAdSlot: ({ index, total, interval }: any) => {
    const position = index + 1
    if (position % interval !== 0) return null
    if (position >= total) return null
    return <div data-testid="ad" />
  },
}))

// Timeline dependencies
const mockGetTimeline = vi.fn()
vi.mock('@/lib/actions/feed', () => ({
  getTimeline: (...args: any[]) => mockGetTimeline(...args),
}))
vi.mock('./TimelineSkeleton', () => ({
  TimelineSkeleton: () => <div data-testid="timeline-skeleton" />,
}))
vi.mock('@/components/feed/TimelineSkeleton', () => ({
  TimelineSkeleton: () => <div data-testid="timeline-skeleton" />,
}))
vi.mock('@/components/feed/EmptyTimeline', () => ({
  EmptyTimeline: () => <div data-testid="empty-timeline">投稿がありません</div>,
}))

// React Query mock
vi.mock('@tanstack/react-query', () => {
  let mockInfiniteData: any = null
  return {
    useInfiniteQuery: (opts: any) => {
      if (mockInfiniteData) return mockInfiniteData
      const initialData = opts.initialData
      return {
        data: initialData,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      }
    },
    useQuery: vi.fn(() => ({ data: undefined })),
    _setMockData: (d: any) => { mockInfiniteData = d },
    _resetMockData: () => { mockInfiniteData = null },
    QueryClient: vi.fn(),
    QueryClientProvider: ({ children }: any) => <>{children}</>,
  }
})
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: false }),
}))

// SearchResults deps
vi.mock('@/lib/actions/search', () => ({
  searchPosts: vi.fn(),
  searchUsers: vi.fn(),
  searchByTag: vi.fn(),
}))

// Import react-query mock helpers for use in tests
 
const rqMock = await import('@tanstack/react-query') as any

// BonsaiRecordForm deps
const mockAddBonsaiRecord = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  addBonsaiRecord: (...args: any[]) => mockAddBonsaiRecord(...args),
}))
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn((f: File) => Promise.resolve(f)),
  formatFileSize: vi.fn((b: number) => b + ' B'),
  isVideoFile: vi.fn(() => false),
  isImageFile: vi.fn(() => true),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  compressImage: vi.fn(),
  uploadVideoToR2: vi.fn(),
}))

import { Timeline } from '@/components/feed/Timeline'
import { BonsaiRecordForm } from '@/components/bonsai/BonsaiRecordForm'
import { UserSearchResults, TagSearchResults, PostSearchResults } from '@/components/search/SearchResults'

// ============================================================
// Timeline
// ============================================================
describe('Timeline', () => {
  const makePosts = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      content: `Post ${i}`,
      createdAt: new Date().toISOString(),
      user: { id: 'u1', nickname: 'User', avatarUrl: null },
      media: [],
      genres: [],
      likeCount: 0,
      commentCount: 0,
    }))

  it('renders posts from initialPosts', () => {
    const posts = makePosts(3)
    render(<Timeline initialPosts={posts} currentUserId="u1" />)
    expect(screen.getByTestId('post-p0')).toBeInTheDocument()
    expect(screen.getByTestId('post-p1')).toBeInTheDocument()
    expect(screen.getByTestId('post-p2')).toBeInTheDocument()
  })

  it('shows empty timeline when no posts', () => {
    render(<Timeline initialPosts={[]} currentUserId="u1" />)
    expect(screen.getByTestId('empty-timeline')).toBeInTheDocument()
  })

  it('shows "all posts displayed" message when no more pages', () => {
    const posts = makePosts(3)
    render(<Timeline initialPosts={posts} currentUserId="u1" />)
    expect(screen.getByText(/すべての投稿を表示しました/)).toBeInTheDocument()
  })

  it('inserts ad units every 5 posts', () => {
    const posts = makePosts(6)
    render(<Timeline initialPosts={posts} currentUserId="u1" />)
    const ads = screen.getAllByTestId('ad')
    expect(ads.length).toBe(1) // after 5th post
  })

  it('shows post count in footer', () => {
    const posts = makePosts(3)
    render(<Timeline initialPosts={posts} currentUserId="u1" />)
    expect(screen.getByText(/3件/)).toBeInTheDocument()
  })
})

// ============================================================
// BonsaiRecordForm
// ============================================================
describe('BonsaiRecordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form with textarea and submit button', () => {
    render(<BonsaiRecordForm bonsaiId="b1" />)
    expect(screen.getByPlaceholderText('成長の様子や作業内容を記録...')).toBeInTheDocument()
  })

  it('shows error when submitting empty form', async () => {
    render(<BonsaiRecordForm bonsaiId="b1" />)
    const form = document.querySelector('form')!
    await act(async () => {
      fireEvent.submit(form)
    })
    expect(screen.getByText(/テキストまたは画像を入力してください/)).toBeInTheDocument()
  })

  it('submits with text content', async () => {
    mockAddBonsaiRecord.mockResolvedValue({ success: true })
    global.fetch = vi.fn()
    render(<BonsaiRecordForm bonsaiId="b1" />)
    const textarea = screen.getByPlaceholderText('成長の様子や作業内容を記録...')
    fireEvent.change(textarea, { target: { value: 'Test record' } })
    const form = document.querySelector('form')!
    await act(async () => {
      fireEvent.submit(form)
    })
    expect(mockAddBonsaiRecord).toHaveBeenCalledWith(expect.objectContaining({
      bonsaiId: 'b1',
      content: 'Test record',
    }))
  })

  it('shows error from server action', async () => {
    mockAddBonsaiRecord.mockResolvedValue({ error: 'サーバーエラー' })
    render(<BonsaiRecordForm bonsaiId="b1" />)
    const textarea = screen.getByPlaceholderText('成長の様子や作業内容を記録...')
    fireEvent.change(textarea, { target: { value: 'Test' } })
    const form = document.querySelector('form')!
    await act(async () => {
      fireEvent.submit(form)
    })
    expect(screen.getByText('サーバーエラー')).toBeInTheDocument()
  })

  it('handles unexpected error during submit', async () => {
    mockAddBonsaiRecord.mockRejectedValue(new Error('unexpected'))
    render(<BonsaiRecordForm bonsaiId="b1" />)
    const textarea = screen.getByPlaceholderText('成長の様子や作業内容を記録...')
    fireEvent.change(textarea, { target: { value: 'Test' } })
    const form = document.querySelector('form')!
    await act(async () => {
      fireEvent.submit(form)
    })
    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
  })
})

// ============================================================
// UserSearchResults with actual data
// ============================================================
describe('UserSearchResults with data', () => {
  beforeEach(() => {
    rqMock._resetMockData()
  })

  it('renders user cards with avatar', () => {
    rqMock._setMockData({
      data: {
        pages: [{
          users: [
            { id: 'u1', nickname: 'Alice', avatarUrl: 'https://img.test/a.jpg', bio: 'Hello', followersCount: 10, followingCount: 5 },
            { id: 'u2', nickname: 'Bob', avatarUrl: null, bio: null, followersCount: 0, followingCount: 0 },
          ],
          nextCursor: undefined,
        }],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      error: null,
    })
    render(<UserSearchResults query="test" />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('10フォロワー')).toBeInTheDocument()
    // Bob has no avatar - should show initial letter
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  afterAll(() => {
    rqMock._resetMockData()
  })
})

// ============================================================
// TagSearchResults with data
// ============================================================
describe('TagSearchResults with data', () => {
  beforeEach(() => {
    rqMock._resetMockData()
  })

  it('renders tag header and posts', () => {
    rqMock._setMockData({
      data: {
        pages: [{
          posts: [
            { id: 'p1', content: 'Tagged post', createdAt: new Date().toISOString(), user: { id: 'u1', nickname: 'User', avatarUrl: null }, media: [], genres: [], likeCount: 0, commentCount: 0 },
          ],
          nextCursor: undefined,
        }],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      error: null,
    })
    render(<TagSearchResults tag="松柏類" />)
    expect(screen.getByText('#松柏類')).toBeInTheDocument()
    expect(screen.getByText('1件の投稿')).toBeInTheDocument()
  })

  afterAll(() => {
    rqMock._resetMockData()
  })
})

// ============================================================
// PostSearchResults with data
// ============================================================
describe('PostSearchResults with data', () => {
  beforeEach(() => {
    rqMock._resetMockData()
  })

  it('renders post cards', () => {
    rqMock._setMockData({
      data: {
        pages: [{
          posts: [
            { id: 'p1', content: 'Found post', createdAt: new Date().toISOString(), user: { id: 'u1', nickname: 'User', avatarUrl: null }, media: [], genres: [], likeCount: 0, commentCount: 0 },
          ],
          nextCursor: undefined,
        }],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      error: null,
    })
    render(<PostSearchResults query="found" />)
    expect(screen.getByTestId('post-p1')).toBeInTheDocument()
  })

  it('shows "no more posts" message', () => {
    rqMock._setMockData({
      data: {
        pages: [{
          posts: [
            { id: 'p1', content: 'Post', createdAt: new Date().toISOString(), user: { id: 'u1', nickname: 'User', avatarUrl: null }, media: [], genres: [], likeCount: 0, commentCount: 0 },
          ],
          nextCursor: undefined,
        }],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      error: null,
    })
    render(<PostSearchResults query="test" />)
    expect(screen.getByText(/これ以上投稿はありません/)).toBeInTheDocument()
  })

  afterAll(() => {
    rqMock._resetMockData()
  })
})
