

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { ShopActionsDropdown } from '@/app/admin/shops/ShopActionsDropdown'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mockDeleteShopByAdmin = vi.fn()
vi.mock('@/lib/actions/admin/content', () => ({
  deleteShopByAdmin: (...args: unknown[]) => mockDeleteShopByAdmin(...args),
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

describe('ShopActionsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteShopByAdmin.mockResolvedValue({ success: true })
  })

  const defaultProps = { shopId: 's1' }

  it('トリガーボタンが表示される', () => {
    render(<ShopActionsDropdown {...defaultProps} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('ボタンクリックでメニューが開く', () => {
    render(<ShopActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('盆栽園を削除')).toBeInTheDocument()
  })

  it('削除ボタンクリックでモーダルが開く', () => {
    render(<ShopActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('盆栽園を削除'))
    expect(screen.getByText('盆栽園を削除', { selector: 'h3' })).toBeInTheDocument()
  })

  it('理由未入力で削除するとtoastが出る', async () => {
    render(<ShopActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('盆栽園を削除'))
    fireEvent.click(screen.getByText('削除する'))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '削除理由を入力してください', variant: 'destructive' }))
    })
  })

  it('理由入力後に削除を実行する', async () => {
    render(<ShopActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('盆栽園を削除'))
    fireEvent.change(screen.getByPlaceholderText('削除理由'), { target: { value: '不適切' } })
    fireEvent.click(screen.getByText('削除する'))
    await waitFor(() => {
      expect(mockDeleteShopByAdmin).toHaveBeenCalledWith('s1', '不適切')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('削除エラーでtoastを表示する', async () => {
    mockDeleteShopByAdmin.mockResolvedValue({ error: 'エラー' })
    render(<ShopActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('盆栽園を削除'))
    fireEvent.change(screen.getByPlaceholderText('削除理由'), { target: { value: '理由' } })
    fireEvent.click(screen.getByText('削除する'))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'エラー', variant: 'destructive' }))
    })
  })

  it('キャンセルボタンでモーダルを閉じる', () => {
    render(<ShopActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('盆栽園を削除'))
    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('削除する')).not.toBeInTheDocument()
  })

  it('背景クリックでメニューを閉じる', () => {
    render(<ShopActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('盆栽園を削除')).toBeInTheDocument()
    const overlay = document.querySelector('.fixed.inset-0.z-\\[100\\]')
    if (overlay) fireEvent.click(overlay)
    expect(screen.queryByText('盆栽園を削除')).not.toBeInTheDocument()
  })

  it('画面下部でメニューが上向きに開く', () => {
    Object.defineProperty(window, 'innerHeight', { value: 140, writable: true })
    render(<ShopActionsDropdown {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('盆栽園を削除')).toBeInTheDocument()
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })
  })
})
