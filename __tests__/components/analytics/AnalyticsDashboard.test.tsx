import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'

// Mock child components
vi.mock('@/components/analytics/LikeChart', () => ({
  LikeChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="like-chart">LikeChart ({data.length} items)</div>
  ),
}))

vi.mock('@/components/analytics/TimeHeatmap', () => ({
  TimeHeatmap: () => <div data-testid="time-heatmap">TimeHeatmap</div>,
}))

vi.mock('@/components/analytics/KeywordCloud', () => ({
  KeywordCloud: () => <div data-testid="keyword-cloud">KeywordCloud</div>,
}))

vi.mock('@/components/analytics/QuoteList', () => ({
  QuoteList: () => <div data-testid="quote-list">QuoteList</div>,
}))

const basePostAnalytics = {
  totalPosts: 42,
  totalLikes: 150,
  totalComments: 30,
  avgEngagement: 4.3,
  topPosts: [],
  posts: [],
}

const baseLikeAnalytics = {
  totalLikes: 150,
  hourlyData: Array(24).fill(0),
  weekdayData: Array(7).fill(0),
  dailyData: [],
  peakHour: 14,
  peakWeekday: 3,
}

const baseQuoteAnalytics = {
  totalQuotes: 5,
  totalReposts: 3,
  quotes: [],
}

const baseKeywordAnalytics = {
  keywords: [{ word: '盆栽', count: 10 }],
  totalWords: 100,
  uniqueWords: 50,
}

const baseEngagementTrend = {
  trend: [
    { date: '2024-01-01', posts: 2, likes: 10, comments: 3, engagement: 6.5 },
  ],
}

describe('AnalyticsDashboard', () => {
  it('統計カードを表示する', () => {
    render(
      <AnalyticsDashboard
        postAnalytics={basePostAnalytics}
        likeAnalytics={null}
        quoteAnalytics={null}
        keywordAnalytics={null}
        engagementTrend={null}
      />
    )

    expect(screen.getByText('投稿数')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('いいね')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('コメント')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('平均エンゲージメント')).toBeInTheDocument()
    expect(screen.getByText('4.3')).toBeInTheDocument()
  })

  it('全てnullの場合デフォルト値を表示する', () => {
    render(
      <AnalyticsDashboard
        postAnalytics={null}
        likeAnalytics={null}
        quoteAnalytics={null}
        keywordAnalytics={null}
        engagementTrend={null}
      />
    )

    expect(screen.getByText('投稿数')).toBeInTheDocument()
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(3)
  })

  it('engagementTrendがある場合チャートを表示する', () => {
    render(
      <AnalyticsDashboard
        postAnalytics={null}
        likeAnalytics={null}
        quoteAnalytics={null}
        keywordAnalytics={null}
        engagementTrend={baseEngagementTrend}
      />
    )

    expect(screen.getByText('エンゲージメント推移')).toBeInTheDocument()
    expect(screen.getByTestId('like-chart')).toBeInTheDocument()
  })

  it('engagementTrendがnullの場合チャートを表示しない', () => {
    render(
      <AnalyticsDashboard
        postAnalytics={null}
        likeAnalytics={null}
        quoteAnalytics={null}
        keywordAnalytics={null}
        engagementTrend={null}
      />
    )

    expect(screen.queryByText('エンゲージメント推移')).not.toBeInTheDocument()
  })

  it('likeAnalyticsがある場合ヒートマップを表示する', () => {
    render(
      <AnalyticsDashboard
        postAnalytics={null}
        likeAnalytics={baseLikeAnalytics}
        quoteAnalytics={null}
        keywordAnalytics={null}
        engagementTrend={null}
      />
    )

    expect(screen.getByText('時間帯別いいね')).toBeInTheDocument()
    expect(screen.getByTestId('time-heatmap')).toBeInTheDocument()
  })

  it('likeAnalyticsがnullの場合ヒートマップを表示しない', () => {
    render(
      <AnalyticsDashboard
        postAnalytics={null}
        likeAnalytics={null}
        quoteAnalytics={null}
        keywordAnalytics={null}
        engagementTrend={null}
      />
    )

    expect(screen.queryByText('時間帯別いいね')).not.toBeInTheDocument()
  })

  it('keywordAnalyticsがある場合キーワードクラウドを表示する', () => {
    render(
      <AnalyticsDashboard
        postAnalytics={null}
        likeAnalytics={null}
        quoteAnalytics={null}
        keywordAnalytics={baseKeywordAnalytics}
        engagementTrend={null}
      />
    )

    expect(screen.getByText('よく使うキーワード')).toBeInTheDocument()
    expect(screen.getByTestId('keyword-cloud')).toBeInTheDocument()
  })

  it('quoteAnalyticsがある場合引用投稿一覧を表示する', () => {
    render(
      <AnalyticsDashboard
        postAnalytics={null}
        likeAnalytics={null}
        quoteAnalytics={baseQuoteAnalytics}
        keywordAnalytics={null}
        engagementTrend={null}
      />
    )

    expect(screen.getByText('引用された投稿 (5)')).toBeInTheDocument()
    expect(screen.getByTestId('quote-list')).toBeInTheDocument()
  })

  it('全てのデータがある場合全セクションを表示する', () => {
    render(
      <AnalyticsDashboard
        postAnalytics={basePostAnalytics}
        likeAnalytics={baseLikeAnalytics}
        quoteAnalytics={baseQuoteAnalytics}
        keywordAnalytics={baseKeywordAnalytics}
        engagementTrend={baseEngagementTrend}
      />
    )

    expect(screen.getByText('エンゲージメント推移')).toBeInTheDocument()
    expect(screen.getByText('時間帯別いいね')).toBeInTheDocument()
    expect(screen.getByText('よく使うキーワード')).toBeInTheDocument()
    expect(screen.getByText('引用された投稿 (5)')).toBeInTheDocument()
  })
})
