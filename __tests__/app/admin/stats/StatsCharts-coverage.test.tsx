/**
 * StatsCharts - coverage boost
 *
 * Targets uncovered branches:
 * - Single metric rendering for each chart type (line/area/bar)
 * - Metric name labels: users='ユーザー数', posts='投稿数', comments='コメント数'
 * - Combined switching: change metric THEN change chart type
 * - Period '14' selection
 */

import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: ({ name, dataKey }: { name: string; dataKey: string }) => <div data-testid={`line-${dataKey}`}>{name}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: ({ name, dataKey }: { name: string; dataKey: string }) => <div data-testid={`area-${dataKey}`}>{name}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ name, dataKey }: { name: string; dataKey: string }) => <div data-testid={`bar-${dataKey}`}>{name}</div>,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}))

const mockData = Array.from({ length: 30 }, (_, i) => ({
  date: `2024-01-${String(i + 1).padStart(2, '0')}`,
  users: 100 + i,
  posts: 50 + i,
  comments: 30 + i,
}))

describe('StatsCharts - coverage boost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders single users metric in line chart', async () => {
    const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')
    render(<StatsCharts data={mockData} />)

    // Switch to users metric
    fireEvent.change(screen.getByDisplayValue('すべて'), { target: { value: 'users' } })
    // Switch to line chart
    fireEvent.click(screen.getByRole('button', { name: 'ライン' }))

    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.getByTestId('line-users')).toHaveTextContent('ユーザー数')
    // Should not have posts or comments lines
    expect(screen.queryByTestId('line-posts')).not.toBeInTheDocument()
    expect(screen.queryByTestId('line-comments')).not.toBeInTheDocument()
  })

  it('renders single posts metric in area chart', async () => {
    const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')
    render(<StatsCharts data={mockData} />)

    // Switch to posts metric
    fireEvent.change(screen.getByDisplayValue('すべて'), { target: { value: 'posts' } })
    // Default is area chart

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    expect(screen.getByTestId('area-posts')).toHaveTextContent('投稿数')
    expect(screen.queryByTestId('area-users')).not.toBeInTheDocument()
  })

  it('renders single comments metric in bar chart', async () => {
    const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')
    render(<StatsCharts data={mockData} />)

    // Switch to comments metric
    fireEvent.change(screen.getByDisplayValue('すべて'), { target: { value: 'comments' } })
    // Switch to bar chart
    fireEvent.click(screen.getByRole('button', { name: 'バー' }))

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    expect(screen.getByTestId('bar-comments')).toHaveTextContent('コメント数')
    expect(screen.queryByTestId('bar-users')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bar-posts')).not.toBeInTheDocument()
  })

  it('renders all metrics in bar chart', async () => {
    const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')
    render(<StatsCharts data={mockData} />)

    // Switch to bar chart with all metrics
    fireEvent.click(screen.getByRole('button', { name: 'バー' }))

    expect(screen.getByTestId('bar-users')).toHaveTextContent('ユーザー数')
    expect(screen.getByTestId('bar-posts')).toHaveTextContent('投稿数')
    expect(screen.getByTestId('bar-comments')).toHaveTextContent('コメント数')
  })

  it('renders all metrics in line chart', async () => {
    const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')
    render(<StatsCharts data={mockData} />)

    fireEvent.click(screen.getByRole('button', { name: 'ライン' }))

    expect(screen.getByTestId('line-users')).toHaveTextContent('ユーザー数')
    expect(screen.getByTestId('line-posts')).toHaveTextContent('投稿数')
    expect(screen.getByTestId('line-comments')).toHaveTextContent('コメント数')
  })

  it('filters data to 14-day period', async () => {
    const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')
    render(<StatsCharts data={mockData} />)

    const periodSelect = screen.getByDisplayValue('30日間')
    fireEvent.change(periodSelect, { target: { value: '14' } })

    expect(periodSelect).toHaveValue('14')
    // Chart should still render
    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })

  it('renders single users metric in bar chart with correct name', async () => {
    const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')
    render(<StatsCharts data={mockData} />)

    fireEvent.change(screen.getByDisplayValue('すべて'), { target: { value: 'users' } })
    fireEvent.click(screen.getByRole('button', { name: 'バー' }))

    expect(screen.getByTestId('bar-users')).toHaveTextContent('ユーザー数')
  })

  it('renders single posts metric in line chart', async () => {
    const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')
    render(<StatsCharts data={mockData} />)

    fireEvent.change(screen.getByDisplayValue('すべて'), { target: { value: 'posts' } })
    fireEvent.click(screen.getByRole('button', { name: 'ライン' }))

    expect(screen.getByTestId('line-posts')).toHaveTextContent('投稿数')
  })

  it('renders single comments metric in area chart', async () => {
    const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')
    render(<StatsCharts data={mockData} />)

    fireEvent.change(screen.getByDisplayValue('すべて'), { target: { value: 'comments' } })

    expect(screen.getByTestId('area-comments')).toHaveTextContent('コメント数')
  })
})
