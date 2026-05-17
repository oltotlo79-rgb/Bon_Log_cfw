import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookmarkPostList } from '@/app/(main)/bookmarks/BookmarkPostList'

const mockGetBookmarkedPosts = vi.fn()

vi.mock('@/lib/actions/bookmark', () => ({
  getBookmarkedPosts: (...args: unknown[]) => mockGetBookmarkedPosts(...args),
}))

vi.mock('@/components/post/PostCard', () => ({
  PostCard: ({ post }: { post: { id: string; content: string | null } }) => (
    <div data-testid={`post-${post.id}`}>{post.content}</div>
  ),
}))

const createMockPost = (id: string, content: string) => ({
  id,
  content,
  createdAt: new Date().toISOString(),
  user: { id: 'user-1', nickname: 'テスト', avatarUrl: null },
  media: [],
  genres: [],
  likeCount: 0,
  commentCount: 0,
  isLiked: false,
  isBookmarked: true,
})

describe('BookmarkPostList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('投稿一覧を表示する', () => {
    const posts = [createMockPost('1', 'テスト投稿1'), createMockPost('2', 'テスト投稿2')]
    render(<BookmarkPostList initialPosts={posts} currentUserId="user-1" />)

    expect(screen.getByTestId('post-1')).toBeInTheDocument()
    expect(screen.getByTestId('post-2')).toBeInTheDocument()
  })

  it('ブックマークが空の場合、案内メッセージを表示する', () => {
    render(<BookmarkPostList initialPosts={[]} currentUserId="user-1" />)

    expect(screen.getByText('ブックマークした投稿はありません')).toBeInTheDocument()
    expect(screen.getByText('気になる投稿をブックマークして後で見返しましょう')).toBeInTheDocument()
  })

  it('次のカーソルがある場合、「さらに読み込む」ボタンを表示する', () => {
    const posts = [createMockPost('1', 'テスト')]
    render(
      <BookmarkPostList
        initialPosts={posts}
        initialNextCursor="cursor-1"
        currentUserId="user-1"
      />
    )

    expect(screen.getByText('さらに読み込む')).toBeInTheDocument()
  })

  it('次のカーソルがない場合、「さらに読み込む」ボタンを表示しない', () => {
    const posts = [createMockPost('1', 'テスト')]
    render(<BookmarkPostList initialPosts={posts} currentUserId="user-1" />)

    expect(screen.queryByText('さらに読み込む')).not.toBeInTheDocument()
  })

  it('「さらに読み込む」をクリックすると追加投稿を取得する', async () => {
    const user = userEvent.setup()
    const newPost = createMockPost('2', '追加投稿')
    mockGetBookmarkedPosts.mockResolvedValueOnce({ posts: [newPost], nextCursor: undefined })

    render(
      <BookmarkPostList
        initialPosts={[createMockPost('1', '初期投稿')]}
        initialNextCursor="cursor-1"
        currentUserId="user-1"
      />
    )

    await user.click(screen.getByText('さらに読み込む'))

    await waitFor(() => {
      expect(screen.getByTestId('post-2')).toBeInTheDocument()
    })
    expect(mockGetBookmarkedPosts).toHaveBeenCalledWith('cursor-1')
  })

  it('読み込み中はボタンが無効化される', async () => {
    const user = userEvent.setup()
    mockGetBookmarkedPosts.mockImplementation(() => new Promise(() => {}))

    render(
      <BookmarkPostList
        initialPosts={[createMockPost('1', 'テスト')]}
        initialNextCursor="cursor-1"
        currentUserId="user-1"
      />
    )

    await user.click(screen.getByText('さらに読み込む'))

    await waitFor(() => {
      expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    })
  })

  it('追加読み込み後に次のカーソルがなければボタンが消える', async () => {
    const user = userEvent.setup()
    mockGetBookmarkedPosts.mockResolvedValueOnce({
      posts: [createMockPost('2', '追加')],
      nextCursor: undefined,
    })

    render(
      <BookmarkPostList
        initialPosts={[createMockPost('1', '初期')]}
        initialNextCursor="cursor-1"
        currentUserId="user-1"
      />
    )

    await user.click(screen.getByText('さらに読み込む'))

    await waitFor(() => {
      expect(screen.queryByText('さらに読み込む')).not.toBeInTheDocument()
    })
  })
})
