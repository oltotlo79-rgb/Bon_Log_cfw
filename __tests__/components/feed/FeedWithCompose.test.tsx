import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'

// Prisma/DBモック（コンポーネントインポート前に必須）
vi.mock('@/lib/db', () => ({
  prisma: {},
}))

// すべてのServer Actionsをモック
vi.mock('@/lib/actions/feed', () => ({
  getTimeline: vi.fn().mockResolvedValue({ posts: [], nextCursor: undefined }),
}))
vi.mock('@/lib/actions/post', () => ({
  createPost: vi.fn().mockResolvedValue({ success: true }),
  deletePost: vi.fn(),
}))
vi.mock('@/lib/actions/draft', () => ({
  saveDraft: vi.fn().mockResolvedValue({ success: true }),
  getDrafts: vi.fn(),
  deleteDraft: vi.fn(),
}))
vi.mock('@/lib/actions/like', () => ({
  likePost: vi.fn(),
  unlikePost: vi.fn(),
}))
vi.mock('@/lib/actions/bookmark', () => ({
  bookmarkPost: vi.fn(),
  unbookmarkPost: vi.fn(),
}))
vi.mock('@/lib/actions/scheduled-post', () => ({
  createScheduledPost: vi.fn(),
}))
vi.mock('@/lib/actions/report', () => ({
  createReport: vi.fn(),
}))
// ReportButtonコンポーネントをモック
vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: () => null,
}))

import { FeedWithCompose } from '@/components/feed/FeedWithCompose'

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

const mockGenres = {
  '松柏類': [
    { id: 'genre-1', name: '黒松', category: '松柏類' },
  ],
}

const mockLimits = {
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 1,
  canSchedulePost: false,
  canViewAnalytics: false,
}

const mockPosts = [
  {
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
    likeCount: 0,
    commentCount: 0,
    isLiked: false,
    isBookmarked: false,
    repostCount: 0,
    quoteCount: 0,
  },
]

describe('FeedWithCompose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('タイムラインを表示する', () => {
    render(
      <FeedWithCompose
        initialPosts={mockPosts}
        currentUserId="test-user-id"
        genres={mockGenres}
        limits={mockLimits}
      />
    )
    expect(screen.getByText('タイムライン')).toBeInTheDocument()
    expect(screen.getByText('テスト投稿')).toBeInTheDocument()
  })

  it('フローティング投稿ボタンを表示する', () => {
    render(
      <FeedWithCompose
        initialPosts={mockPosts}
        currentUserId="test-user-id"
        genres={mockGenres}
        limits={mockLimits}
      />
    )
    expect(screen.getByLabelText('新規投稿')).toBeInTheDocument()
  })

  it('投稿ボタンクリックでモーダルを開く', async () => {
    const user = userEvent.setup()
    render(
      <FeedWithCompose
        initialPosts={mockPosts}
        currentUserId="test-user-id"
        genres={mockGenres}
        limits={mockLimits}
      />
    )

    await user.click(screen.getByLabelText('新規投稿'))

    await waitFor(() => {
      // PostFormModalが開く
      expect(screen.getByPlaceholderText('いまどうしてる？')).toBeInTheDocument()
    })
  })

  it('投稿がない場合も表示される', () => {
    render(
      <FeedWithCompose
        initialPosts={[]}
        currentUserId="test-user-id"
        genres={mockGenres}
        limits={mockLimits}
      />
    )
    expect(screen.getByText('タイムライン')).toBeInTheDocument()
    expect(screen.getByLabelText('新規投稿')).toBeInTheDocument()
  })

  it('下書き数を渡せる', async () => {
    const user = userEvent.setup()
    render(
      <FeedWithCompose
        initialPosts={mockPosts}
        currentUserId="test-user-id"
        genres={mockGenres}
        limits={mockLimits}
        draftCount={3}
      />
    )

    await user.click(screen.getByLabelText('新規投稿'))

    await waitFor(() => {
      expect(screen.getByText('下書き一覧')).toBeInTheDocument()
    })
  })

  it('マイ盆栽を渡せる', async () => {
    const user = userEvent.setup()
    const bonsais = [
      { id: 'bonsai-1', name: '黒松一号', species: '黒松' },
    ]
    render(
      <FeedWithCompose
        initialPosts={mockPosts}
        currentUserId="test-user-id"
        genres={mockGenres}
        limits={mockLimits}
        bonsais={bonsais}
      />
    )

    await user.click(screen.getByLabelText('新規投稿'))

    await waitFor(() => {
      expect(screen.getByText('関連する盆栽（任意）')).toBeInTheDocument()
    })
  })
})
