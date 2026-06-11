import { vi, type Mocked } from 'vitest'
import { render, screen } from '@testing-library/react'
import type * as StatsActions from '@/lib/actions/admin/stats'

// StatsChartsWrapper は内部で next/dynamic (ssr: false) を使うためスタブ化
vi.mock('@/app/admin/stats/StatsChartsWrapper', () => ({
  StatsChartsWrapper: function StatsChartsStub() { return null },
}))

vi.mock('@/lib/actions/admin/stats', () => ({
  getStatsHistory: vi.fn(),
  getStatsSummary: vi.fn(),
}))

describe('AdminStatsPage', async () => {
  const statsModule = await import('@/lib/actions/admin/stats') as unknown as Mocked<typeof StatsActions>
  const { getStatsHistory, getStatsSummary } = statsModule

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('統計サマリーとグラフを表示', async () => {
    const mockHistory = [
      { date: '2024-01-01', users: 100, posts: 50, comments: 30 },
      { date: '2024-01-02', users: 105, posts: 55, comments: 35 },
    ]

    const mockSummary = {
      users: { total: 1000, today: 10, week: 50, month: 200 },
      posts: { total: 5000, today: 20, week: 100, month: 500 },
      comments: { total: 3000, today: 15, week: 80, month: 300 },
    }


    getStatsHistory.mockResolvedValue({ success: true, data: mockHistory } as any)

    getStatsSummary.mockResolvedValue({ success: true, data: mockSummary } as any)

    const { default: Page } = await import('@/app/admin/stats/page')
    const result = await Page()
    render(result)

    // タイトル
    expect(screen.getByText('統計情報')).toBeInTheDocument()

    // ユーザーカード
    expect(screen.getByText('ユーザー')).toBeInTheDocument()
    expect(screen.getByText('1,000')).toBeInTheDocument()
    expect(screen.getByText('+10')).toBeInTheDocument()
    expect(screen.getByText('+50')).toBeInTheDocument()
    expect(screen.getByText('+200')).toBeInTheDocument()

    // 投稿カード
    expect(screen.getByText('投稿')).toBeInTheDocument()
    expect(screen.getByText('5,000')).toBeInTheDocument()
    expect(screen.getByText('+20')).toBeInTheDocument()
    expect(screen.getByText('+100')).toBeInTheDocument()
    expect(screen.getByText('+500')).toBeInTheDocument()

    // コメントカード
    expect(screen.getByText('コメント')).toBeInTheDocument()
    expect(screen.getByText('3,000')).toBeInTheDocument()
    expect(screen.getByText('+15')).toBeInTheDocument()
    expect(screen.getByText('+80')).toBeInTheDocument()
    expect(screen.getByText('+300')).toBeInTheDocument()

    // StatsCharts は next/dynamic (ssr: false) で読み込まれるため
    // JSDOM テスト環境ではレンダリングされない（別途コンポーネントテストで検証）
  })
})
