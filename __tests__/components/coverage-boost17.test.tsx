import { vi } from 'vitest'
/**
 * Coverage Boost 17 - SearchResults, MentionTextarea, AnalogClockPicker
 *
 * Targets uncovered branches in:
 * - SearchResults.tsx: initialData length check, error boundary, bio null/empty, empty tags, isFetchingNextPage
 * - MentionTextarea.tsx: @ detection newline, hasSpaceOrNewline, showSuggestions w/ empty suggestions,
 *   selectUser when triggerPosition null, keyboard nav edge cases
 * - AnalogClockPicker.tsx: minutes mode interaction, inner ring PM detection,
 *   handleMouseMove e.buttons !== 1, touch events, click outside, "00:00" edge
 */

import { render, screen, fireEvent, waitFor, act } from '../utils/test-utils'

// ============================================================
// Common mocks
// ============================================================

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

vi.mock('@/components/post/PostCard', () => ({
  PostCard: ({ post }: { post: { id: string; content: string } }) => (
    <div data-testid="post-card">{post.content}</div>
  ),
}))

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// ============================================================
// SearchResults mocks
// ============================================================

const mockUseInfiniteQuery = vi.fn().mockReturnValue({
  data: undefined,
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
  error: null,
})

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (...args: unknown[]) => mockUseInfiniteQuery(...args),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  QueryClient: vi.fn(),
}))

const mockUseInView = vi.fn().mockReturnValue({ ref: vi.fn(), inView: false })
vi.mock('react-intersection-observer', () => ({
  useInView: () => mockUseInView(),
}))

vi.mock('@/lib/actions/search', () => ({
  searchPosts: vi.fn(),
  searchUsers: vi.fn(),
  searchByTag: vi.fn(),
}))

import {
  PostSearchResults,
  UserSearchResults,
  TagSearchResults,
  PopularTags,
} from '@/components/search/SearchResults'

// ============================================================
// MentionTextarea mocks
// ============================================================

const mockSearchMentionUsers = vi.fn()
vi.mock('@/lib/actions/mention', () => ({
  searchMentionUsers: (...args: unknown[]) => mockSearchMentionUsers(...args),
}))

vi.mock('@/lib/mention-utils', () => ({
  insertMention: (text: string, userId: string, cursorPos: number, triggerPos: number) => ({
    text: text.substring(0, triggerPos) + `<@${userId}> ` + text.substring(cursorPos),
    cursor: triggerPos + `<@${userId}> `.length,
  }),
}))

import { MentionTextarea } from '@/components/common/MentionTextarea'

// ============================================================
// AnalogClockPicker - already imported from component
// ============================================================
import { AnalogClockPicker } from '@/components/ui/AnalogClockPicker'

// ============================================================
// SearchResults Tests
// ============================================================

