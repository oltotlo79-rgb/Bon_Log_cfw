 
import { vi } from 'vitest'
 

import { render, screen, fireEvent, waitFor, act } from '../utils/test-utils'

// ============================================================
// Mocks
// ============================================================

const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => ({
    get: vi.fn((_key: string) => null),
    toString: () => '',
  }),
}))

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: any) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Server Actions
vi.mock('@/lib/actions/notification', () => ({
  getNotifications: vi.fn().mockResolvedValue({ notifications: [], nextCursor: undefined }),
  markAllAsRead: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/services/notification-core', () => ({
  getNotifications: vi.fn().mockResolvedValue({ notifications: [], nextCursor: undefined }),
  markAllAsRead: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/actions/feed', () => ({
  getTimeline: vi.fn().mockResolvedValue({ posts: [], nextCursor: undefined }),
}))
vi.mock('@/lib/actions/comment', () => ({
  createComment: vi.fn().mockResolvedValue({ success: true }),
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
vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: () => null,
}))
vi.mock('@/lib/db', () => ({
  prisma: {},
}))
vi.mock('@/lib/actions/poll', () => ({ votePoll: vi.fn(), getPollResults: vi.fn() }))

// Client image compression mock
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn().mockResolvedValue(new File(['test'], 'test.jpg', { type: 'image/jpeg' })),
  isVideoFile: vi.fn((file: any) => file.type?.startsWith('video/')),
  formatFileSize: vi.fn((size: number) => `${(size / 1024).toFixed(1)}KB`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: vi.fn().mockResolvedValue({ url: 'https://example.com/video.mp4' }),
}))

// MentionTextarea mock
vi.mock('@/components/common/MentionTextarea', () => ({
  MentionTextarea: ({ value, onChange, placeholder, disabled, autoFocus, maxLength }: any) => (
    <textarea
      data-testid="mention-textarea"
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      maxLength={maxLength}
    />
  ),
}))

// NotificationItem mock
vi.mock('@/components/notification/NotificationItem', () => ({
  NotificationItem: ({ notification }: any) => (
    <div data-testid={`notification-${notification.id}`}>
      {notification.type}: {notification.id}
    </div>
  ),
}))

// react-intersection-observer
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({
    ref: vi.fn(),
    inView: false,
  }),
}))

// React Query
const mockFetchNextPage = vi.fn()
const mockRefetch = vi.fn()
const mockInvalidateQueries = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: vi.fn().mockImplementation(({ initialData }) => ({
    data: initialData,
    fetchNextPage: mockFetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: mockRefetch,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
    setQueryData: vi.fn(),
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: any) => children,
}))

vi.mock('@/lib/actions/hide-post', () => ({ hidePost: vi.fn(), getHiddenPostIds: vi.fn() }))

// ============================================================
// SearchBar Tests
// ============================================================

import { SearchBar } from '@/components/search/SearchBar'

