import { render, screen } from '@testing-library/react'
import { StatsChartsWrapper } from '@/app/admin/stats/StatsChartsWrapper'

vi.mock('next/dynamic', () => ({
  default: (_loader: unknown, _opts: { loading?: () => React.ReactNode }) => {
    return function MockStatsCharts({ data }: { data: unknown[] }) {
      return (
        <div data-testid="stats-charts">
          <span>StatsCharts</span>
          <span data-testid="data-length">{data.length}</span>
        </div>
      )
    }
  },
}))

describe('StatsChartsWrapper', () => {
  it('renders with data and passes data to StatsCharts', async () => {
    const data = [
      { date: '2025-01-01', users: 10, posts: 20, comments: 30 },
      { date: '2025-01-02', users: 11, posts: 22, comments: 33 },
    ]
    render(<StatsChartsWrapper data={data} />)

    expect(screen.getByTestId('stats-charts')).toBeInTheDocument()
    expect(screen.getByText('StatsCharts')).toBeInTheDocument()
    expect(screen.getByTestId('data-length')).toHaveTextContent('2')
  })

  it('renders with empty data', () => {
    render(<StatsChartsWrapper data={[]} />)
    expect(screen.getByTestId('data-length')).toHaveTextContent('0')
  })
})