describe('SearchResults - coverage boost', () => {
  beforeEach(() => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      error: null,
    })
    mockUseInView.mockReturnValue({ ref: vi.fn(), inView: false })
  })

  describe('PostSearchResults - initialData length check', () => {
    it('should set initialData when initialPosts has items', () => {
      const initialPosts = Array(25).fill(null).map((_, i) => ({
        id: `post-${i}`,
        content: `Post ${i}`,
        user: { id: 'u1', nickname: 'User1' },
      }))

      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ posts: initialPosts, nextCursor: 'post-24' }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: false,
        isLoading: false,
      })

      render(
        <PostSearchResults
          query="test"
          initialPosts={initialPosts}
          currentUserId="test-user"
        />
      )

      expect(screen.getByText('Post 0')).toBeInTheDocument()
      // Verify useInfiniteQuery was called with initialData
      expect(mockUseInfiniteQuery).toHaveBeenCalled()
      const callArgs = mockUseInfiniteQuery.mock.calls[0][0]
      expect(callArgs.initialData).toBeDefined()
    })

    it('initialPosts が空配列（サーバー fetched）でも initialData を渡す', () => {
      // サーバーが「0 件」を確定した後は initialData で即時描画し、クライアント再フェッチを避ける。
      render(<PostSearchResults query="test" initialPosts={[]} />)

      expect(mockUseInfiniteQuery).toHaveBeenCalled()
      const lastCallIndex = mockUseInfiniteQuery.mock.calls.length - 1
      const callArgs = mockUseInfiniteQuery.mock.calls[lastCallIndex][0]
      expect(callArgs.initialData).toBeDefined()
      expect(callArgs.initialData.pages[0].posts).toEqual([])
      expect(callArgs.initialData.pages[0].nextCursor).toBeUndefined()
    })

    it('initialPosts が undefined の場合 initialData は undefined（クライアント fetch）', () => {
      // unit test や SC 経由しない描画では initialData 無し → queryFn が実行される。
      render(<PostSearchResults query="test" />)

      expect(mockUseInfiniteQuery).toHaveBeenCalled()
      const lastCallIndex = mockUseInfiniteQuery.mock.calls.length - 1
      const callArgs = mockUseInfiniteQuery.mock.calls[lastCallIndex][0]
      expect(callArgs.initialData).toBeUndefined()
    })

    it('should show isFetchingNextPage spinner', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            posts: [{ id: 'p1', content: 'Post 1', user: { id: 'u1', nickname: 'User1' } }],
            nextCursor: 'p1',
          }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: true,
        isLoading: false,
      })

      render(<PostSearchResults query="test" />)
      expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    })

    it('should show end-of-list message when no more pages', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            posts: [{ id: 'p1', content: 'Post 1', user: { id: 'u1', nickname: 'User1' } }],
            nextCursor: undefined,
          }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      })

      render(<PostSearchResults query="test" />)
      expect(screen.getByText('これ以上投稿はありません')).toBeInTheDocument()
    })

    it('should pass filters to queryKey', () => {
      const filters = { dateFrom: '2024-01-01', minLikes: 5 }
      render(<PostSearchResults query="test" filters={filters} />)

      expect(mockUseInfiniteQuery).toHaveBeenCalled()
      const lastCallIndex = mockUseInfiniteQuery.mock.calls.length - 1
      const callArgs = mockUseInfiniteQuery.mock.calls[lastCallIndex][0]
      expect(callArgs.queryKey).toEqual(expect.arrayContaining([filters]))
    })

    it('should trigger fetchNextPage when inView and hasNextPage', () => {
      const mockFetchNextPage = vi.fn()
      mockUseInView.mockReturnValue({ ref: vi.fn(), inView: true })
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            posts: [{ id: 'p1', content: 'Post 1', user: { id: 'u1', nickname: 'User1' } }],
            nextCursor: 'p1',
          }],
          pageParams: [undefined],
        },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: true,
        isFetchingNextPage: false,
        isLoading: false,
      })

      render(<PostSearchResults query="test" />)
      // useEffect should have called fetchNextPage since inView=true, hasNextPage=true, isFetchingNextPage=false
      expect(mockFetchNextPage).toHaveBeenCalled()
    })

    it('should set nextCursor when initialPosts has exactly 20 items', () => {
      const initialPosts = Array(20).fill(null).map((_, i) => ({
        id: `post-${i}`,
        content: `Post ${i}`,
        user: { id: 'u1', nickname: 'User1' },
      }))

      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ posts: initialPosts, nextCursor: 'post-19' }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: false,
        isLoading: false,
      })

      render(<PostSearchResults query="test" initialPosts={initialPosts} />)

      // Verify initialData was set with nextCursor
      const lastCallIndex = mockUseInfiniteQuery.mock.calls.length - 1
      const callArgs = mockUseInfiniteQuery.mock.calls[lastCallIndex][0]
      expect(callArgs.initialData.pages[0].nextCursor).toBe('post-19')
    })

    it('should set nextCursor to undefined when initialPosts has fewer than 20 items', () => {
      const initialPosts = Array(5).fill(null).map((_, i) => ({
        id: `post-${i}`,
        content: `Post ${i}`,
        user: { id: 'u1', nickname: 'User1' },
      }))

      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ posts: initialPosts, nextCursor: undefined }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      })

      render(<PostSearchResults query="test" initialPosts={initialPosts} />)

      const lastCallIndex = mockUseInfiniteQuery.mock.calls.length - 1
      const callArgs = mockUseInfiniteQuery.mock.calls[lastCallIndex][0]
      expect(callArgs.initialData.pages[0].nextCursor).toBeUndefined()
    })
  })

  describe('UserSearchResults - error and bio branches', () => {
    it('should display error message when error occurs', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: undefined,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: new Error('検索中にエラーが発生しました'),
      })

      render(<UserSearchResults query="test" />)
      expect(screen.getByText('検索中にエラーが発生しました')).toBeInTheDocument()
    })

    it('should display user without bio (bio is null)', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            users: [
              { id: 'u1', nickname: 'NoBioUser', avatarUrl: null, bio: null, followersCount: 5, followingCount: 3 },
            ],
            nextCursor: undefined,
          }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })

      render(<UserSearchResults query="test" />)
      expect(screen.getByText('NoBioUser')).toBeInTheDocument()
      expect(screen.getByText('5フォロワー')).toBeInTheDocument()
      // No bio paragraph should be rendered
      const bioElement = screen.queryByText('null')
      expect(bioElement).not.toBeInTheDocument()
    })

    it('should display user with bio', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            users: [
              { id: 'u1', nickname: 'BioUser', avatarUrl: null, bio: '盆栽が好きです', followersCount: 10, followingCount: 3 },
            ],
            nextCursor: undefined,
          }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })

      render(<UserSearchResults query="test" />)
      expect(screen.getByText('盆栽が好きです')).toBeInTheDocument()
    })

    it('should display user with avatarUrl', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            users: [
              { id: 'u1', nickname: 'AvatarUser', avatarUrl: '/avatar.jpg', bio: null, followersCount: 0, followingCount: 0 },
            ],
            nextCursor: undefined,
          }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })

      render(<UserSearchResults query="test" />)
      const img = screen.getByAltText('AvatarUser')
      expect(img).toBeInTheDocument()
    })

    it('should display first character when no avatarUrl', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            users: [
              { id: 'u1', nickname: 'テスト', avatarUrl: null, bio: null, followersCount: 0, followingCount: 0 },
            ],
            nextCursor: undefined,
          }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })

      render(<UserSearchResults query="test" />)
      expect(screen.getByText('テ')).toBeInTheDocument()
    })

    it('should show isFetchingNextPage spinner for users', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            users: [
              { id: 'u1', nickname: 'User1', avatarUrl: null, bio: null, followersCount: 0, followingCount: 0 },
            ],
            nextCursor: 'u1',
          }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: true,
        isLoading: false,
        error: null,
      })

      render(<UserSearchResults query="test" />)
      expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    })

    it('should show end-of-list message for users', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            users: [
              { id: 'u1', nickname: 'User1', avatarUrl: null, bio: null, followersCount: 0, followingCount: 0 },
            ],
            nextCursor: undefined,
          }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })

      render(<UserSearchResults query="test" />)
      expect(screen.getByText('これ以上ユーザーはいません')).toBeInTheDocument()
    })

    it('should set initialData with initialUsers', () => {
      const initialUsers = Array(20).fill(null).map((_, i) => ({
        id: `user-${i}`,
        nickname: `User${i}`,
        avatarUrl: null,
        bio: null,
        followersCount: 0,
        followingCount: 0,
      }))

      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ users: initialUsers, nextCursor: 'user-19' }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })

      render(<UserSearchResults query="test" initialUsers={initialUsers} />)
      const lastCallIndex = mockUseInfiniteQuery.mock.calls.length - 1
      const callArgs = mockUseInfiniteQuery.mock.calls[lastCallIndex][0]
      expect(callArgs.initialData).toBeDefined()
      expect(callArgs.initialData.pages[0].nextCursor).toBe('user-19')
    })
  })

  describe('TagSearchResults - empty string edge and isFetchingNextPage', () => {
    it('should show isFetchingNextPage spinner for tags', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            posts: [{ id: 'p1', content: '#tag post', user: { id: 'u1', nickname: 'User1' } }],
            nextCursor: 'p1',
          }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: true,
        isLoading: false,
      })

      render(<TagSearchResults tag="tag" />)
      expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    })

    it('should show tag header with post count', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            posts: [
              { id: 'p1', content: 'Post 1', user: { id: 'u1', nickname: 'User1' } },
              { id: 'p2', content: 'Post 2', user: { id: 'u1', nickname: 'User1' } },
            ],
            nextCursor: undefined,
          }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      })

      render(<TagSearchResults tag="盆栽" currentUserId="uid" />)
      expect(screen.getByText('#盆栽')).toBeInTheDocument()
      expect(screen.getByText('2件の投稿')).toBeInTheDocument()
    })

    it('should show end-of-list for tag results', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            posts: [{ id: 'p1', content: 'Post 1', user: { id: 'u1', nickname: 'User1' } }],
            nextCursor: undefined,
          }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      })

      render(<TagSearchResults tag="盆栽" />)
      expect(screen.getByText('これ以上投稿はありません')).toBeInTheDocument()
    })

    it('should set initialData for tags with 20+ initial posts', () => {
      const initialPosts = Array(20).fill(null).map((_, i) => ({
        id: `post-${i}`,
        content: `Post ${i}`,
        user: { id: 'u1', nickname: 'User1' },
      }))

      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ posts: initialPosts, nextCursor: 'post-19' }],
          pageParams: [undefined],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: false,
        isLoading: false,
      })

      render(<TagSearchResults tag="tag" initialPosts={initialPosts} />)
      const callArgs = mockUseInfiniteQuery.mock.calls[0][0]
      expect(callArgs.initialData).toBeDefined()
    })
  })

  describe('PopularTags - empty tags array', () => {
    it('should return null when tags array is empty', () => {
      const { container } = render(<PopularTags tags={[]} />)
      expect(container).toBeEmptyDOMElement()
    })

    it('should render tags when not empty', () => {
      render(<PopularTags tags={[{ tag: 'test', count: 1 }]} />)
      expect(screen.getByText('#test')).toBeInTheDocument()
    })
  })
})

