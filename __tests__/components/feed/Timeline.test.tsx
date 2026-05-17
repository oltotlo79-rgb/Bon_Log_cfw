import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'

// Prisma/DBモック（コンポーネントインポート前に必須）
vi.mock('@/lib/db', () => ({
  prisma: {},
}))

// すべてのServer Actionsをモック
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
// ReportButtonコンポーネントをモック
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


// react-intersection-observer モック
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({
    ref: vi.fn(),
    inView: false,
  }),
}))

// React Query モック
vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: vi.fn().mockImplementation(({ initialData }) => ({
    data: initialData,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/actions/hide-post', () => ({ hidePost: vi.fn(), getHiddenPostIds: vi.fn() }))
vi.mock('@/lib/actions/poll', () => ({ votePoll: vi.fn(), getPollResults: vi.fn() }))

const mockPosts = [
  {
    id: 'post-1',
    content: '最初の投稿です',
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
  },
  {
    id: 'post-2',
    content: '2番目の投稿です',
    createdAt: new Date().toISOString(),
    user: {
      id: 'user-2',
      nickname: '別のユーザー',
      avatarUrl: null,
    },
    media: [],
    genres: [],
    likeCount: 10,
    commentCount: 3,
    isLiked: true,
    isBookmarked: false,
    repostCount: 1,
    quoteCount: 0,
  },
]

describe('Timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('タイムラインを表示する', () => {
    render(<Timeline initialPosts={mockPosts} currentUserId="test-user-id" />)
    expect(screen.getByText('最初の投稿です')).toBeInTheDocument()
    expect(screen.getByText('2番目の投稿です')).toBeInTheDocument()
  })

  it('投稿がない場合は空状態を表示', () => {
    render(<Timeline initialPosts={[]} currentUserId="test-user-id" />)
    // EmptyTimelineコンポーネントの内容が表示される
    expect(screen.getByText('タイムラインに投稿がありません')).toBeInTheDocument()
  })

  it('投稿ユーザー名を表示する', () => {
    render(<Timeline initialPosts={mockPosts} currentUserId="test-user-id" />)
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
    expect(screen.getByText('別のユーザー')).toBeInTheDocument()
  })

  it('最後の投稿の後にメッセージを表示', async () => {
    render(<Timeline initialPosts={mockPosts} currentUserId="test-user-id" />)

    await waitFor(() => {
      expect(screen.getByText(/すべての投稿を表示しました/)).toBeInTheDocument()
    })
  })
})
