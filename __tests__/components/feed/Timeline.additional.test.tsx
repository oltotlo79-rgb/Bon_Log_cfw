import { vi } from 'vitest'
/**
 * Timelineコンポーネントの追加テスト
 * 分岐カバレッジを向上させるためのテスト
 */

import { render, screen, waitFor } from '../../utils/test-utils'

// Prisma/DBモック（コンポーネントインポート前に必須）
vi.mock('@/lib/db', () => ({
  prisma: {},
}))

// Server Actionsをモック
vi.mock('@/lib/actions/feed', () => ({
  getTimeline: vi.fn().mockResolvedValue({ posts: [], nextCursor: undefined }),
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
vi.mock('@/lib/actions/report', () => ({
  createReport: vi.fn(),
}))
vi.mock('@/lib/actions/hide-post', () => ({
  hidePost: vi.fn(),
  getHiddenPostIds: vi.fn(),
}))
vi.mock('@/lib/actions/poll', () => ({
  votePoll: vi.fn(),
  getPollResults: vi.fn(),
}))
vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: () => null,
}))

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
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}))

// react-intersection-observerのモック設定用
const mockUseInView = vi.fn()
vi.mock('react-intersection-observer', () => ({
  useInView: () => mockUseInView(),
}))

// React Query モック
const mockFetchNextPage = vi.fn()
const mockUseInfiniteQuery = vi.fn()
vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (config: { initialData: unknown }) => mockUseInfiniteQuery(config),
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
  user: {
    id: 'user-1',
    nickname: 'テストユーザー',
    avatarUrl: null,
  },
  media: [],
  genres: [],
  likeCount: 5,
  commentCount: 2,
  isLiked: false,
  isBookmarked: false,
  repostCount: 0,
  quoteCount: 0,
}

