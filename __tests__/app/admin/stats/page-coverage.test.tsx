/**
 * AdminStatsPage - coverage boost
 *
 * Targets uncovered branches:
 * - Error from getStatsHistory -> redirect('/login')
 * - Error from getStatsSummary -> redirect('/login')
 * - Both error paths independently
 */

import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Track redirect calls
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

vi.mock('@/app/admin/stats/StatsChartsWrapper', () => ({
  StatsChartsWrapper: function StatsChartsStub() { return null },
}))

vi.mock('@/lib/actions/admin/stats', () => ({
  getStatsHistory: vi.fn(),
  getStatsSummary: vi.fn(),
}))

describe('AdminStatsPage - coverage boost', () => {
  let getStatsHistory: ReturnType<typeof vi.fn>
  let getStatsSummary: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/lib/actions/admin/stats')
    getStatsHistory = mod.getStatsHistory as ReturnType<typeof vi.fn>
    getStatsSummary = mod.getStatsSummary as ReturnType<typeof vi.fn>
  })

  it('redirects to /login when getStatsHistory returns error', async () => {
    getStatsHistory.mockResolvedValue({ success: false, error: 'Not authorized' })
    getStatsSummary.mockResolvedValue({
      success: true,
      data: {
        users: { total: 0, today: 0, week: 0, month: 0 },
        posts: { total: 0, today: 0, week: 0, month: 0 },
        comments: { total: 0, today: 0, week: 0, month: 0 },
      },
    })

    const { default: Page } = await import('@/app/admin/stats/page')

    await expect(Page()).rejects.toThrow('NEXT_REDIRECT:/login')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('redirects to /login when getStatsSummary returns error', async () => {
    getStatsHistory.mockResolvedValue({
      success: true,
      data: [{ date: '2024-01-01', users: 10, posts: 5, comments: 3 }],
    })
    getStatsSummary.mockResolvedValue({ success: false, error: 'Not authorized' })

    const { default: Page } = await import('@/app/admin/stats/page')

    await expect(Page()).rejects.toThrow('NEXT_REDIRECT:/login')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('redirects to /login when both return errors', async () => {
    getStatsHistory.mockResolvedValue({ success: false, error: 'Auth error' })
    getStatsSummary.mockResolvedValue({ success: false, error: 'Auth error' })

    const { default: Page } = await import('@/app/admin/stats/page')

    await expect(Page()).rejects.toThrow('NEXT_REDIRECT:/login')
    // The first check (statsHistory) triggers the redirect
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('renders successfully with valid data (verifies no redirect)', async () => {
    const mockHistory = [
      { date: '2024-01-01', users: 100, posts: 50, comments: 30 },
    ]
    const mockSummary = {
      users: { total: 100, today: 5, week: 20, month: 80 },
      posts: { total: 500, today: 10, week: 40, month: 200 },
      comments: { total: 300, today: 8, week: 30, month: 150 },
    }

    getStatsHistory.mockResolvedValue({ success: true, data: mockHistory })
    getStatsSummary.mockResolvedValue({ success: true, data: mockSummary })

    const { default: Page } = await import('@/app/admin/stats/page')
    const result = await Page()
    render(result)

    expect(mockRedirect).not.toHaveBeenCalled()
    expect(screen.getByText('統計情報')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('300')).toBeInTheDocument()
  })
})
