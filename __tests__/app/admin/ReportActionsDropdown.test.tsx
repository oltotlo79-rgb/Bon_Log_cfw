

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { ReportActionsDropdown } from '@/app/admin/reports/ReportActionsDropdown'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
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

// getBoundingClientRect mock
const mockGetBoundingClientRect = vi.fn().mockReturnValue({
  top: 100, bottom: 130, left: 200, right: 230,
  width: 30, height: 30, x: 200, y: 100,
})
Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  value: mockGetBoundingClientRect,
})
Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })

describe('ReportActionsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateReportStatus.mockResolvedValue({ success: true })
    mockDeleteReportedContent.mockResolvedValue({ success: true })
    mockDeleteReport.mockResolvedValue({ success: true })
  })

  const defaultProps = {
    reportId: 'report-1',
    currentStatus: 'pending',
    targetType: 'post',
    targetId: 'post-1',
  }

  it('ドロップダウンボタンが表示される', () => {
    render(<ReportActionsDropdown {...defaultProps} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('ボタンクリックでメニューが開く', () => {
    render(<ReportActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('対象を確認')).toBeInTheDocument()
  })

  it('postタイプで正しいリンクを表示する', () => {
    render(<ReportActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    const link = screen.getByText('対象を確認')
    expect(link.closest('a')).toHaveAttribute('href', '/posts/post-1')
  })

  it('eventタイプで正しいリンクを表示する', () => {
    render(<ReportActionsDropdown {...defaultProps} targetType="event" targetId="event-1" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('対象を確認').closest('a')).toHaveAttribute('href', '/events/event-1')
  })

  it('shopタイプで正しいリンクを表示する', () => {
    render(<ReportActionsDropdown {...defaultProps} targetType="shop" targetId="shop-1" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('対象を確認').closest('a')).toHaveAttribute('href', '/shops/shop-1')
  })

  it('userタイプで正しいリンクを表示する', () => {
    render(<ReportActionsDropdown {...defaultProps} targetType="user" targetId="user-1" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('対象を確認').closest('a')).toHaveAttribute('href', '/users/user-1')
  })

  it('commentタイプではリンクを表示しない', () => {
    render(<ReportActionsDropdown {...defaultProps} targetType="comment" targetId="c-1" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('対象を確認')).not.toBeInTheDocument()
  })

  it('pendingステータスで確認中ボタンを表示する', () => {
    render(<ReportActionsDropdown {...defaultProps} currentStatus="pending" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('確認中にする')).toBeInTheDocument()
  })

  it('pendingステータスで未対応に戻すボタンを表示しない', () => {
    render(<ReportActionsDropdown {...defaultProps} currentStatus="pending" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('未対応に戻す')).not.toBeInTheDocument()
  })

  it('reviewedステータスで確認中ボタンを表示しない', () => {
    render(<ReportActionsDropdown {...defaultProps} currentStatus="reviewed" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('確認中にする')).not.toBeInTheDocument()
  })

  it('ステータス更新を実行する', async () => {
    render(<ReportActionsDropdown {...defaultProps} currentStatus="pending" />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('確認中にする'))
    await waitFor(() => {
      expect(mockUpdateReportStatus).toHaveBeenCalledWith('report-1', 'reviewed')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('ステータス更新エラーでtoastを表示する', async () => {
    mockUpdateReportStatus.mockResolvedValue({ error: 'エラー' })
    render(<ReportActionsDropdown {...defaultProps} currentStatus="pending" />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('確認中にする'))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'エラー', variant: 'destructive' }))
    })
  })

  it('削除ボタンクリックで確認表示に切り替わる', () => {
    render(<ReportActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('投稿を削除'))
    expect(screen.getByText('投稿を削除しますか？')).toBeInTheDocument()
  })

  it('userタイプではアカウント停止と表示する', () => {
    render(<ReportActionsDropdown {...defaultProps} targetType="user" targetId="u-1" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('アカウントを停止')).toBeInTheDocument()
  })

  it('削除確認でキャンセルできる', () => {
    render(<ReportActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('投稿を削除'))
    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('投稿を削除しますか？')).not.toBeInTheDocument()
  })

  it('削除確認で削除を実行する', async () => {
    render(<ReportActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('投稿を削除'))
    fireEvent.click(screen.getAllByText('削除')[0])
    await waitFor(() => {
      expect(mockDeleteReportedContent).toHaveBeenCalledWith('post', 'post-1')
    })
  })

  it('削除エラーでtoastを表示する', async () => {
    mockDeleteReportedContent.mockResolvedValue({ error: '削除エラー' })
    render(<ReportActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('投稿を削除'))
    fireEvent.click(screen.getAllByText('削除')[0])
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '削除エラー', variant: 'destructive' }))
    })
  })

  it('通報削除を実行する', async () => {
    render(<ReportActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('通報を削除（レコードのみ）'))
    await waitFor(() => {
      expect(mockDeleteReport).toHaveBeenCalledWith('report-1')
    })
  })

  it('通報削除エラーでtoastを表示する', async () => {
    mockDeleteReport.mockResolvedValue({ error: '通報削除エラー' })
    render(<ReportActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('通報を削除（レコードのみ）'))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '通報削除エラー', variant: 'destructive' }))
    })
  })

  it('背景クリックでメニューを閉じる', () => {
    render(<ReportActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('対象を確認')).toBeInTheDocument()
    // click the overlay
    const overlay = document.querySelector('.fixed.inset-0.z-\\[100\\]')
    if (overlay) fireEvent.click(overlay)
    expect(screen.queryByText('対象を確認')).not.toBeInTheDocument()
  })

  it('画面下部でメニューが上向きに開く', () => {
    Object.defineProperty(window, 'innerHeight', { value: 140, writable: true })
    render(<ReportActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('対象を確認')).toBeInTheDocument()
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })
  })
})
