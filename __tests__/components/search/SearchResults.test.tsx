import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '../../utils/test-utils'

// next/cache モック
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
  cache: vi.fn((fn) => fn),
}))

// PostCard モック
vi.mock('@/components/post/PostCard', () => ({
  PostCard: ({ post }: { post: { id: string; content: string } }) => (
    <div data-testid="post-card">{post.content}</div>
  ),
}))

import { PopularTags } from '@/components/search/SearchResults'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// next/navigation モック
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/search',
  useSearchParams: () => new URLSearchParams(''),
}))

// react-intersection-observer モック
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: false }),
}))

// search actions モック（ActionResult 形式）
vi.mock('@/lib/actions/search', () => ({
  searchPosts: vi.fn().mockResolvedValue({ success: true, data: { posts: [], nextCursor: undefined } }),
  searchUsers: vi.fn().mockResolvedValue({ success: true, data: { users: [], nextCursor: undefined } }),
}))

// next/image モック
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, width, height, className }: {
    src: string
    alt: string
    width?: number
    height?: number
    className?: string
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}))

describe('PopularTags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('人気タグを表示する', () => {
    const tags = [
      { tag: '松柏類', count: 100 },
      { tag: '雑木類', count: 50 },
    ]

    render(<PopularTags tags={tags} />)

    expect(screen.getByText('人気のタグ')).toBeInTheDocument()
    expect(screen.getByText('#松柏類')).toBeInTheDocument()
    expect(screen.getByText('#雑木類')).toBeInTheDocument()
  })

  it('タグの投稿数を表示する', () => {
    const tags = [
      { tag: '松柏類', count: 100 },
    ]

    render(<PopularTags tags={tags} />)

    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('タグをクリックすると検索ページに遷移するリンクを設定する', () => {
    const tags = [
      { tag: '松柏類', count: 100 },
    ]

    render(<PopularTags tags={tags} />)

    const link = screen.getByRole('link', { name: /#松柏類/ })
    expect(link).toHaveAttribute('href', `/search?tab=tags&q=${encodeURIComponent('松柏類')}`)
  })

  it('タグが空の場合は何も表示しない', () => {
    const { container } = render(<PopularTags tags={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it('複数のタグをバッジとして表示する', () => {
    const tags = [
      { tag: '松柏類', count: 100 },
      { tag: '雑木類', count: 50 },
      { tag: '道具', count: 30 },
    ]

    render(<PopularTags tags={tags} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(3)
  })
})