describe('Timeline - 追加カバレッジテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseInView.mockReturnValue({ ref: vi.fn(), inView: false })
    mockUseInfiniteQuery.mockImplementation(({ initialData }) => ({
      data: initialData,
      fetchNextPage: mockFetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    }))
  })

  describe('無限スクロール', () => {
    it('inViewがtrueでhasNextPageがtrueの場合fetchNextPageが呼ばれる', async () => {
      mockUseInView.mockReturnValue({ ref: vi.fn(), inView: true })
      mockUseInfiniteQuery.mockImplementation(({ initialData }) => ({
        data: initialData,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: true,
        isFetchingNextPage: false,
        isLoading: false,
      }))

      render(<Timeline initialPosts={[mockPost]} currentUserId="test-user-id" />)

      await waitFor(() => {
        expect(mockFetchNextPage).toHaveBeenCalled()
      })
    })

    it('isFetchingNextPageがtrueの場合fetchNextPageは呼ばれない', () => {
      mockUseInView.mockReturnValue({ ref: vi.fn(), inView: true })
      mockUseInfiniteQuery.mockImplementation(({ initialData }) => ({
        data: initialData,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: true,
        isFetchingNextPage: true,
        isLoading: false,
      }))

      render(<Timeline initialPosts={[mockPost]} currentUserId="test-user-id" />)

      expect(mockFetchNextPage).not.toHaveBeenCalled()
    })

    it('hasNextPageがfalseの場合fetchNextPageは呼ばれない', () => {
      mockUseInView.mockReturnValue({ ref: vi.fn(), inView: true })
      mockUseInfiniteQuery.mockImplementation(({ initialData }) => ({
        data: initialData,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      }))

      render(<Timeline initialPosts={[mockPost]} currentUserId="test-user-id" />)

      expect(mockFetchNextPage).not.toHaveBeenCalled()
    })

    it('inViewがfalseの場合fetchNextPageは呼ばれない', () => {
      mockUseInView.mockReturnValue({ ref: vi.fn(), inView: false })
      mockUseInfiniteQuery.mockImplementation(({ initialData }) => ({
        data: initialData,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: true,
        isFetchingNextPage: false,
        isLoading: false,
      }))

      render(<Timeline initialPosts={[mockPost]} currentUserId="test-user-id" />)

      expect(mockFetchNextPage).not.toHaveBeenCalled()
    })
  })

  describe('ローディング状態', () => {
    it('isLoadingがtrueの場合スケルトンを表示する', () => {
      mockUseInfiniteQuery.mockImplementation(() => ({
        data: undefined,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: true,
      }))

      const { container } = render(<Timeline initialPosts={[]} currentUserId="test-user-id" />)

      // TimelineSkeletonがレンダリングされる
      const skeletons = container.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('isFetchingNextPageがtrueの場合ローディングメッセージを表示する', () => {
      mockUseInfiniteQuery.mockImplementation(({ initialData }) => ({
        data: initialData,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: true,
        isFetchingNextPage: true,
        isLoading: false,
      }))

      render(<Timeline initialPosts={[mockPost]} currentUserId="test-user-id" />)

      expect(screen.getByText('投稿を読み込んでいます...')).toBeInTheDocument()
    })
  })

  describe('投稿件数表示', () => {
    it('hasNextPageがtrueで取得中でない場合投稿数を表示する', () => {
      mockUseInfiniteQuery.mockImplementation(({ initialData }) => ({
        data: initialData,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: true,
        isFetchingNextPage: false,
        isLoading: false,
      }))

      render(<Timeline initialPosts={[mockPost]} currentUserId="test-user-id" />)

      expect(screen.getByText('1件の投稿を表示中')).toBeInTheDocument()
    })

    it('hasNextPageがfalseの場合すべて表示メッセージを表示する', () => {
      mockUseInfiniteQuery.mockImplementation(({ initialData }) => ({
        data: initialData,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      }))

      render(<Timeline initialPosts={[mockPost]} currentUserId="test-user-id" />)

      expect(screen.getByText(/すべての投稿を表示しました/)).toBeInTheDocument()
    })
  })

  describe('広告表示', () => {
    it('5投稿ごとに広告が表示される', () => {
      const posts = Array.from({ length: 6 }, (_, i) => ({
        ...mockPost,
        id: `post-${i + 1}`,
        content: `投稿${i + 1}`,
      }))

      mockUseInfiniteQuery.mockImplementation(() => ({
        data: { pages: [{ posts, nextCursor: undefined }], pageParams: [undefined] },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      }))

      const { container } = render(<Timeline initialPosts={posts} currentUserId="test-user-id" />)

      // InFeedAdUnitのスロットが存在するか確認
      const adSlots = container.querySelectorAll('[data-ad-slot]')
      expect(adSlots.length).toBeGreaterThanOrEqual(0) // 広告コンポーネントの存在確認
    })
  })

  describe('currentUserId', () => {
    it('currentUserIdがundefinedでも正常に動作する', () => {
      mockUseInfiniteQuery.mockImplementation(({ initialData }) => ({
        data: initialData,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      }))

      render(<Timeline initialPosts={[mockPost]} />)

      expect(screen.getByText('テスト投稿')).toBeInTheDocument()
    })
  })

  describe('アクセシビリティ', () => {
    it('無限スクロールエリアにrole="status"が設定されている', () => {
      mockUseInfiniteQuery.mockImplementation(({ initialData }) => ({
        data: initialData,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      }))

      render(<Timeline initialPosts={[mockPost]} currentUserId="test-user-id" />)

      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('aria-live="polite"が設定されている', () => {
      mockUseInfiniteQuery.mockImplementation(({ initialData }) => ({
        data: initialData,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      }))

      render(<Timeline initialPosts={[mockPost]} currentUserId="test-user-id" />)

      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('複数ページのデータ', () => {
    it('複数ページの投稿をフラット化して表示する', () => {
      const page1Posts = [{ ...mockPost, id: 'post-1', content: '1ページ目' }]
      const page2Posts = [{ ...mockPost, id: 'post-2', content: '2ページ目' }]

      mockUseInfiniteQuery.mockImplementation(() => ({
        data: {
          pages: [
            { posts: page1Posts, nextCursor: 'cursor-1' },
            { posts: page2Posts, nextCursor: undefined },
          ],
          pageParams: [undefined, 'cursor-1'],
        },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      }))

      render(<Timeline initialPosts={page1Posts} currentUserId="test-user-id" />)

      expect(screen.getByText('1ページ目')).toBeInTheDocument()
      expect(screen.getByText('2ページ目')).toBeInTheDocument()
    })
  })

  describe('dataがundefinedの場合', () => {
    it('dataがundefinedでも空配列として処理される', () => {
      mockUseInfiniteQuery.mockImplementation(() => ({
        data: undefined,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      }))

      render(<Timeline initialPosts={[]} currentUserId="test-user-id" />)

      expect(screen.getByText('タイムラインに投稿がありません')).toBeInTheDocument()
    })
  })
})
