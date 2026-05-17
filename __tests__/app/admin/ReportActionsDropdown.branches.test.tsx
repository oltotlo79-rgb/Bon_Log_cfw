/**
 * ReportActionsDropdown - branch coverage tests
 *
 * Targets:
 * - targetType 'comment' has no target link (default case returns null)
 * - targetType 'user' shows 'アカウントを停止' button
 * - currentStatus = 'reviewed' hides 確認中にする
 * - currentStatus = 'resolved' hides 対応完了にする
 * - currentStatus = 'dismissed' hides 却下する
 * - deleteReportedContent error shows toast
 * - deleteReport error shows toast
 * - openUpward menu positioning (spaceBelow < threshold)
 * - Clicking overlay closes menu
 * - showDeleteConfirm cancel button
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { ReportActionsDropdown } from '@/app/admin/reports/ReportActionsDropdown'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
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
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

const mockGetBoundingClientRect = vi.fn().mockReturnValue({
  top: 100, bottom: 130, left: 200, right: 230,
  width: 30, height: 30, x: 200, y: 100,
})

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  value: mockGetBoundingClientRect,
  configurable: true,
})

describe('ReportActionsDropdown - branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateReportStatus.mockResolvedValue({ success: true })
    mockDeleteReportedContent.mockResolvedValue({ success: true })
    mockDeleteReport.mockResolvedValue({ success: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })
  })

  it('comment targetType has no "対象を確認" link', () => {
    render(
      <ReportActionsDropdown
        reportId="r-1"
        currentStatus="pending"
        targetType="comment"
        targetId="comment-1"
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('対象を確認')).not.toBeInTheDocument()
  })

  it('user targetType shows アカウントを停止', () => {
    render(
      <ReportActionsDropdown
        reportId="r-1"
        currentStatus="pending"
        targetType="user"
        targetId="user-1"
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('アカウントを停止')).toBeInTheDocument()
    expect(screen.getByText('対象を確認').closest('a')).toHaveAttribute('href', '/users/user-1')
  })

  it('currentStatus=reviewed hides 確認中にする but shows others', () => {
    render(
      <ReportActionsDropdown
        reportId="r-1"
        currentStatus="reviewed"
        targetType="post"
        targetId="p-1"
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('確認中にする')).not.toBeInTheDocument()
    expect(screen.getByText('対応完了にする')).toBeInTheDocument()
    expect(screen.getByText('却下する')).toBeInTheDocument()
    expect(screen.getByText('未対応に戻す')).toBeInTheDocument()
  })

  it('currentStatus=resolved hides 対応完了にする', () => {
    render(
      <ReportActionsDropdown
        reportId="r-1"
        currentStatus="resolved"
        targetType="post"
        targetId="p-1"
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('対応完了にする')).not.toBeInTheDocument()
    expect(screen.getByText('確認中にする')).toBeInTheDocument()
  })

  it('currentStatus=dismissed hides 却下する', () => {
    render(
      <ReportActionsDropdown
        reportId="r-1"
        currentStatus="dismissed"
        targetType="post"
        targetId="p-1"
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('却下する')).not.toBeInTheDocument()
    expect(screen.getByText('未対応に戻す')).toBeInTheDocument()
  })

  it('deleteReportedContent error shows toast', async () => {
    mockDeleteReportedContent.mockResolvedValue({ success: false, error: '削除権限なし' })

    render(
      <ReportActionsDropdown
        reportId="r-1"
        currentStatus="pending"
        targetType="post"
        targetId="p-1"
      />
    )
    fireEvent.click(screen.getByRole('button'))
    // Show delete confirm
    fireEvent.click(screen.getByText('投稿を削除'))
    // Confirm delete
    fireEvent.click(screen.getByText('削除'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '削除権限なし', variant: 'destructive' })
      )
    })
  })

  it('deleteReport error shows toast', async () => {
    mockDeleteReport.mockResolvedValue({ success: false, error: '通報削除失敗' })

    render(
      <ReportActionsDropdown
        reportId="r-1"
        currentStatus="pending"
        targetType="post"
        targetId="p-1"
      />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('通報を削除（レコードのみ）'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '通報削除失敗', variant: 'destructive' })
      )
    })
  })

  it('openUpward when space below is small', () => {
    Object.defineProperty(window, 'innerHeight', { value: 150, writable: true })
    mockGetBoundingClientRect.mockReturnValue({
      top: 100, bottom: 130, left: 200, right: 230,
      width: 30, height: 30, x: 200, y: 100,
    })

    render(
      <ReportActionsDropdown
        reportId="r-1"
        currentStatus="pending"
        targetType="post"
        targetId="p-1"
      />
    )
    fireEvent.click(screen.getByRole('button'))

    // Menu should be visible (positioned upward)
    expect(screen.getByText('対象を確認')).toBeInTheDocument()
  })

  it('clicking overlay closes menu', () => {
    render(
      <ReportActionsDropdown
        reportId="r-1"
        currentStatus="pending"
        targetType="post"
        targetId="p-1"
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('対象を確認')).toBeInTheDocument()

    // Click overlay (first fixed inset-0 div)
    const overlay = document.querySelector('.fixed.inset-0.z-\\[100\\]')!
    fireEvent.click(overlay)

    expect(screen.queryByText('対象を確認')).not.toBeInTheDocument()
  })

  it('cancel in delete confirm hides the confirm dialog', () => {
    render(
      <ReportActionsDropdown
        reportId="r-1"
        currentStatus="pending"
        targetType="post"
        targetId="p-1"
      />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('投稿を削除'))

    expect(screen.getByText('キャンセル')).toBeInTheDocument()
    fireEvent.click(screen.getByText('キャンセル'))

    // Delete confirm should be hidden, but regular delete button should be back
    expect(screen.getByText('投稿を削除')).toBeInTheDocument()
  })

  it('updateReportStatus error shows toast', async () => {
    mockUpdateReportStatus.mockResolvedValue({ success: false, error: 'ステータス更新失敗' })

    render(
      <ReportActionsDropdown
        reportId="r-1"
        currentStatus="pending"
        targetType="post"
        targetId="p-1"
      />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('確認中にする'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'ステータス更新失敗', variant: 'destructive' })
      )
    })
  })

  it('user targetType delete confirm shows 停止 instead of 削除', () => {
    render(
      <ReportActionsDropdown
        reportId="r-1"
        currentStatus="pending"
        targetType="user"
        targetId="u-1"
      />
    )
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('アカウントを停止'))

    expect(screen.getByText(/を停止しますか/)).toBeInTheDocument()
    expect(screen.getByText('停止')).toBeInTheDocument()
  })
})