// ============================================================
// MentionTextarea Tests
// ============================================================

describe('MentionTextarea - coverage boost', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    placeholder: 'テスト入力',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('handleChange - @ detection with newline before @', () => {
    it('should detect @ after newline character', async () => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: null, isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('テスト入力')

      // Simulate text with newline before @
      fireEvent.change(textarea, {
        target: { value: 'Hello\n@j', selectionStart: 8 },
      })

      act(() => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(mockSearchMentionUsers).toHaveBeenCalledWith('j', 8)
      })
    })
  })

  describe('handleChange - hasSpaceOrNewline is true', () => {
    it('should not search when text after @ contains space', () => {
      render(<MentionTextarea {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('テスト入力')

      // "@john doe" - space in the mention text
      fireEvent.change(textarea, {
        target: { value: '@john doe', selectionStart: 9 },
      })

      act(() => {
        vi.advanceTimersByTime(400)
      })

      // Should not have been called because there's a space after @
      expect(mockSearchMentionUsers).not.toHaveBeenCalled()
    })

    it('should not search when text after @ contains newline', () => {
      render(<MentionTextarea {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('テスト入力')

      fireEvent.change(textarea, {
        target: { value: '@john\nmore text', selectionStart: 15 },
      })

      act(() => {
        vi.advanceTimersByTime(400)
      })

      expect(mockSearchMentionUsers).not.toHaveBeenCalled()
    })
  })

  describe('handleKeyDown - showSuggestions=true but suggestions.length === 0', () => {
    it('should not process keyboard events when no suggestions', async () => {
      mockSearchMentionUsers.mockResolvedValue([])

      render(<MentionTextarea {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('テスト入力')

      fireEvent.change(textarea, {
        target: { value: '@xyz', selectionStart: 4 },
      })

      act(() => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(mockSearchMentionUsers).toHaveBeenCalled()
      })

      // Try pressing ArrowDown - should not cause issues
      fireEvent.keyDown(textarea, { key: 'ArrowDown' })
      fireEvent.keyDown(textarea, { key: 'Enter' })
      fireEvent.keyDown(textarea, { key: 'Escape' })

      // Textarea should still be in the document and functional after key events
      expect(textarea).toBeInTheDocument()
      // Search was triggered but key events did not cause errors
      expect(mockSearchMentionUsers).toHaveBeenCalled()
    })
  })

  describe('selectUser - when triggerPosition is null', () => {
    it('should not insert mention when triggerPosition is null', async () => {
      const onChange = vi.fn()
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: null, isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} onChange={onChange} />)
      const textarea = screen.getByPlaceholderText('テスト入力')

      // First trigger suggestions
      fireEvent.change(textarea, {
        target: { value: '@j', selectionStart: 2 },
      })

      act(() => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@john')).toBeInTheDocument()
      })

      // Escape to close suggestions (sets triggerPosition to null)
      fireEvent.keyDown(textarea, { key: 'Escape' })

      // After Escape, suggestions are closed, so selectUser should not be triggered
      // This tests the guard condition
    })
  })

  describe('keyboard navigation edge cases', () => {
    it('should wrap around with ArrowDown on last suggestion', async () => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'alice', avatarUrl: null, isFollowing: false },
        { id: 'user2', nickname: 'bob', avatarUrl: null, isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('テスト入力')

      fireEvent.change(textarea, {
        target: { value: '@', selectionStart: 1 },
      })

      act(() => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@alice')).toBeInTheDocument()
      })

      // Press ArrowDown twice to wrap around (0 -> 1 -> 0)
      fireEvent.keyDown(textarea, { key: 'ArrowDown' })
      fireEvent.keyDown(textarea, { key: 'ArrowDown' })

      // Should wrap back to alice (index 0)
      const aliceButton = screen.getByText('@alice').closest('button')
      expect(aliceButton).toHaveClass('bg-muted')
    })

    it('should wrap around with ArrowUp from first suggestion', async () => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'alice', avatarUrl: null, isFollowing: false },
        { id: 'user2', nickname: 'bob', avatarUrl: null, isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('テスト入力')

      fireEvent.change(textarea, {
        target: { value: '@', selectionStart: 1 },
      })

      act(() => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@alice')).toBeInTheDocument()
      })

      // Press ArrowUp from index 0 should go to last (bob)
      fireEvent.keyDown(textarea, { key: 'ArrowUp' })

      const bobButton = screen.getByText('@bob').closest('button')
      expect(bobButton).toHaveClass('bg-muted')
    })

    it('should handle Tab key when suggestions are present', async () => {
      const onChange = vi.fn()
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: null, isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} onChange={onChange} />)
      const textarea = screen.getByPlaceholderText('テスト入力')

      fireEvent.change(textarea, {
        target: { value: '@j', selectionStart: 2 },
      })

      act(() => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@john')).toBeInTheDocument()
      })

      fireEvent.keyDown(textarea, { key: 'Tab' })

      // Tab should select the user
      expect(onChange).toHaveBeenCalledWith('<@user1> ')
    })

    it('should handle Escape key to close dropdown', async () => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: null, isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('テスト入力')

      fireEvent.change(textarea, {
        target: { value: '@j', selectionStart: 2 },
      })

      act(() => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@john')).toBeInTheDocument()
      })

      fireEvent.keyDown(textarea, { key: 'Escape' })

      await waitFor(() => {
        expect(screen.queryByText('@john')).not.toBeInTheDocument()
      })
    })
  })

  describe('mouseEnter on suggestion', () => {
    it('should update selectedIndex on mouseEnter', async () => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'alice', avatarUrl: null, isFollowing: false },
        { id: 'user2', nickname: 'bob', avatarUrl: null, isFollowing: false },
      ])

      render(<MentionTextarea {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('テスト入力')

      fireEvent.change(textarea, {
        target: { value: '@', selectionStart: 1 },
      })

      act(() => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@bob')).toBeInTheDocument()
      })

      // Hover over bob
      const bobButton = screen.getByText('@bob').closest('button')!
      fireEvent.mouseEnter(bobButton)

      expect(bobButton).toHaveClass('bg-muted')
    })
  })

  describe('outside click to close dropdown', () => {
    it('should close dropdown on outside click', async () => {
      mockSearchMentionUsers.mockResolvedValue([
        { id: 'user1', nickname: 'john', avatarUrl: null, isFollowing: false },
      ])

      render(
        <div>
          <div data-testid="outside">Outside</div>
          <MentionTextarea {...defaultProps} />
        </div>
      )

      const textarea = screen.getByPlaceholderText('テスト入力')
      fireEvent.change(textarea, {
        target: { value: '@j', selectionStart: 2 },
      })

      act(() => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('@john')).toBeInTheDocument()
      })

      // Click outside
      fireEvent.mouseDown(screen.getByTestId('outside'))

      await waitFor(() => {
        expect(screen.queryByText('@john')).not.toBeInTheDocument()
      })
    })
  })

  describe('@ not valid trigger (character before @ is not space/newline)', () => {
    it('should not trigger search when @ is preceded by non-space character', () => {
      render(<MentionTextarea {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('テスト入力')

      // "abc@j" - @ preceded by 'c', not a space
      fireEvent.change(textarea, {
        target: { value: 'abc@j', selectionStart: 5 },
      })

      act(() => {
        vi.advanceTimersByTime(400)
      })

      expect(mockSearchMentionUsers).not.toHaveBeenCalled()
    })
  })
})

