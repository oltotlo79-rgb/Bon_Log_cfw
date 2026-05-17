import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// React Query モック
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  }
})

// Server Action モック
const mockGetBookmarkedPosts = vi.fn()
vi.mock('@/lib/actions/bookmark', () => ({
  getBookmarkedPosts: (...args: unknown[]) => mockGetBookmarkedPosts(...args),
  toggleBookmark: vi.fn().mockResolvedValue({ success: true, data: { bookmarked: true } }),
}))

// PostCard モック
vi.mock('@/components/post/PostCard', () => ({
  PostCard: ({ post, currentUserId }: { post: { id: string; content: string | null }; currentUserId: string }) => (
    <div data-testid={`post-card-${post.id}`} data-user-id={currentUserId}>
      {post.content}
    </div>
  ),
}))

// lucide-react モック
vi.mock('lucide-react', () => ({
  Bookmark: ({ className }: { className?: string }) => (
    <svg data-testid="bookmark-icon" className={className} />
  ),
}))

// shadcn/ui Button モック
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}))

// useToast モック
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

import { BookmarkPostList } from '@/app/(main)/bookmarks/BookmarkPostList'

const createPost = (id: string, content: string = `投稿内容${id}`) => ({
  id,
  content,
  createdAt: '2024-01-01T00:00:00Z',
  user: { id: `user-${id}`, nickname: `ユーザー${id}`, avatarUrl: null },
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

  it('ブックマークした投稿を表示する', () => {
    const posts = [createPost('1'), createPost('2')]

    render(<BookmarkPostList initialPosts={posts} currentUserId="user-1" />)

    expect(screen.getByTestId('post-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('post-card-2')).toBeInTheDocument()
  })

  it('ブックマークが空の場合に空状態を表示する', () => {
    render(<BookmarkPostList initialPosts={[]} currentUserId="user-1" />)

    expect(screen.getByText('ブックマークした投稿はありません')).toBeInTheDocument()
  })

  it('空状態で補足メッセージを表示する', () => {
    render(<BookmarkPostList initialPosts={[]} currentUserId="user-1" />)

    expect(screen.getByText('気になる投稿をブックマークして後で見返しましょう')).toBeInTheDocument()
  })

  it('空状態でブックマークアイコンを表示する', () => {
    render(<BookmarkPostList initialPosts={[]} currentUserId="user-1" />)

    expect(screen.getByTestId('bookmark-icon')).toBeInTheDocument()
  })

  it('次カーソルがある場合にさらに読み込むボタンを表示する', () => {
    const posts = [createPost('1')]

    render(<BookmarkPostList initialPosts={posts} initialNextCursor="cursor-1" currentUserId="user-1" />)

    expect(screen.getByText('さらに読み込む')).toBeInTheDocument()
  })

  it('次カーソルがない場合にさらに読み込むボタンを表示しない', () => {
    const posts = [createPost('1')]

    render(<BookmarkPostList initialPosts={posts} currentUserId="user-1" />)

    expect(screen.queryByText('さらに読み込む')).not.toBeInTheDocument()
  })

  it('さらに読み込むボタンクリックで追加データを取得する', async () => {
    const user = userEvent.setup()
    const posts = [createPost('1')]
    mockGetBookmarkedPosts.mockResolvedValue({
      posts: [createPost('2')],
      nextCursor: undefined,
    })

    render(<BookmarkPostList initialPosts={posts} initialNextCursor="cursor-1" currentUserId="user-1" />)

    await user.click(screen.getByText('さらに読み込む'))

    await waitFor(() => {
      expect(mockGetBookmarkedPosts).toHaveBeenCalledWith('cursor-1')
    })
  })

  it('読み込み中に読み込み中テキストを表示する', async () => {
    const user = userEvent.setup()
    const posts = [createPost('1')]
    mockGetBookmarkedPosts.mockImplementation(() => new Promise(() => {})) // 永続pending

    render(<BookmarkPostList initialPosts={posts} initialNextCursor="cursor-1" currentUserId="user-1" />)

    await user.click(screen.getByText('さらに読み込む'))

    await waitFor(() => {
      expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    })
  })

  it('PostCardにcurrentUserIdが渡される', () => {
    const posts = [createPost('1')]

    render(<BookmarkPostList initialPosts={posts} currentUserId="my-user-id" />)

    const card = screen.getByTestId('post-card-1')
    expect(card).toHaveAttribute('data-user-id', 'my-user-id')
  })

  it('投稿の内容が表示される', () => {
    const posts = [createPost('1', 'テスト投稿内容')]

    render(<BookmarkPostList initialPosts={posts} currentUserId="user-1" />)

    expect(screen.getByText('テスト投稿内容')).toBeInTheDocument()
  })

  it('単一の投稿を処理する', () => {
    const posts = [createPost('1')]

    render(<BookmarkPostList initialPosts={posts} currentUserId="user-1" />)

    expect(screen.getByTestId('post-card-1')).toBeInTheDocument()
  })

  it('多数の投稿を処理する', () => {
    const posts = Array.from({ length: 20 }, (_, i) => createPost(`${i + 1}`))

    render(<BookmarkPostList initialPosts={posts} currentUserId="user-1" />)

    posts.forEach(post => {
      expect(screen.getByTestId(`post-card-${post.id}`)).toBeInTheDocument()
    })
  })

  it('追加読み込み後に投稿が追加される', async () => {
    const user = userEvent.setup()
    const posts = [createPost('1')]
    mockGetBookmarkedPosts.mockResolvedValue({
      posts: [createPost('2')],
      nextCursor: undefined,
    })

    render(<BookmarkPostList initialPosts={posts} initialNextCursor="cursor-1" currentUserId="user-1" />)

    await user.click(screen.getByText('さらに読み込む'))

    await waitFor(() => {
      expect(screen.getByTestId('post-card-1')).toBeInTheDocument()
      expect(screen.getByTestId('post-card-2')).toBeInTheDocument()
    })
  })

  it('追加読み込み後に次カーソルが更新される', async () => {
    const user = userEvent.setup()
    const posts = [createPost('1')]
    mockGetBookmarkedPosts.mockResolvedValue({
      posts: [createPost('2')],
      nextCursor: 'cursor-2',
    })

    render(<BookmarkPostList initialPosts={posts} initialNextCursor="cursor-1" currentUserId="user-1" />)

    await user.click(screen.getByText('さらに読み込む'))

    await waitFor(() => {
      // ボタンがまだ表示されていることで次カーソルがあると確認
      expect(screen.getByText('さらに読み込む')).toBeInTheDocument()
    })
  })

  it('追加読み込み後に次カーソルがなければボタンが消える', async () => {
    const user = userEvent.setup()
    const posts = [createPost('1')]
    mockGetBookmarkedPosts.mockResolvedValue({
      posts: [createPost('2')],
      nextCursor: undefined,
    })

    render(<BookmarkPostList initialPosts={posts} initialNextCursor="cursor-1" currentUserId="user-1" />)

    await user.click(screen.getByText('さらに読み込む'))

    await waitFor(() => {
      expect(screen.queryByText('さらに読み込む')).not.toBeInTheDocument()
    })
  })

  it('読み込み中はボタンが無効化される', async () => {
    const user = userEvent.setup()
    const posts = [createPost('1')]
    mockGetBookmarkedPosts.mockImplementation(() => new Promise(() => {}))

    render(<BookmarkPostList initialPosts={posts} initialNextCursor="cursor-1" currentUserId="user-1" />)

    await user.click(screen.getByText('さらに読み込む'))

    await waitFor(() => {
      const button = screen.getByText('読み込み中...')
      expect(button).toBeDisabled()
    })
  })

  it('投稿リストがdivide-yクラスを持つ', () => {
    const posts = [createPost('1')]

    const { container } = render(<BookmarkPostList initialPosts={posts} currentUserId="user-1" />)

    const divider = container.querySelector('.divide-y')
    expect(divider).toBeInTheDocument()
  })

  it('各投稿にユニークなkeyがある（重複投稿なし）', () => {
    const posts = [createPost('1'), createPost('2'), createPost('3')]

    render(<BookmarkPostList initialPosts={posts} currentUserId="user-1" />)

    expect(screen.getByTestId('post-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('post-card-2')).toBeInTheDocument()
    expect(screen.getByTestId('post-card-3')).toBeInTheDocument()
  })
})
