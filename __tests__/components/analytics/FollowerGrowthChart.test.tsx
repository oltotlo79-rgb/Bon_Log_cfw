import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { FollowerGrowthChart } from '@/components/analytics/FollowerGrowthChart'

// lucide-react モック
vi.mock('lucide-react', () => ({
  TrendingUp: ({ className }: { className?: string }) => (
    <span data-testid="trending-up" className={className} />
  ),
  TrendingDown: ({ className }: { className?: string }) => (
    <span data-testid="trending-down" className={className} />
  ),
  Users: ({ className }: { className?: string }) => (
    <span data-testid="users-icon" className={className} />
  ),
}))

describe('FollowerGrowthChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockGrowth = [
    { date: '2024-01-01', newFollowers: 5, totalFollowers: 100 },
    { date: '2024-01-02', newFollowers: 3, totalFollowers: 103 },
    { date: '2024-01-03', newFollowers: 7, totalFollowers: 110 },
  ]

  it('フォロワー数を表示する', () => {
    render(
      <FollowerGrowthChart
        currentFollowers={110}
        totalNewInPeriod={15}
        growth={mockGrowth}
      />
    )

    expect(screen.getByText('110')).toBeInTheDocument()
    expect(screen.getByText('フォロワー')).toBeInTheDocument()
  })

  it('期間内の増加数を表示する', () => {
    render(
      <FollowerGrowthChart
        currentFollowers={110}
        totalNewInPeriod={15}
        growth={mockGrowth}
      />
    )

    expect(screen.getByText('+15')).toBeInTheDocument()
    expect(screen.getByText('期間内')).toBeInTheDocument()
    expect(screen.getByTestId('trending-up')).toBeInTheDocument()
  })

  it('増加数が負の場合はTrendingDownアイコンを表示する', () => {
    render(
      <FollowerGrowthChart
        currentFollowers={90}
        totalNewInPeriod={-5}
        growth={mockGrowth}
      />
    )

    expect(screen.getByTestId('trending-down')).toBeInTheDocument()
  })

  it('データが空の場合はメッセージを表示する', () => {
    render(
      <FollowerGrowthChart
        currentFollowers={0}
        totalNewInPeriod={0}
        growth={[]}
      />
    )

    expect(screen.getByText('データがありません')).toBeInTheDocument()
  })

  it('SVGチャートを表示する', () => {
    const { container } = render(
      <FollowerGrowthChart
        currentFollowers={110}
        totalNewInPeriod={15}
        growth={mockGrowth}
      />
    )

    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})