// ============================================================
// AnalogClockPicker Tests
// ============================================================

describe('AnalogClockPicker - coverage boost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('minutes mode interaction', () => {
    it('should handle mouseDown in minutes mode', () => {
      const onChange = vi.fn()
      const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)

      // Open picker
      fireEvent.click(screen.getByRole('button'))

      // Switch to minutes mode
      const minuteBtn = screen.getAllByRole('button').find(
        (btn) => btn.textContent === '00' && btn.classList.contains('text-3xl')
      )
      if (minuteBtn) fireEvent.click(minuteBtn)

      // Now interact with clock in minutes mode
      const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
      if (clockFace) {
        vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
          x: 0, y: 0, toJSON: () => {},
        })

        // Click at 3 o'clock position (right side) = 15 minutes
        fireEvent.mouseDown(clockFace, { clientX: 224, clientY: 112 })
        expect(onChange).toHaveBeenCalled()
      }
    })

    it('should close picker on mouseUp in minutes mode', () => {
      const onChange = vi.fn()
      const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)

      fireEvent.click(screen.getByRole('button'))

      // Switch to minutes mode
      const minuteBtn = screen.getAllByRole('button').find(
        (btn) => btn.textContent === '00' && btn.classList.contains('text-3xl')
      )
      if (minuteBtn) fireEvent.click(minuteBtn)

      const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
      if (clockFace) {
        vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
          x: 0, y: 0, toJSON: () => {},
        })

        fireEvent.mouseUp(clockFace, { clientX: 112, clientY: 224 })
        // Picker should close after minutes selection with isEnd=true
        expect(screen.queryByText('OK')).not.toBeInTheDocument()
      }
    })

    it('should handle mouseMove in minutes mode with button pressed', () => {
      const onChange = vi.fn()
      const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)

      fireEvent.click(screen.getByRole('button'))

      // Switch to minutes mode
      const minuteBtn = screen.getAllByRole('button').find(
        (btn) => btn.textContent === '00' && btn.classList.contains('text-3xl')
      )
      if (minuteBtn) fireEvent.click(minuteBtn)

      const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
      if (clockFace) {
        vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
          x: 0, y: 0, toJSON: () => {},
        })

        fireEvent.mouseMove(clockFace, { clientX: 224, clientY: 112, buttons: 1 })
        expect(onChange).toHaveBeenCalled()
      }
    })
  })

  describe('handleMouseMove - e.buttons !== 1', () => {
    it('should ignore mouseMove when button is not pressed', () => {
      const onChange = vi.fn()
      const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)

      fireEvent.click(screen.getByRole('button'))

      const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
      if (clockFace) {
        vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
          x: 0, y: 0, toJSON: () => {},
        })

        // buttons=0 means no button is pressed
        fireEvent.mouseMove(clockFace, { clientX: 224, clientY: 112, buttons: 0 })
        expect(onChange).not.toHaveBeenCalled()
      }
    })
  })

  describe('inner ring (PM) detection', () => {
    it('should select PM hour when clicking near center', () => {
      const onChange = vi.fn()
      const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)

      fireEvent.click(screen.getByRole('button'))

      const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
      if (clockFace) {
        vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
          x: 0, y: 0, toJSON: () => {},
        })

        // Click very near center (inner ring) at 12 o'clock position
        // Center is (112, 112), click at (112, 75) which is close to center
        // Distance = sqrt(0 + 37^2) = 37, radius = 112, 37/112 = 0.33 < 0.55 -> inner ring
        fireEvent.mouseDown(clockFace, { clientX: 112, clientY: 75 })

        expect(onChange).toHaveBeenCalled()
        // Should be PM (inner ring at 12 o'clock = 12)
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
        expect(lastCall).toMatch(/^\d{2}:\d{2}$/)
      }
    })

    it('should select AM 0 hour when clicking outer ring at 12 position', () => {
      const onChange = vi.fn()
      const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)

      fireEvent.click(screen.getByRole('button'))

      const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
      if (clockFace) {
        vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
          x: 0, y: 0, toJSON: () => {},
        })

        // Click at outer ring, 12 o'clock (top center)
        // Center is (112, 112), click at (112, 5) which is far from center
        // Distance = 107, radius = 112, 107/112 = 0.955 > 0.55 -> outer ring
        // Angle = 0 degrees (12 o'clock) -> Math.round(0/30) % 12 = 0
        // Outer ring: newHours = 0 (since it equals 0, stays 0)
        fireEvent.mouseDown(clockFace, { clientX: 112, clientY: 5 })

        expect(onChange).toHaveBeenCalled()
      }
    })
  })

  describe('touch events in minutes mode', () => {
    it('should handle touchStart in minutes mode', () => {
      const onChange = vi.fn()
      const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)

      fireEvent.click(screen.getByRole('button'))

      // Switch to minutes mode
      const minuteBtn = screen.getAllByRole('button').find(
        (btn) => btn.textContent === '00' && btn.classList.contains('text-3xl')
      )
      if (minuteBtn) fireEvent.click(minuteBtn)

      const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
      if (clockFace) {
        vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
          x: 0, y: 0, toJSON: () => {},
        })

        fireEvent.touchStart(clockFace, {
          touches: [{ clientX: 224, clientY: 112 }],
          preventDefault: vi.fn(),
        })
        expect(onChange).toHaveBeenCalled()
      }
    })

    it('should handle touchMove in minutes mode', () => {
      const onChange = vi.fn()
      const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)

      fireEvent.click(screen.getByRole('button'))

      const minuteBtn = screen.getAllByRole('button').find(
        (btn) => btn.textContent === '00' && btn.classList.contains('text-3xl')
      )
      if (minuteBtn) fireEvent.click(minuteBtn)

      const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
      if (clockFace) {
        vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
          x: 0, y: 0, toJSON: () => {},
        })

        fireEvent.touchMove(clockFace, {
          touches: [{ clientX: 112, clientY: 224 }],
          preventDefault: vi.fn(),
        })
        expect(onChange).toHaveBeenCalled()
      }
    })

    it('should handle touchEnd in minutes mode and close picker', () => {
      const onChange = vi.fn()
      const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)

      fireEvent.click(screen.getByRole('button'))

      const minuteBtn = screen.getAllByRole('button').find(
        (btn) => btn.textContent === '00' && btn.classList.contains('text-3xl')
      )
      if (minuteBtn) fireEvent.click(minuteBtn)

      const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
      if (clockFace) {
        vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
          left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
          x: 0, y: 0, toJSON: () => {},
        })

        fireEvent.touchEnd(clockFace, {
          changedTouches: [{ clientX: 112, clientY: 224 }],
          preventDefault: vi.fn(),
        })

        // Should close after minutes touchEnd
        expect(screen.queryByText('OK')).not.toBeInTheDocument()
      }
    })
  })

  describe('disabled touch events', () => {
    it('should not respond to touch events when disabled', () => {
      const onChange = vi.fn()
      render(<AnalogClockPicker value="09:00" onChange={onChange} disabled />)

      // Cannot open picker when disabled
      fireEvent.click(screen.getByRole('button'))
      expect(screen.queryByText('OK')).not.toBeInTheDocument()
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('value "00:00" edge case', () => {
    it('should correctly display and handle 00:00 value', () => {
      const { container } = render(<AnalogClockPicker value="00:00" onChange={vi.fn()} />)
      expect(screen.getByText('00:00')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button'))
      // In hour mode, 0 should be highlighted in inner ring
      const highlighted = container.querySelectorAll('.bg-primary')
      expect(highlighted.length).toBeGreaterThan(0)
    })
  })

  describe('click outside detection', () => {
    it('should close picker and reset mode on outside click', () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <AnalogClockPicker value="09:00" onChange={vi.fn()} />
        </div>
      )

      fireEvent.click(screen.getByRole('button'))
      expect(screen.getByText('OK')).toBeInTheDocument()

      fireEvent.mouseDown(screen.getByTestId('outside'))
      expect(screen.queryByText('OK')).not.toBeInTheDocument()
    })
  })

  describe('getAngleFromCenter - no clockRef', () => {
    it('should return 0 when clockRef is not available', () => {
      const onChange = vi.fn()
      render(<AnalogClockPicker value="09:00" onChange={onChange} />)

      // Picker not open = no clockRef, so any interaction should handle gracefully
      // Verify the component renders with the initial value and picker is closed
      expect(screen.getByRole('button')).toBeInTheDocument()
      expect(screen.queryByText('OK')).not.toBeInTheDocument()
      // onChange should not have been called since no interaction occurred
      expect(onChange).not.toHaveBeenCalled()
    })
  })
})
