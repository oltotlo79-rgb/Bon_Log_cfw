import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/actions/report', () => ({ getReports: vi.fn() }))
vi.mock('@/lib/constants/report', () => ({
  REPORT_REASONS: [
    { value: 'spam', label: 'スパム' },
    { value: 'harassment', label: '嫌がらせ' },
  ],
  TARGET_TYPE_LABELS: {
    post: '投稿',
    comment: 'コメント',
    event: 'イベント',
    shop: '盆栽園',
    review: 'レビュー',
    user: 'ユーザー',
  },
}))
vi.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('next/image', () => ({ __esModule: true, default: function MockImage(_props: Record<string, unknown>) { return <div data-testid="next-image" /> } }))
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

describe('AdminReportsPage', async () => {
  let Page: typeof import('@/app/admin/reports/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/admin/reports/page')
    Page = mod.default
  })

  it('renders reports table', async () => {
    mockGetReports.mockResolvedValue({ reports: [makeReport()], total: 1 } as never)

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByText('通報管理')).toBeInTheDocument()
    expect(screen.getByText('全 1 件')).toBeInTheDocument()
    expect(screen.getByText('Reporter')).toBeInTheDocument()
    expect(screen.getByText('スパム')).toBeInTheDocument()
    expect(screen.getByText('Bad content')).toBeInTheDocument()
    // "投稿" appears both in filter and table cell
    const badges = screen.getAllByText('投稿')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows error message', async () => {
    mockGetReports.mockResolvedValue({ error: '権限がありません' } as never)

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByText('権限がありません')).toBeInTheDocument()
  })

  it('shows empty message when no reports', async () => {
    mockGetReports.mockResolvedValue({ reports: [], total: 0 } as never)

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByText('通報が見つかりません')).toBeInTheDocument()
  })

  it('passes filter params to getReports', async () => {
    mockGetReports.mockResolvedValue({ reports: [], total: 0 } as never)

    await Page({ searchParams: Promise.resolve({ status: 'pending', targetType: 'post', cursor: 'abc' }) })

    expect(mockGetReports).toHaveBeenCalledWith({
      status: 'pending',
      targetType: 'post',
      limit: 20,
      cursor: 'abc',
    })
  })

  it('renders cursor pagination with next link when nextCursor is set', async () => {
    mockGetReports.mockResolvedValue({ reports: [makeReport()], total: 50, nextCursor: 'next-id' } as never)

    const result = await Page({ searchParams: Promise.resolve({ cursor: 'current-id' }) })
    render(result)

    expect(screen.getByText('前へ')).toBeInTheDocument()
    expect(screen.getByText('次へ')).toBeInTheDocument()
    expect(screen.getByText(/全 50 件/)).toBeInTheDocument()
  })

  it('shows reporter avatar when present', async () => {
    mockGetReports.mockResolvedValue({
      reports: [makeReport({ reporter: { id: 'u1', nickname: 'R', avatarUrl: '/avatar.jpg' } })],
      total: 1,
    } as never)

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByTestId('next-image')).toBeInTheDocument()
  })

  it('shows dash for report without description', async () => {
    mockGetReports.mockResolvedValue({
      reports: [makeReport({ description: null })],
      total: 1,
    } as never)

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByText('-')).toBeInTheDocument()
  })
})
