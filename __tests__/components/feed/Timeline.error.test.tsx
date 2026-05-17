/**
 * Timeline - error state coverage tests
 *
 * Targets: lines 235-242
 * - isError=true rendering with error message and retry button
 * - Error instance message display
 * - Retry button calls refetch()
 */

import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'

// Prisma/DB mock
vi.mock('@/lib/db', () => ({ prisma: {} }))

// Server Actions mocks
vi.mock('@/lib/actions/feed', () => ({
  getTimeline: vi.fn().mockResolvedValue({ posts: [], nextCursor: undefined }),
}))
vi.mock('@/lib/actions/post', () => ({ createPost: vi.fn(), deletePost: vi.fn() }))
vi.mock('@/lib/actions/like', () => ({ likePost: vi.fn(), unlikePost: vi.fn() }))
vi.mock('@/lib/actions/bookmark', () => ({ bookmarkPost: vi.fn(), unbookmarkPost: vi.fn() }))
vi.mock('@/lib/actions/report', () => ({ createReport: vi.fn() }))
vi.mock('@/components/report/ReportButton', () => ({ ReportButton: () => null }))
vi.mock('@/lib/actions/hide-post', () => ({ hidePost: vi.fn(), getHiddenPostIds: vi.fn() }))
vi.mock('@/lib/actions/poll', () => ({ votePoll: vi.fn(), getPollResults: vi.fn() }))

import { Timeline } from '@/components/feed/Timeline'

// Next-Auth mock
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation mock
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

// Intersection Observer mock
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: false }),
}))

// React Query mock - configurable per test
const mockRefetch = vi.fn()
const mockUseInfiniteQuery = vi.fn()
vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (config: unknown) => mockUseInfiniteQuery(config),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const mockPost = {
  id: 'post-1',
  content: 'テスト投稿',
  createdAt: new Date().toISOString(),
  user: { id: 'user-1', nickname: 'テストユーザー', avatarUrl: null },
  media: [],
  genres: [],
  likeCount: 0,
  commentCount: 0,
  isLiked: false,
  isBookmarked: false,
  repostCount: 0,
  quoteCount: 0,
}

describe('Timeline - error state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isErrorがtrueの場合エラーメッセージと再試行ボタンを表示する', () => {
    mockUseInfiniteQuery.mockImplementation(() => ({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: true,
      error: new Error('サーバーエラー'),
      refetch: mockRefetch,
    }))

    render(<Timeline initialPosts={[mockPost]} currentUserId="test-user-id" />)

    expect(screen.getByText('タイムラインの読み込みに失敗しました')).toBeInTheDocument()
    expect(screen.getByText('サーバーエラー')).toBeInTheDocument()
    expect(screen.getByText('再試行')).toBeInTheDocument()
  })

  it('再試行ボタンをクリックするとrefetchが呼ばれる', async () => {
    mockUseInfiniteQuery.mockImplementation(() => ({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: true,
      error: new Error('接続エラー'),
      refetch: mockRefetch,
    }))

    const user = userEvent.setup()
    render(<Timeline initialPosts={[mockPost]} currentUserId="test-user-id" />)

    await user.click(screen.getByText('再試行'))

    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('errorがError以外の場合はエラーメッセージを表示しない', () => {
    mockUseInfiniteQuery.mockImplementation(() => ({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: true,
      error: 'string error', // not an Error instance
      refetch: mockRefetch,
    }))

    render(<Timeline initialPosts={[mockPost]} currentUserId="test-user-id" />)

    // The main error message is shown
    expect(screen.getByText('タイムラインの読み込みに失敗しました')).toBeInTheDocument()
    // But the detailed error.message paragraph is NOT rendered because error is not an Error instance
    expect(screen.queryByText('string error')).not.toBeInTheDocument()
    // Retry button still available
    expect(screen.getByText('再試行')).toBeInTheDocument()
  })

  it('ゲストモードで登録促進メッセージを表示する', () => {
    mockUseInfiniteQuery.mockImplementation(({ initialData }: { initialData: unknown }) => ({
      data: initialData,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    }))

    render(<Timeline initialPosts={[mockPost]} currentUserId={undefined} isGuest={true} />)

    expect(screen.getByText('続きは新規登録をお願いします。')).toBeInTheDocument()
    const registerLink = screen.getByText('無料で新規登録 →')
    expect(registerLink.closest('a')).toHaveAttribute('href', '/register')
  })

  it('ゲストモードでは無限スクロール監視要素が表示されない', () => {
    mockUseInfiniteQuery.mockImplementation(({ initialData }: { initialData: unknown }) => ({
      data: initialData,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    }))

    render(<Timeline initialPosts={[mockPost]} currentUserId={undefined} isGuest={true} />)

    // role="status" is the infinite scroll sentinel, should not exist for guests
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
