import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams('days=30')
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

import { PeriodFilter } from '@/components/analytics/PeriodFilter'

describe('PeriodFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders 3 period buttons', () => {
    render(<PeriodFilter />)
    expect(screen.getByText('7日')).toBeInTheDocument()
    expect(screen.getByText('30日')).toBeInTheDocument()
    expect(screen.getByText('90日')).toBeInTheDocument()
  })

  it('applies active style to the selected period (default 30)', () => {
    render(<PeriodFilter />)
    const activeButton = screen.getByText('30日')
    expect(activeButton.className).toContain('bg-background')
    expect(activeButton.className).toContain('font-medium')
  })

  it('applies inactive style to non-selected periods', () => {
    render(<PeriodFilter />)
    const inactiveButton = screen.getByText('7日')
    expect(inactiveButton.className).toContain('text-muted-foreground')
    expect(inactiveButton.className).not.toContain('font-medium')
  })

  it('calls router.push with updated days param on click', () => {
    render(<PeriodFilter />)
    fireEvent.click(screen.getByText('7日'))
    expect(mockPush).toHaveBeenCalledWith('/analytics?days=7')
  })

  it('calls router.push with 90 days param', () => {
    render(<PeriodFilter />)
    fireEvent.click(screen.getByText('90日'))
    expect(mockPush).toHaveBeenCalledWith('/analytics?days=90')
  })
})
