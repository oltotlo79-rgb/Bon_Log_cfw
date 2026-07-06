import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { RightSidebar } from '@/components/layout/RightSidebar'

const mockGetRecommendedUsers = vi.fn()
const mockGetTrendingGenres = vi.fn()

vi.mock('@/lib/actions/feed', () => ({
  getRecommendedUsers: (...args: unknown[]) => mockGetRecommendedUsers(...args),
  getTrendingGenres: (...args: unknown[]) => mockGetTrendingGenres(...args),
}))

vi.mock('@/components/ads', () => ({
  SidebarAdUnit: () => <div data-testid="sidebar-ad">Ad</div>,
}))

vi.mock('@/components/common/SeasonalBanner', () => ({
  SeasonalBanner: () => <div data-testid="seasonal-banner">Season</div>,
}))

describe('RightSidebar - 追加カバレッジテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('users / genres フィールドが無い結果でも空配列にフォールバックしクラッシュしない', async () => {
    mockGetRecommendedUsers.mockResolvedValue({})
    mockGetTrendingGenres.mockResolvedValue({})

    const component = await RightSidebar()
    render(component)

    expect(screen.getByText('おすすめユーザーはいません')).toBeInTheDocument()
    expect(screen.getByText('トレンドデータはありません')).toBeInTheDocument()
  })

  it('3件以上のトレンドジャンルでは3番目以降がデフォルトのグレー配色になる', async () => {
    mockGetRecommendedUsers.mockResolvedValue({ users: [] })
    mockGetTrendingGenres.mockResolvedValue({
      genres: [
        { id: 'g1', name: '松柏類', postCount: 50 },
        { id: 'g2', name: '雑木類', postCount: 30 },
        { id: 'g3', name: '草もの', postCount: 10 },
      ],
    })

    const component = await RightSidebar()
    const { container } = render(component)

    expect(screen.getByText('草もの')).toBeInTheDocument()
    const rankBadges = container.querySelectorAll('.w-5.h-5.rounded-full')
    expect(rankBadges).toHaveLength(3)
    expect(rankBadges[2]).toHaveClass('bg-muted', 'text-muted-foreground')
    expect(rankBadges[0]).toHaveClass('bg-primary/15', 'text-primary')
    expect(rankBadges[1]).toHaveClass('bg-accent/10', 'text-accent')
  })
})
