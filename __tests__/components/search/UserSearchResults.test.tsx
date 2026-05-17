import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'

// next/image モック
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="next-image" {...props} />
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
  error: null,
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
  searchUsers: vi.fn(),
}))

import { UserSearchResults } from '@/components/search/UserSearchResults'

describe('UserSearchResults', () => {
  beforeEach(() => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      error: null,
    })
  })

  it('検索結果がある場合にユーザーを表示すること', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          users: [
            { id: 'user-1', nickname: '盆栽太郎', avatarUrl: '/avatar1.jpg', bio: '盆栽歴10年', followersCount: 100, followingCount: 50 },
            { id: 'user-2', nickname: '松花子', avatarUrl: null, bio: null, followersCount: 200, followingCount: 30 },
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

    render(<UserSearchResults query="盆栽" />)

    expect(screen.getByText('盆栽太郎')).toBeInTheDocument()
    expect(screen.getByText('松花子')).toBeInTheDocument()
    expect(screen.getByText('盆栽歴10年')).toBeInTheDocument()
    expect(screen.getByText('100フォロワー')).toBeInTheDocument()
    expect(screen.getByText('200フォロワー')).toBeInTheDocument()
  })

  it('アバター画像がある場合に画像を表示すること', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          users: [
            { id: 'user-1', nickname: '盆栽太郎', avatarUrl: '/avatar1.jpg', bio: null, followersCount: 10, followingCount: 5 },
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

    const image = screen.getByTestId('next-image')
    expect(image).toHaveAttribute('src', '/avatar1.jpg')
  })

  it('アバター画像がない場合にニックネームの頭文字を表示すること', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          users: [
            { id: 'user-1', nickname: '松花子', avatarUrl: null, bio: null, followersCount: 10, followingCount: 5 },
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

    // ニックネームの頭文字が表示される
    expect(screen.getByText('松')).toBeInTheDocument()
  })

  it('クエリありで結果がない場合にメッセージを表示すること', () => {
    render(<UserSearchResults query="存在しないユーザー" />)

    expect(screen.getByText('「存在しないユーザー」に一致するユーザーはいません')).toBeInTheDocument()
  })

  it('クエリなしで結果がない場合にメッセージを表示すること', () => {
    render(<UserSearchResults query="" />)

    expect(screen.getByText('ユーザーが見つかりません')).toBeInTheDocument()
  })

  it('ローディング中はスケルトンを表示すること', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      error: null,
    })

    const { container } = render(<UserSearchResults query="test" />)

    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton).toBeTruthy()
  })

  it('ユーザーリンクが正しいhrefを持つこと', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [{
          users: [
            { id: 'user-123', nickname: 'テストユーザー', avatarUrl: null, bio: null, followersCount: 0, followingCount: 0 },
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

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/users/user-123')
  })

  it('エラー時にエラーメッセージを表示すること', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      error: new Error('検索エラーが発生しました'),
    })

    render(<UserSearchResults query="test" />)

    expect(screen.getByText('検索エラーが発生しました')).toBeInTheDocument()
  })
})
