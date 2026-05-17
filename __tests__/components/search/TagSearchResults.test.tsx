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
  searchByTag: vi.fn(),
}))

import { TagSearchResults } from '@/components/search/TagSearchResults'

describe('TagSearchResults', () => {
  beforeEach(() => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    })
  })

  it('タグ検索結果がある場合に投稿カードを表示すること', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          posts: [
            { id: 'post-1', content: '#松柏 の手入れ', user: { id: 'user-1', nickname: 'User1' } },
            { id: 'post-2', content: '#松柏 の剪定', user: { id: 'user-2', nickname: 'User2' } },
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

    render(<TagSearchResults tag="松柏" currentUserId="test-user-id" />)

    expect(screen.getByText('#松柏 の手入れ')).toBeInTheDocument()
    expect(screen.getByText('#松柏 の剪定')).toBeInTheDocument()
  })

  it('タグ名のヘッダーと投稿数を表示すること', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          posts: [
            { id: 'post-1', content: 'テスト投稿1', user: { id: 'user-1', nickname: 'User1' } },
            { id: 'post-2', content: 'テスト投稿2', user: { id: 'user-2', nickname: 'User2' } },
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

    render(<TagSearchResults tag="盆栽" />)

    expect(screen.getByText('#盆栽')).toBeInTheDocument()
    expect(screen.getByText('2件の投稿')).toBeInTheDocument()
  })

  it('タグありで結果がない場合にメッセージを表示すること', () => {
    render(<TagSearchResults tag="存在しないタグ" />)

    expect(screen.getByText('#存在しないタグ を含む投稿はありません')).toBeInTheDocument()
  })

  it('タグが空の場合にメッセージを表示すること', () => {
    render(<TagSearchResults tag="" />)

    expect(screen.getByText('タグを入力してください')).toBeInTheDocument()
  })

  it('ローディング中はスケルトンを表示すること', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
    })

    const { container } = render(<TagSearchResults tag="盆栽" />)

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

    render(<TagSearchResults tag="盆栽" />)

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

    render(<TagSearchResults tag="盆栽" />)

    expect(screen.getByText('これ以上投稿はありません')).toBeInTheDocument()
  })
})
