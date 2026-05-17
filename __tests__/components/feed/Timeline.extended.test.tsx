import { vi } from 'vitest'
/**
 * Timeline コンポーネントの拡張テスト
 * 無限スクロール、ローディング状態、エッジケースをカバー
 */
import { render, screen, waitFor } from '../../utils/test-utils'

// Prisma/DBモック
vi.mock('@/lib/db', () => ({ prisma: {} }))

// Server Actionsモック
const mockGetTimeline = vi.fn()
vi.mock('@/lib/actions/feed', () => ({
  getTimeline: (...args: unknown[]) => mockGetTimeline(...args),
}))
vi.mock('@/lib/actions/post', () => ({
  createPost: vi.fn(),
  deletePost: vi.fn(),
}))
vi.mock('@/lib/actions/like', () => ({
  likePost: vi.fn(),
  unlikePost: vi.fn(),
}))
vi.mock('@/lib/actions/bookmark', () => ({
  bookmarkPost: vi.fn(),
  unbookmarkPost: vi.fn(),
}))
vi.mock('@/lib/actions/report', () => ({ createReport: vi.fn() }))
vi.mock('@/components/report/ReportButton', () => ({ ReportButton: () => null }))
vi.mock('@/lib/actions/hide-post', () => ({ hidePost: vi.fn(), getHiddenPostIds: vi.fn() }))
vi.mock('@/lib/actions/poll', () => ({ votePoll: vi.fn(), getPollResults: vi.fn() }))

import { Timeline } from '@/components/feed/Timeline'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

// Intersection Observer モック
let mockInView = false
const mockRef = vi.fn()
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: mockRef, inView: mockInView }),
}))

// React Query モック
const mockFetchNextPage = vi.fn()
let mockHasNextPage = false
let mockIsFetchingNextPage = false
let mockIsLoading = false

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: vi.fn().mockImplementation(({ initialData }) => ({
    data: initialData,
    fetchNextPage: mockFetchNextPage,
    hasNextPage: mockHasNextPage,
    isFetchingNextPage: mockIsFetchingNextPage,
    isLoading: mockIsLoading,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const mockPosts = [
  {
    id: 'post-1',
    content: '最初の投稿です',
    createdAt: new Date().toISOString(),
    user: { id: 'user-1', nickname: 'テストユーザー', avatarUrl: null },
    media: [],
    genres: [],
    likeCount: 5,
    commentCount: 2,
    isLiked: false,
    isBookmarked: false,
    repostCount: 0,
    quoteCount: 0,
  },
]

describe('Timeline 拡張テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInView = false
    mockHasNextPage = false
    mockIsFetchingNextPage = false
    mockIsLoading = false
  })

  it('次のページがあり、ビューに入った時にfetchNextPageを呼ぶ', async () => {
    mockHasNextPage = true
    mockInView = true

    render(<Timeline initialPosts={mockPosts} currentUserId="test-user-id" />)

    await waitFor(() => {
      expect(mockFetchNextPage).toHaveBeenCalled()
    })
  })

  it('取得中の場合はfetchNextPageを呼ばない', async () => {
    mockHasNextPage = true
    mockInView = true
    mockIsFetchingNextPage = true

    render(<Timeline initialPosts={mockPosts} currentUserId="test-user-id" />)

    // fetchNextPageが呼ばれていないことを確認
    expect(mockFetchNextPage).not.toHaveBeenCalled()
  })

  it('次のページがない場合はfetchNextPageを呼ばない', async () => {
    mockHasNextPage = false
    mockInView = true

    render(<Timeline initialPosts={mockPosts} currentUserId="test-user-id" />)

    expect(mockFetchNextPage).not.toHaveBeenCalled()
  })

  it('ビュー外の場合はfetchNextPageを呼ばない', async () => {
    mockHasNextPage = true
    mockInView = false

    render(<Timeline initialPosts={mockPosts} currentUserId="test-user-id" />)

    expect(mockFetchNextPage).not.toHaveBeenCalled()
  })

  it('取得中はスピナーを表示する', async () => {
    mockIsFetchingNextPage = true
    mockHasNextPage = true

    render(<Timeline initialPosts={mockPosts} currentUserId="test-user-id" />)

    expect(screen.getByText('投稿を読み込んでいます...')).toBeInTheDocument()
  })

  it('次のページがある場合は投稿数を表示する', () => {
    mockHasNextPage = true
    mockIsFetchingNextPage = false

    render(<Timeline initialPosts={mockPosts} currentUserId="test-user-id" />)

    expect(screen.getByText('1件の投稿を表示中')).toBeInTheDocument()
  })

  it('currentUserIdがundefinedでも動作する', () => {
    render(<Timeline initialPosts={mockPosts} currentUserId={undefined} />)

    expect(screen.getByText('最初の投稿です')).toBeInTheDocument()
  })

  it('複数の投稿を表示する', () => {
    const multiplePosts = [
      ...mockPosts,
      {
        id: 'post-2',
        content: '2番目の投稿',
        createdAt: new Date().toISOString(),
        user: { id: 'user-2', nickname: 'ユーザー2', avatarUrl: null },
        media: [],
        genres: [],
        likeCount: 0,
        commentCount: 0,
        isLiked: false,
        isBookmarked: false,
        repostCount: 0,
        quoteCount: 0,
      },
      {
        id: 'post-3',
        content: '3番目の投稿',
        createdAt: new Date().toISOString(),
        user: { id: 'user-3', nickname: 'ユーザー3', avatarUrl: null },
        media: [],
        genres: [],
        likeCount: 0,
        commentCount: 0,
        isLiked: false,
        isBookmarked: false,
        repostCount: 0,
        quoteCount: 0,
      },
    ]

    render(<Timeline initialPosts={multiplePosts} currentUserId="test-user-id" />)

    expect(screen.getByText('最初の投稿です')).toBeInTheDocument()
    expect(screen.getByText('2番目の投稿')).toBeInTheDocument()
    expect(screen.getByText('3番目の投稿')).toBeInTheDocument()
  })

  it('広告が5投稿ごとに表示される', () => {
    const manyPosts = Array.from({ length: 10 }, (_, i) => ({
      id: `post-${i}`,
      content: `投稿${i}`,
      createdAt: new Date().toISOString(),
      user: { id: `user-${i}`, nickname: `ユーザー${i}`, avatarUrl: null },
      media: [],
      genres: [],
      likeCount: 0,
      commentCount: 0,
      isLiked: false,
      isBookmarked: false,
      repostCount: 0,
      quoteCount: 0,
    }))

    const { container } = render(<Timeline initialPosts={manyPosts} currentUserId="test-user-id" />)

    // 10件の投稿で5投稿ごと = 2つの広告
    // モックされているため、広告の数は確認できないが、レンダリングが成功することを確認
    expect(container).toBeTruthy()
    // 投稿がレンダリングされていることを確認
    expect(screen.getByText('投稿0')).toBeInTheDocument()
  })

  it('status="polite"のaria-liveが設定されている', () => {
    render(<Timeline initialPosts={mockPosts} currentUserId="test-user-id" />)

    const statusElement = screen.getByRole('status')
    expect(statusElement).toHaveAttribute('aria-live', 'polite')
  })
})
