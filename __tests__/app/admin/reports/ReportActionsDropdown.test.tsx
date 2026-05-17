/**
 * ReportActionsDropdown - branch coverage tests
 * Covers uncovered branches:
 * - Menu positioning: openUpward when not enough space below
 * - Status buttons visibility based on currentStatus
 * - handleStatusUpdate error path
 * - handleDelete error path
 * - handleDeleteReport error path
 * - Delete confirm: user type label for 'user' (アカウントを停止)
 * - getTargetLink for different targetTypes
 * - Target link click closes menu
 * - Cancel delete confirm
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReportActionsDropdown } from '@/app/admin/reports/ReportActionsDropdown'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mockUpdateReportStatus = vi.fn()
const mockDeleteReportedContent = vi.fn()
const mockDeleteReport = vi.fn()
vi.mock('@/lib/actions/report', () => ({
  updateReportStatus: (...args: unknown[]) => mockUpdateReportStatus(...args),
  deleteReportedContent: (...args: unknown[]) => mockDeleteReportedContent(...args),
  deleteReport: (...args: unknown[]) => mockDeleteReport(...args),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, onClick, ...props }: { children: React.ReactNode; href: string; onClick?: () => void; [key: string]: unknown }) => (
    <a href={href} onClick={onClick} {...props}>{children}</a>
  ),
}))

describe('ReportActionsDropdown - branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateReportStatus.mockResolvedValue({ success: true })
    mockDeleteReportedContent.mockResolvedValue({ success: true })
    mockDeleteReport.mockResolvedValue({ success: true })
  })

  it('shows correct status buttons for pending status', () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />
    )
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('確認中にする')).toBeInTheDocument()
    expect(screen.getByText('対応完了にする')).toBeInTheDocument()
    expect(screen.getByText('却下する')).toBeInTheDocument()
    expect(screen.queryByText('未対応に戻す')).not.toBeInTheDocument()
  })

  it('shows correct status buttons for reviewed status', () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="reviewed" targetType="post" targetId="p1" />
    )
    fireEvent.click(screen.getByRole('button'))

    expect(screen.queryByText('確認中にする')).not.toBeInTheDocument()
    expect(screen.getByText('対応完了にする')).toBeInTheDocument()
    expect(screen.getByText('却下する')).toBeInTheDocument()
    expect(screen.getByText('未対応に戻す')).toBeInTheDocument()
  })

  it('shows correct status buttons for resolved status', () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="resolved" targetType="post" targetId="p1" />
    )
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('確認中にする')).toBeInTheDocument()
    expect(screen.queryByText('対応完了にする')).not.toBeInTheDocument()
    expect(screen.getByText('却下する')).toBeInTheDocument()
    expect(screen.getByText('未対応に戻す')).toBeInTheDocument()
  })

  it('shows correct status buttons for dismissed status', () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="dismissed" targetType="post" targetId="p1" />
    )
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('確認中にする')).toBeInTheDocument()
    expect(screen.getByText('対応完了にする')).toBeInTheDocument()
    expect(screen.queryByText('却下する')).not.toBeInTheDocument()
    expect(screen.getByText('未対応に戻す')).toBeInTheDocument()
  })

  it('status update calls updateReportStatus and refreshes', async () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('確認中にする'))

    await waitFor(() => {
      expect(mockUpdateReportStatus).toHaveBeenCalledWith('r1', 'reviewed')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('status update error shows toast', async () => {
    mockUpdateReportStatus.mockResolvedValue({ success: false, error: 'ステータス更新失敗' })
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('確認中にする'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: 'ステータス更新失敗', variant: 'destructive' })
    })
  })

  it('delete button for post shows 投稿を削除', () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />
    )
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('投稿を削除')).toBeInTheDocument()
  })

  it('delete button for user shows アカウントを停止', () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="user" targetId="u1" />
    )
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('アカウントを停止')).toBeInTheDocument()
  })

  it('delete confirm and execute for user shows 停止 button', async () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="user" targetId="u1" />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('アカウントを停止'))

    expect(screen.getByText(/ユーザーを停止しますか/)).toBeInTheDocument()
    expect(screen.getByText('停止')).toBeInTheDocument()

    fireEvent.click(screen.getByText('停止'))

    await waitFor(() => {
      expect(mockDeleteReportedContent).toHaveBeenCalledWith('user', 'u1')
    })
  })

  it('delete confirm and cancel closes confirm', () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('投稿を削除'))

    expect(screen.getByText(/投稿を削除しますか/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('キャンセル'))

    expect(screen.queryByText(/投稿を削除しますか/)).not.toBeInTheDocument()
  })

  it('delete error shows toast', async () => {
    mockDeleteReportedContent.mockResolvedValue({ success: false, error: '削除失敗' })
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('投稿を削除'))
    fireEvent.click(screen.getByText('削除'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: '削除失敗', variant: 'destructive' })
    })
  })

  it('deleteReport calls deleteReport action and refreshes', async () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('通報を削除（レコードのみ）'))

    await waitFor(() => {
      expect(mockDeleteReport).toHaveBeenCalledWith('r1')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('deleteReport error shows toast', async () => {
    mockDeleteReport.mockResolvedValue({ success: false, error: '通報削除失敗' })
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('通報を削除（レコードのみ）'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: '通報削除失敗', variant: 'destructive' })
    })
  })

  it('getTargetLink for event type', () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="event" targetId="e1" />
    )
    fireEvent.click(screen.getByRole('button'))

    const link = screen.getByText('対象を確認')
    expect(link).toHaveAttribute('href', '/events/e1')
  })

  it('getTargetLink for shop type', () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="shop" targetId="s1" />
    )
    fireEvent.click(screen.getByRole('button'))

    const link = screen.getByText('対象を確認')
    expect(link).toHaveAttribute('href', '/shops/s1')
  })

  it('getTargetLink for user type', () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="user" targetId="u1" />
    )
    fireEvent.click(screen.getByRole('button'))

    const link = screen.getByText('対象を確認')
    expect(link).toHaveAttribute('href', '/users/u1')
  })

  it('getTargetLink returns null for comment type (no link)', () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="comment" targetId="c1" />
    )
    fireEvent.click(screen.getByRole('button'))

    expect(screen.queryByText('対象を確認')).not.toBeInTheDocument()
  })

  it('overlay click closes menu', () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />
    )
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('確認中にする')).toBeInTheDocument()

    // Click the overlay
    const overlay = document.querySelector('.fixed.inset-0.z-\\[100\\]') as HTMLElement
    fireEvent.click(overlay)

    expect(screen.queryByText('確認中にする')).not.toBeInTheDocument()
  })

  it('delete confirm for event shows イベントを削除', () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="event" targetId="e1" />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('イベントを削除')).toBeInTheDocument()
  })

  it('delete confirm for shop shows 盆栽園を削除', () => {
    render(
      <ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="shop" targetId="s1" />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('盆栽園を削除')).toBeInTheDocument()
  })
})