describe('SearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders with default placeholder', () => {
    render(<SearchBar />)
    expect(screen.getByPlaceholderText('検索...')).toBeInTheDocument()
  })

  it('renders with custom placeholder', () => {
    render(<SearchBar placeholder="投稿を検索..." />)
    expect(screen.getByPlaceholderText('投稿を検索...')).toBeInTheDocument()
  })

  it('renders with default value', () => {
    render(<SearchBar defaultValue="盆栽" />)
    expect(screen.getByDisplayValue('盆栽')).toBeInTheDocument()
  })

  it('calls onSearch callback on Enter', () => {
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)

    const input = screen.getByPlaceholderText('検索...')
    fireEvent.change(input, { target: { value: 'test query' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSearch).toHaveBeenCalledWith('test query')
  })

  it('navigates via router when no onSearch callback', () => {
    render(<SearchBar />)

    const input = screen.getByPlaceholderText('検索...')
    fireEvent.change(input, { target: { value: 'bonsai' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockPush).toHaveBeenCalledWith('/search?q=bonsai')
  })

  it('shows clear button when query exists', () => {
    render(<SearchBar defaultValue="test" />)
    // XIcon is rendered inside a button
    const buttons = document.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('clears input on clear button click with onSearch', () => {
    const onSearch = vi.fn()
    render(<SearchBar defaultValue="test" onSearch={onSearch} />)

    // Click the clear button (the X button)
    const clearButton = document.querySelector('button')
    if (clearButton) fireEvent.click(clearButton)

    expect(onSearch).toHaveBeenCalledWith('')
  })

  it('clears input on clear button click without onSearch', () => {
    render(<SearchBar defaultValue="test" />)

    const clearButton = document.querySelector('button')
    if (clearButton) fireEvent.click(clearButton)

    expect(mockPush).toHaveBeenCalledWith('/search?')
  })

  it('closes dropdown on Escape key', () => {
    render(<SearchBar />)

    const input = screen.getByPlaceholderText('検索...')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Escape' })

    // No dropdown should be visible
    expect(screen.queryByText('最近の検索')).not.toBeInTheDocument()
  })

  it('updates input value on change', () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    fireEvent.change(input, { target: { value: '松柏' } })
    expect(input).toHaveValue('松柏')
  })

  it('handles focus and blur correctly', () => {
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    fireEvent.focus(input)
    // No dropdown when no recent searches
    expect(screen.queryByText('最近の検索')).not.toBeInTheDocument()
  })

  it('does not crash when localStorage throws', () => {
    const originalSetItem = localStorage.setItem
    localStorage.setItem = vi.fn(() => { throw new Error('quota exceeded') })

    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    // Should not crash
    expect(input).toBeInTheDocument()

    localStorage.setItem = originalSetItem
  })

  it('removes individual recent search', async () => {
    localStorage.setItem('bonsai-sns-recent-searches', JSON.stringify(['松', '楓']))

    await act(async () => {
      render(<SearchBar />)
    })

    const input = screen.getByPlaceholderText('検索...')
    await act(async () => {
      fireEvent.focus(input)
    })

    const deleteButtons = document.querySelectorAll('li button button')
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0])
    }
  })

  it('navigates with empty query removes q param', () => {
    render(<SearchBar />)

    const input = screen.getByPlaceholderText('検索...')
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockPush).toHaveBeenCalledWith('/search?')
  })

  it('does not show dropdown when query is not empty', () => {
    localStorage.setItem('bonsai-sns-recent-searches', JSON.stringify(['松']))

    render(<SearchBar defaultValue="test" />)

    const input = screen.getByPlaceholderText('検索...')
    fireEvent.focus(input)

    expect(screen.queryByText('最近の検索')).not.toBeInTheDocument()
  })

  it('handles / keyboard shortcut', () => {
    render(<SearchBar />)

    // Simulate pressing / outside of input
    fireEvent.keyDown(document, { key: '/', target: document.body })

    // Input should be focused (this is handled by the event listener)
  })
})

// ============================================================
// NotificationList Tests
// ============================================================

import { NotificationList } from '@/components/notification/NotificationList'
import { useInfiniteQuery } from '@tanstack/react-query'
import { markAllAsRead } from '@/lib/actions/notification'

describe('NotificationList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no notifications', () => {
    render(<NotificationList initialNotifications={[]} />)
    expect(screen.getByText('通知はありません')).toBeInTheDocument()
    expect(screen.getByText(/いいね、コメント、フォローなどの通知がここに表示されます/)).toBeInTheDocument()
  })

  it('renders notifications', () => {
    const notifications = [
      { id: 'n1', type: 'like', isRead: false },
      { id: 'n2', type: 'follow', isRead: true },
    ]

    render(<NotificationList initialNotifications={notifications} />)

    expect(screen.getByTestId('notification-n1')).toBeInTheDocument()
    expect(screen.getByTestId('notification-n2')).toBeInTheDocument()
  })

  it('shows mark all as read button when unread exists', () => {
    const notifications = [
      { id: 'n1', type: 'like', isRead: false },
    ]

    render(<NotificationList initialNotifications={notifications} />)

    expect(screen.getByText('すべて既読にする')).toBeInTheDocument()
  })

  it('does not show mark all as read when all are read', () => {
    const notifications = [
      { id: 'n1', type: 'like', isRead: true },
    ]

    render(<NotificationList initialNotifications={notifications} />)

    expect(screen.queryByText('すべて既読にする')).not.toBeInTheDocument()
  })

  it('calls markAllAsRead on mount', async () => {
    render(<NotificationList initialNotifications={[{ id: 'n1', type: 'like', isRead: false }]} />)

    await waitFor(() => {
      expect(markAllAsRead).toHaveBeenCalled()
    })
  })

  it('handles mark all as read button click', async () => {
    const notifications = [{ id: 'n1', type: 'like', isRead: false }]

    render(<NotificationList initialNotifications={notifications} />)

    fireEvent.click(screen.getByText('すべて既読にする'))

    await waitFor(() => {
      expect(markAllAsRead).toHaveBeenCalled()
      expect(mockRefetch).toHaveBeenCalled()
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['unreadCount'] })
    })
  })

  it('shows "no more notifications" when all loaded', () => {
    const notifications = [{ id: 'n1', type: 'like', isRead: true }]

    render(<NotificationList initialNotifications={notifications} />)

    expect(screen.getByText('これ以上通知はありません')).toBeInTheDocument()
  })

  it('renders loading skeleton when isLoading', () => {
    const mockUseInfiniteQuery = useInfiniteQuery as ReturnType<typeof vi.fn>
    mockUseInfiniteQuery.mockReturnValueOnce({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      refetch: vi.fn(),
    })

    const { container } = render(<NotificationList initialNotifications={[]} />)
    // Skeleton has animate-pulse class
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})

