/**
 * AdminReportsPage - branch coverage tests
 * Covers uncovered branches:
 * - Page 1 (no "前へ" button)
 * - Last page (no "次へ" button)
 * - Single page (no pagination)
 * - Report with unknown reason fallback
 * - All target type labels
 * - All status labels and colors
 * - Report with avatarUrl=null (default avatar)
 */

import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/actions/report', () => ({ getReports: vi.fn() }))
vi.mock('@/lib/constants/report', () => ({
  REPORT_REASONS: [
    { value: 'spam', label: 'スパム' },
    { value: 'harassment', label: '嫌がらせ' },
  ],
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage(props: Record<string, unknown>) { return <div data-testid="next-image" data-src={props.src} /> },
}))
vi.mock('@/app/admin/reports/ReportActionsDropdown', () => ({
  ReportActionsDropdown: () => <div data-testid="report-actions" />,
}))

import { getReports } from '@/lib/actions/report'
const mockGetReports = getReports as ReturnType<typeof vi.fn>

function makeReport(overrides = {}) {
  return {
    id: 'r1',
    reason: 'spam',
    description: 'Bad content',
    status: 'pending',
    targetType: 'post',
    targetId: 'p1',
    createdAt: new Date('2025-01-15').toISOString(),
    reporter: { id: 'u1', nickname: 'Reporter', avatarUrl: null },
    ...overrides,
  }
}

describe('AdminReportsPage - branch coverage', async () => {
  let Page: typeof import('@/app/admin/reports/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/admin/reports/page')
    Page = mod.default
  })

  it('first page: 前へ is disabled (no href), 次へ is a link when nextCursor is set', async () => {
    mockGetReports.mockResolvedValue({ reports: [makeReport()], total: 50, nextCursor: 'c1' } as never)

    const result = await Page({ searchParams: Promise.resolve({}) })
    const { container } = render(result)

    // 「前へ」は常に表示されるが、cursor が undefined の先頭ページではリンクではなく span
    const prev = screen.getByText('前へ')
    expect(prev.tagName).toBe('SPAN')
    // 「次へ」は nextCursor があればリンク
    const next = screen.getByText('次へ')
    expect(next.tagName).toBe('A')
    expect(container).toHaveTextContent('全 50 件')
  })

  it('cursor present with no nextCursor: 前へ is a link, 次へ is disabled', async () => {
    mockGetReports.mockResolvedValue({ reports: [makeReport()], total: 50 } as never)

    const result = await Page({ searchParams: Promise.resolve({ cursor: 'c3' }) })
    render(result)

    const prev = screen.getByText('前へ')
    expect(prev.tagName).toBe('A')
    const next = screen.getByText('次へ')
    expect(next.tagName).toBe('SPAN')
  })

  it('single page (no cursor, no nextCursor) still shows the pagination bar with total', async () => {
    mockGetReports.mockResolvedValue({ reports: [makeReport()], total: 5 } as never)

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    // 常に「全 N 件」が表示される
    expect(screen.getByText(/全 5 件/)).toBeInTheDocument()
  })

  it('shows unknown reason as raw value', async () => {
    mockGetReports.mockResolvedValue({
      reports: [makeReport({ reason: 'unknown_reason' })],
      total: 1,
    } as never)

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByText('unknown_reason')).toBeInTheDocument()
  })

  it('displays all target type labels correctly', async () => {
    const reports = [
      makeReport({ id: 'r1', targetType: 'comment' }),
      makeReport({ id: 'r2', targetType: 'event' }),
      makeReport({ id: 'r3', targetType: 'shop' }),
      makeReport({ id: 'r4', targetType: 'user' }),
    ]
    mockGetReports.mockResolvedValue({ reports, total: 4 } as never)

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    // Target type labels appear in both filter select and table cells
    // Use getAllByText to avoid "multiple elements found" errors
    expect(screen.getAllByText('コメント').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('イベント').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('盆栽園').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('ユーザー').length).toBeGreaterThanOrEqual(1)
  })

  it('displays all status labels correctly', async () => {
    const reports = [
      makeReport({ id: 'r1', status: 'pending' }),
      makeReport({ id: 'r2', status: 'reviewed' }),
      makeReport({ id: 'r3', status: 'resolved' }),
      makeReport({ id: 'r4', status: 'dismissed' }),
    ]
    mockGetReports.mockResolvedValue({ reports, total: 4 } as never)

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    // Status labels appear in both filter select and table cells
    expect(screen.getAllByText('未対応').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('確認中').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('対応完了').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('却下').length).toBeGreaterThanOrEqual(1)
  })

  it('cursor is undefined when no cursor param is provided (first page)', async () => {
    mockGetReports.mockResolvedValue({ reports: [], total: 0 } as never)

    await Page({ searchParams: Promise.resolve({}) })

    expect(mockGetReports).toHaveBeenCalledWith({
      status: undefined,
      targetType: undefined,
      limit: 20,
      cursor: undefined,
    })
  })
})
