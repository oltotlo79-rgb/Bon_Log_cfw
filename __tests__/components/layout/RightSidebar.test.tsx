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

describe('RightSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRecommendedUsers.mockResolvedValue({ users: [] })
    mockGetTrendingGenres.mockResolvedValue({ genres: [] })
  })

  it('おすすめユーザーセクションを表示する', async () => {
    const component = await RightSidebar()
    render(component)

    expect(screen.getByText('おすすめユーザー')).toBeInTheDocument()
  })

  it('トレンドジャンルセクションを表示する', async () => {
    const component = await RightSidebar()
    render(component)

    expect(screen.getByText('トレンドジャンル')).toBeInTheDocument()
  })

  it('ユーザーがいない場合メッセージを表示する', async () => {
    const component = await RightSidebar()
    render(component)

    expect(screen.getByText('おすすめユーザーはいません')).toBeInTheDocument()
  })

  it('トレンドがない場合メッセージを表示する', async () => {
    const component = await RightSidebar()
    render(component)

    expect(screen.getByText('トレンドデータはありません')).toBeInTheDocument()
  })

  it('おすすめユーザーを表示する', async () => {
    mockGetRecommendedUsers.mockResolvedValue({
      users: [
        { id: 'u1', nickname: 'テストユーザー', avatarUrl: null, followersCount: 10 },
        { id: 'u2', nickname: '盆栽太郎', avatarUrl: 'https://example.com/avatar.jpg', followersCount: 5 },
      ],
    })

    const component = await RightSidebar()
    render(component)

    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
    expect(screen.getByText('10フォロワー')).toBeInTheDocument()
    expect(screen.getByText('盆栽太郎')).toBeInTheDocument()
    expect(screen.getByText('5フォロワー')).toBeInTheDocument()
  })

  it('アバターがない場合頭文字を表示する', async () => {
    mockGetRecommendedUsers.mockResolvedValue({
      users: [
        { id: 'u1', nickname: 'テスト', avatarUrl: null, followersCount: 1 },
      ],
    })

    const component = await RightSidebar()
    render(component)

    expect(screen.getByText('テ')).toBeInTheDocument()
  })

  it('トレンドジャンルを表示する', async () => {
    mockGetTrendingGenres.mockResolvedValue({
      genres: [
        { id: 'g1', name: '松柏類', postCount: 50 },
        { id: 'g2', name: '雑木類', postCount: 30 },
      ],
    })

    const component = await RightSidebar()
    render(component)

    expect(screen.getByText('松柏類')).toBeInTheDocument()
    expect(screen.getByText('50件の投稿')).toBeInTheDocument()
    expect(screen.getByText('雑木類')).toBeInTheDocument()
    expect(screen.getByText('30件の投稿')).toBeInTheDocument()
  })

  it('フッターリンクを表示する', async () => {
    const component = await RightSidebar()
    render(component)

    expect(screen.getByText('利用規約')).toBeInTheDocument()
    expect(screen.getByText('プライバシー')).toBeInTheDocument()
    expect(screen.getByText('特商法表記')).toBeInTheDocument()
    expect(screen.getByText('ヘルプ')).toBeInTheDocument()
    expect(screen.getByText('お問い合わせ')).toBeInTheDocument()
  })

  it('もっと見るリンクを表示する', async () => {
    const component = await RightSidebar()
    render(component)

    expect(screen.getByText('もっと見る')).toBeInTheDocument()
  })

  it('広告コンポーネントを表示する', async () => {
    const component = await RightSidebar()
    render(component)

    expect(screen.getByTestId('sidebar-ad')).toBeInTheDocument()
  })

  it('季節バナーを表示する', async () => {
    const component = await RightSidebar()
    render(component)

    expect(screen.getByTestId('seasonal-banner')).toBeInTheDocument()
  })
})
