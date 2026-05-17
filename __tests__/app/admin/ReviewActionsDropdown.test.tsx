

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { ReviewActionsDropdown } from '@/app/admin/reviews/ReviewActionsDropdown'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mockDeleteReviewByAdmin = vi.fn()
vi.mock('@/lib/actions/admin/content', () => ({
  deleteReviewByAdmin: (...args: unknown[]) => mockDeleteReviewByAdmin(...args),
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

describe('ReviewActionsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteReviewByAdmin.mockResolvedValue({ success: true })
  })

  const defaultProps = { reviewId: 'r1', shopId: 's1' }

  it('トリガーボタンが表示される', () => {
    render(<ReviewActionsDropdown {...defaultProps} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('ボタンクリックでメニューが開く', () => {
    render(<ReviewActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('盆栽園を確認')).toBeInTheDocument()
    expect(screen.getByText('レビューを削除')).toBeInTheDocument()
  })

  it('盆栽園確認リンクが正しいhrefを持つ', () => {
    render(<ReviewActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    const link = screen.getByText('盆栽園を確認')
    expect(link.closest('a')).toHaveAttribute('href', '/shops/s1')
  })

  it('削除ボタンクリックでモーダルが開く', () => {
    render(<ReviewActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('レビューを削除'))
    expect(screen.getByText('レビューを削除', { selector: 'h3' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('削除理由')).toBeInTheDocument()
  })

  it('理由未入力で削除するとtoastが出る', async () => {
    render(<ReviewActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('レビューを削除'))
    fireEvent.click(screen.getByText('削除する'))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '削除理由を入力してください', variant: 'destructive' }))
    })
    expect(mockDeleteReviewByAdmin).not.toHaveBeenCalled()
  })

  it('理由入力後に削除を実行する', async () => {
    render(<ReviewActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('レビューを削除'))
    fireEvent.change(screen.getByPlaceholderText('削除理由'), { target: { value: '不適切' } })
    fireEvent.click(screen.getByText('削除する'))
    await waitFor(() => {
      expect(mockDeleteReviewByAdmin).toHaveBeenCalledWith('r1', '不適切')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('削除エラーでtoastを表示する', async () => {
    mockDeleteReviewByAdmin.mockResolvedValue({ error: '削除失敗' })
    render(<ReviewActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('レビューを削除'))
    fireEvent.change(screen.getByPlaceholderText('削除理由'), { target: { value: '理由' } })
    fireEvent.click(screen.getByText('削除する'))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '削除失敗', variant: 'destructive' }))
    })
  })

  it('キャンセルボタンでモーダルを閉じる', () => {
    render(<ReviewActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('レビューを削除'))
    expect(screen.getByText('削除する')).toBeInTheDocument()
    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('削除する')).not.toBeInTheDocument()
  })

  it('背景クリックでメニューを閉じる', () => {
    render(<ReviewActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('盆栽園を確認')).toBeInTheDocument()
    const overlay = document.querySelector('.fixed.inset-0.z-\\[100\\]')
    if (overlay) fireEvent.click(overlay)
    expect(screen.queryByText('盆栽園を確認')).not.toBeInTheDocument()
  })

  it('画面下部でメニューが上向きに開く', () => {
    Object.defineProperty(window, 'innerHeight', { value: 140, writable: true })
    render(<ReviewActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('盆栽園を確認')).toBeInTheDocument()
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })
  })
})