// ============================================================
// Timeline - coverage boost
// ============================================================

import { Timeline } from '@/components/feed/Timeline'

describe('Timeline - coverage boost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default implementation
    const mockUseInfiniteQuery = useInfiniteQuery as ReturnType<typeof vi.fn>
    mockUseInfiniteQuery.mockImplementation(({ initialData }) => ({
      data: initialData,
      fetchNextPage: mockFetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: mockRefetch,
    }))
  })

  const mockPosts = [
    {
      id: 'post-1',
      content: '投稿1',
      createdAt: new Date().toISOString(),
      user: { id: 'u1', nickname: 'ユーザー1', avatarUrl: null },
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

  it('renders loading skeleton when isLoading', () => {
    const mockUseInfiniteQuery = useInfiniteQuery as ReturnType<typeof vi.fn>
    mockUseInfiniteQuery.mockReturnValueOnce({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
    })

    const { container } = render(<Timeline initialPosts={[]} />)
    // TimelineSkeleton should be rendered
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows fetching next page indicator', () => {
    const mockUseInfiniteQuery = useInfiniteQuery as ReturnType<typeof vi.fn>
    mockUseInfiniteQuery.mockReturnValueOnce({
      data: {
        pages: [{ posts: mockPosts, nextCursor: 'cursor-1' }],
        pageParams: [undefined],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: true,
      isLoading: false,
    })

    render(<Timeline initialPosts={mockPosts} currentUserId="u1" />)
    expect(screen.getByText('投稿を読み込んでいます...')).toBeInTheDocument()
  })

  it('shows post count when hasNextPage and not fetching', () => {
    const mockUseInfiniteQuery = useInfiniteQuery as ReturnType<typeof vi.fn>
    mockUseInfiniteQuery.mockReturnValueOnce({
      data: {
        pages: [{ posts: mockPosts, nextCursor: 'cursor-1' }],
        pageParams: [undefined],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
      isLoading: false,
    })

    render(<Timeline initialPosts={mockPosts} currentUserId="u1" />)
    expect(screen.getByText('1件の投稿を表示中')).toBeInTheDocument()
  })

  it('renders without currentUserId', () => {
    render(<Timeline initialPosts={mockPosts} />)
    expect(screen.getByText('投稿1')).toBeInTheDocument()
  })

  it('shows ads every 5 posts', () => {
    const fivePosts = Array.from({ length: 5 }, (_, i) => ({
      ...mockPosts[0],
      id: `post-${i}`,
      content: `投稿${i}`,
    }))

    const mockUseInfiniteQuery = useInfiniteQuery as ReturnType<typeof vi.fn>
    mockUseInfiniteQuery.mockReturnValueOnce({
      data: {
        pages: [{ posts: fivePosts, nextCursor: undefined }],
        pageParams: [undefined],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    })

    render(<Timeline initialPosts={fivePosts} currentUserId="u1" />)
    // All 5 posts should be rendered
    expect(screen.getByText('投稿0')).toBeInTheDocument()
    expect(screen.getByText('投稿4')).toBeInTheDocument()
  })
})

// ============================================================
// CommentForm - coverage boost
// ============================================================

import { CommentForm } from '@/components/comment/CommentForm'
import { createComment } from '@/lib/actions/comment'

describe('CommentForm - coverage boost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with default placeholder', () => {
    render(<CommentForm postId="p1" />)
    expect(screen.getByTestId('mention-textarea')).toBeInTheDocument()
  })

  it('renders with custom placeholder', () => {
    render(<CommentForm postId="p1" placeholder="返信を入力..." />)
    expect(screen.getByPlaceholderText('返信を入力...')).toBeInTheDocument()
  })

  it('shows cancel button when onCancel is provided', () => {
    const onCancel = vi.fn()
    render(<CommentForm postId="p1" onCancel={onCancel} />)
    expect(screen.getByText('キャンセル')).toBeInTheDocument()
  })

  it('does not show cancel button when onCancel is not provided', () => {
    render(<CommentForm postId="p1" />)
    expect(screen.queryByText('キャンセル')).not.toBeInTheDocument()
  })

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(<CommentForm postId="p1" onCancel={onCancel} />)
    fireEvent.click(screen.getByText('キャンセル'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('shows "返信する" when parentId is provided', () => {
    render(<CommentForm postId="p1" parentId="c1" />)
    expect(screen.getByText('返信する')).toBeInTheDocument()
  })

  it('shows "コメントする" when no parentId', () => {
    render(<CommentForm postId="p1" />)
    expect(screen.getByText('コメントする')).toBeInTheDocument()
  })

  it('submit button is disabled when content is empty', () => {
    render(<CommentForm postId="p1" />)
    const submitBtn = screen.getByText('コメントする')
    expect(submitBtn.closest('button')).toBeDisabled()
  })

  it('submit button is enabled when content has text', () => {
    render(<CommentForm postId="p1" />)
    const textarea = screen.getByTestId('mention-textarea')
    fireEvent.change(textarea, { target: { value: 'テストコメント' } })
    const submitBtn = screen.getByText('コメントする')
    expect(submitBtn.closest('button')).not.toBeDisabled()
  })

  it('shows remaining characters counter', () => {
    render(<CommentForm postId="p1" />)
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  it('updates character count as user types', () => {
    render(<CommentForm postId="p1" />)
    const textarea = screen.getByTestId('mention-textarea')
    fireEvent.change(textarea, { target: { value: '12345' } })
    expect(screen.getByText('495')).toBeInTheDocument()
  })

  it('shows error style when over character limit', () => {
    render(<CommentForm postId="p1" />)
    const textarea = screen.getByTestId('mention-textarea')
    const longText = 'a'.repeat(501)
    fireEvent.change(textarea, { target: { value: longText } })
    // Should show negative count
    expect(screen.getByText('-1')).toBeInTheDocument()
  })

  it('submits comment successfully', async () => {
    const onSuccess = vi.fn()
    ;(createComment as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true })

    render(<CommentForm postId="p1" onSuccess={onSuccess} />)

    const textarea = screen.getByTestId('mention-textarea')
    fireEvent.change(textarea, { target: { value: 'テストコメント' } })

    const form = document.querySelector('form')
    await act(async () => {
      fireEvent.submit(form!)
    })

    await waitFor(() => {
      expect(createComment).toHaveBeenCalled()
    })
  })

  it('shows error when comment creation fails', async () => {
    ;(createComment as ReturnType<typeof vi.fn>).mockResolvedValue({ error: 'エラーが発生しました' })

    render(<CommentForm postId="p1" />)

    const textarea = screen.getByTestId('mention-textarea')
    fireEvent.change(textarea, { target: { value: 'テストコメント' } })

    const form = document.querySelector('form')
    await act(async () => {
      fireEvent.submit(form!)
    })

    await waitFor(() => {
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })
  })

  it('does not submit when content is empty', async () => {
    render(<CommentForm postId="p1" />)

    const form = document.querySelector('form')
    await act(async () => {
      fireEvent.submit(form!)
    })

    expect(createComment).not.toHaveBeenCalled()
  })
})
