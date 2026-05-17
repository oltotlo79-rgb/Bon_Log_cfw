import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// rechartsを完全にモック
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: ({ name }: any) => <div data-testid="line">{name}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: ({ name }: any) => <div data-testid="area">{name}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ name }: any) => <div data-testid="bar">{name}</div>,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}))

describe('StatsCharts', async () => {
  const mockData = [
    { date: '2024-01-01', users: 100, posts: 50, comments: 30 },
    { date: '2024-01-02', users: 105, posts: 55, comments: 35 },
    { date: '2024-01-03', users: 110, posts: 60, comments: 40 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('デフォルトでエリアチャートを表示', async () => {
    const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')
    render(<StatsCharts data={mockData} />)

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument()
  })

  it('期間選択が動作', async () => {
    const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')
    const longData = Array.from({ length: 30 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      users: 100 + i,
      posts: 50 + i,
      comments: 30 + i,
    }))

    render(<StatsCharts data={longData} />)

    const periodSelect = screen.getByDisplayValue('30日間')
    fireEvent.change(periodSelect, { target: { value: '7' } })

    expect(periodSelect).toHaveValue('7')
  })

  it('グラフタイプ切り替えが動作', async () => {
    const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')
    render(<StatsCharts data={mockData} />)

    // ラインに切り替え
    const lineButton = screen.getByRole('button', { name: 'ライン' })
    fireEvent.click(lineButton)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()

    // バーに切り替え
    const barButton = screen.getByRole('button', { name: 'バー' })
    fireEvent.click(barButton)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()

    // エリアに戻す
    const areaButton = screen.getByRole('button', { name: 'エリア' })
    fireEvent.click(areaButton)
    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })

  it('指標選択が動作', async () => {
    const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')
    render(<StatsCharts data={mockData} />)

    const metricSelect = screen.getByDisplayValue('すべて')

    // ユーザー数のみに切り替え
    fireEvent.change(metricSelect, { target: { value: 'users' } })
    expect(metricSelect).toHaveValue('users')

    // 投稿数のみに切り替え
    fireEvent.change(metricSelect, { target: { value: 'posts' } })
    expect(metricSelect).toHaveValue('posts')

    // コメント数のみに切り替え
    fireEvent.change(metricSelect, { target: { value: 'comments' } })
    expect(metricSelect).toHaveValue('comments')
  })

  it('空データでもレンダリング', async () => {
    const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')
    render(<StatsCharts data={[]} />)

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })
})
