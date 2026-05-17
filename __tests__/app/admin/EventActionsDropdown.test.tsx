

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { EventActionsDropdown } from '@/app/admin/events/EventActionsDropdown'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mockDeleteEventByAdmin = vi.fn()
vi.mock('@/lib/actions/admin/content', () => ({
  deleteEventByAdmin: (...args: unknown[]) => mockDeleteEventByAdmin(...args),
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
})
Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })

describe('EventActionsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteEventByAdmin.mockResolvedValue({ success: true })
  })

  const defaultProps = { eventId: 'e1' }

  it('トリガーボタンが表示される', () => {
    render(<EventActionsDropdown {...defaultProps} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('ボタンクリックでメニューが開く', () => {
    render(<EventActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('イベントを削除')).toBeInTheDocument()
  })

  it('削除ボタンクリックでモーダルが開く', () => {
    render(<EventActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('イベントを削除'))
    expect(screen.getByText('イベントを削除', { selector: 'h3' })).toBeInTheDocument()
  })

  it('理由未入力で削除するとtoastが出る', async () => {
    render(<EventActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('イベントを削除'))
    fireEvent.click(screen.getByText('削除する'))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '削除理由を入力してください', variant: 'destructive' }))
    })
  })

  it('理由入力後に削除を実行する', async () => {
    render(<EventActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('イベントを削除'))
    fireEvent.change(screen.getByPlaceholderText('削除理由'), { target: { value: '不適切' } })
    fireEvent.click(screen.getByText('削除する'))
    await waitFor(() => {
      expect(mockDeleteEventByAdmin).toHaveBeenCalledWith('e1', '不適切')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('削除エラーでtoastを表示する', async () => {
    mockDeleteEventByAdmin.mockResolvedValue({ error: 'エラー' })
    render(<EventActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('イベントを削除'))
    fireEvent.change(screen.getByPlaceholderText('削除理由'), { target: { value: '理由' } })
    fireEvent.click(screen.getByText('削除する'))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'エラー', variant: 'destructive' }))
    })
  })

  it('キャンセルボタンでモーダルを閉じる', () => {
    render(<EventActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('イベントを削除'))
    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('削除する')).not.toBeInTheDocument()
  })

  it('背景クリックでメニューを閉じる', () => {
    render(<EventActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('イベントを削除')).toBeInTheDocument()
    const overlay = document.querySelector('.fixed.inset-0.z-\\[100\\]')
    if (overlay) fireEvent.click(overlay)
    expect(screen.queryByText('イベントを削除')).not.toBeInTheDocument()
  })

  it('画面下部でメニューが上向きに開く', () => {
    Object.defineProperty(window, 'innerHeight', { value: 140, writable: true })
    render(<EventActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('イベントを削除')).toBeInTheDocument()
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })
  })
})
