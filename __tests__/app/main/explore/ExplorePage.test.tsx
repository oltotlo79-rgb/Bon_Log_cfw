import { vi } from 'vitest'
import { render, screen } from '../../../utils/test-utils'

const mockGetTrendingHashtags = vi.fn()
const mockGetTrendingGenres = vi.fn()
const mockGetRecommendedUsers = vi.fn()

vi.mock('@/lib/actions/feed', () => ({
  getTrendingGenres: () => mockGetTrendingGenres(),
  getRecommendedUsers: () => mockGetRecommendedUsers(),
}))
vi.mock('@/lib/actions/hashtag', () => ({
  getTrendingHashtags: () => mockGetTrendingHashtags(),
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('@/components/user/RecommendedUserList', () => ({
  RecommendedUserList: ({ users }: { users: { id: string }[] }) => (
    <div data-testid="recommended-users">{users.length}</div>
  ),
}))

import ExplorePage from '@/app/(main)/explore/page'

describe('ExplorePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('トレンドタグ・ジャンル・おすすめユーザーを表示する', async () => {
    mockGetTrendingHashtags.mockResolvedValue([{ id: 'h1', name: '黒松', count: 9 }])
    mockGetTrendingGenres.mockResolvedValue({ genres: [{ id: 'g1', name: '松柏類', postCount: 5 }] })
    mockGetRecommendedUsers.mockResolvedValue({ users: [{ id: 'u1' }, { id: 'u2' }] })

    render(await ExplorePage())

    expect(screen.getByText('発見')).toBeInTheDocument()
    expect(screen.getByText('黒松')).toBeInTheDocument()
    expect(screen.getByText('松柏類')).toBeInTheDocument()
    expect(screen.getByTestId('recommended-users')).toHaveTextContent('2')
    // ハッシュタグは検索ページへリンク
    expect(screen.getByRole('link', { name: /黒松/ })).toHaveAttribute('href', expect.stringContaining('/search'))
  })

  it('データが無い場合は空メッセージを表示する', async () => {
    mockGetTrendingHashtags.mockResolvedValue([])
    mockGetTrendingGenres.mockResolvedValue({ genres: [] })
    mockGetRecommendedUsers.mockResolvedValue({ users: [] })

    render(await ExplorePage())

    expect(screen.getAllByText('トレンドデータはありません').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('おすすめユーザーはいません')).toBeInTheDocument()
  })
})
