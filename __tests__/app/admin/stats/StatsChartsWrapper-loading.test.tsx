/**
 * StatsChartsWrapper - loading fallback coverage
 *
 * Tests the loading function passed to next/dynamic (line 16-19 of StatsChartsWrapper.tsx)
 * which renders a skeleton while the chart component loads.
 */
import { vi } from 'vitest'
import { render } from '@testing-library/react'

// Capture the loading component from the dynamic() call
let capturedLoading: (() => React.ReactNode) | undefined

vi.mock('next/dynamic', () => ({
  default: (_loader: unknown, opts: { loading?: () => React.ReactNode }) => {
    capturedLoading = opts?.loading
    return function MockStatsCharts() {
      return <div data-testid="stats-charts-mock" />
    }
  },
}))

describe('StatsChartsWrapper loading fallback', () => {
  it('renders loading skeleton from the dynamic import config', async () => {
    // Import the module to trigger the dynamic() call and capture loading
    await import('@/app/admin/stats/StatsChartsWrapper')

    expect(capturedLoading).toBeDefined()

    // Render the loading component
    const LoadingComponent = capturedLoading!
    const { container } = render(<>{LoadingComponent()}</>)

    // The loading component should render a skeleton card with animation
    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton).not.toBeNull()

    // Should have the proper height for the chart placeholder
    const chartPlaceholder = container.querySelector('.h-\\[400px\\]')
    expect(chartPlaceholder).not.toBeNull()
  })
})
