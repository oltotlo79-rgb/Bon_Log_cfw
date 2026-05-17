import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'

// PostCard コンポーネントをモック
vi.mock('@/components/post/PostCard', () => ({
  PostCard: ({ post }: { post: { id: string; content: string } }) => (
    <div data-testid="post-card">{post.content}</div>
  ),
}))

// SearchResultsSkeleton モック
vi.mock('@/components/search/SearchResultsSkeleton', () => ({
  SearchResultsSkeleton: () => <div className="animate-pulse">Loading...</div>,
}))

// React Query モック
const mockUseInfiniteQuery = vi.fn().mockReturnValue({
  data: undefined,
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
})

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (...args: unknown[]) => mockUseInfiniteQuery(...args),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  QueryClient: vi.fn(),
}))

// intersection-observer モック
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: false }),
}))

// Server Actions モック
vi.mock('@/lib/actions/search', () => ({
  searchPosts: vi.fn(),
}))

import { PostSearchResults } from '@/components/search/PostSearchResults'

describe('PostSearchResults', () => {
  beforeEach(() => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    })
  })

  it('検索結果がある場合に投稿カードを表示すること', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          posts: [
            { id: 'post-1', content: '盆栽の手入れ', user: { id: 'user-1', nickname: 'User1' } },
            { id: 'post-2', content: '松の剪定方法', user: { id: 'user-2', nickname: 'User2' } },
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

    render(<PostSearchResults query="盆栽" currentUserId="test-user-id" />)

    expect(screen.getByText('盆栽の手入れ')).toBeInTheDocument()
    expect(screen.getByText('松の剪定方法')).toBeInTheDocument()
  })

  it('クエリありで結果がない場合にメッセージを表示すること', () => {
    render(<PostSearchResults query="存在しないキーワード" />)

    expect(screen.getByText('「存在しないキーワード」に一致する投稿はありません')).toBeInTheDocument()
  })

  it('クエリなしで結果がない場合にメッセージを表示すること', () => {
    render(<PostSearchResults query="" />)

    expect(screen.getByText('投稿が見つかりません')).toBeInTheDocument()
  })

  it('ローディング中はスケルトンを表示すること', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
    })

    const { container } = render(<PostSearchResults query="test" />)

    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton).toBeTruthy()
  })

  it('次ページ読み込み中にローディングインジケーターを表示すること', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          posts: [
            { id: 'post-1', content: 'テスト投稿', user: { id: 'user-1', nickname: 'User1' } },
          ],
          nextCursor: 'next-cursor',
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

  it('これ以上投稿がない場合にメッセージを表示すること', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          posts: [
            { id: 'post-1', content: 'テスト投稿', user: { id: 'user-1', nickname: 'User1' } },
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

    render(<PostSearchResults query="test" />)

    expect(screen.getByText('これ以上投稿はありません')).toBeInTheDocument()
  })
})
