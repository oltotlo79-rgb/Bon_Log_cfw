

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { ShopRequestActions } from '@/app/admin/shop-requests/ShopRequestActions'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mockApprove = vi.fn()
const mockReject = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  approveShopChangeRequest: (...args: unknown[]) => mockApprove(...args),
  rejectShopChangeRequest: (...args: unknown[]) => mockReject(...args),
}))

describe('ShopRequestActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApprove.mockResolvedValue({ success: true })
    mockReject.mockResolvedValue({ success: true })
  })

  const defaultProps = {
    requestId: 'req-1',
    shopId: 'shop-1',
    shopName: 'テスト盆栽園',
    changes: { name: '新しい名前', address: '新しい住所' },
  }

  it('盆栽園確認リンクを表示する', () => {
    render(<ShopRequestActions {...defaultProps} />)
    const link = screen.getByText('盆栽園を確認')
    expect(link.closest('a')).toHaveAttribute('href', '/shops/shop-1')
  })

  it('承認・却下ボタンを表示する', () => {
    render(<ShopRequestActions {...defaultProps} />)
    expect(screen.getByText('承認')).toBeInTheDocument()
    expect(screen.getByText('却下')).toBeInTheDocument()
  })

  it('承認ボタンクリックで承認ダイアログを表示する', () => {
    render(<ShopRequestActions {...defaultProps} />)
    fireEvent.click(screen.getByText('承認'))
    expect(screen.getByText('変更リクエストを承認')).toBeInTheDocument()
    expect(screen.getByText(/テスト盆栽園/)).toBeInTheDocument()
  })

  it('承認ダイアログに変更内容を表示する', () => {
    render(<ShopRequestActions {...defaultProps} />)
    fireEvent.click(screen.getByText('承認'))
    expect(screen.getByText('名称:')).toBeInTheDocument()
    expect(screen.getByText('新しい名前')).toBeInTheDocument()
    expect(screen.getByText('住所:')).toBeInTheDocument()
  })

  it('承認を実行する', async () => {
    render(<ShopRequestActions {...defaultProps} />)
    fireEvent.click(screen.getByText('承認'))
    fireEvent.click(screen.getByText('承認して変更を適用'))
    await waitFor(() => {
      expect(mockApprove).toHaveBeenCalledWith('req-1', '')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('承認にコメントを含める', async () => {
    render(<ShopRequestActions {...defaultProps} />)
    fireEvent.click(screen.getByText('承認'))
    fireEvent.change(screen.getByPlaceholderText('リクエスターへのコメント'), { target: { value: 'OK' } })
    fireEvent.click(screen.getByText('承認して変更を適用'))
    await waitFor(() => {
      expect(mockApprove).toHaveBeenCalledWith('req-1', 'OK')
    })
  })

  it('承認エラーを表示する', async () => {
    mockApprove.mockResolvedValue({ success: false, error: '承認エラー' })
    render(<ShopRequestActions {...defaultProps} />)
    fireEvent.click(screen.getByText('承認'))
    fireEvent.click(screen.getByText('承認して変更を適用'))
    await waitFor(() => {
      expect(screen.getByText('承認エラー')).toBeInTheDocument()
    })
  })

  it('承認ダイアログをキャンセルする', () => {
    render(<ShopRequestActions {...defaultProps} />)
    fireEvent.click(screen.getByText('承認'))
    const _el0 = screen.getAllByText('キャンセル')[0]
    if (_el0) fireEvent.click(_el0)
    expect(screen.queryByText('変更リクエストを承認')).not.toBeInTheDocument()
  })

  it('却下ダイアログを表示する', () => {
    render(<ShopRequestActions {...defaultProps} />)
    fireEvent.click(screen.getByText('却下'))
    expect(screen.getByText('変更リクエストを却下')).toBeInTheDocument()
  })

  it('却下を実行する', async () => {
    render(<ShopRequestActions {...defaultProps} />)
    fireEvent.click(screen.getByText('却下'))
    fireEvent.click(screen.getByText('却下する'))
    await waitFor(() => {
      expect(mockReject).toHaveBeenCalledWith('req-1', '')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('却下エラーを表示する', async () => {
    mockReject.mockResolvedValue({ success: false, error: '却下エラー' })
    render(<ShopRequestActions {...defaultProps} />)
    fireEvent.click(screen.getByText('却下'))
    fireEvent.click(screen.getByText('却下する'))
    await waitFor(() => {
      expect(screen.getByText('却下エラー')).toBeInTheDocument()
    })
  })

  it('却下ダイアログをキャンセルする', () => {
    render(<ShopRequestActions {...defaultProps} />)
    fireEvent.click(screen.getByText('却下'))
    const _el0 = screen.getAllByText('キャンセル')[0]
    if (_el0) fireEvent.click(_el0)
    expect(screen.queryByText('変更リクエストを却下')).not.toBeInTheDocument()
  })

  it('不明なフィールドラベルはフィールド名をそのまま表示する', () => {
    // @ts-expect-error ShopChangeRequestData の閉じた型に存在しないキーを渡してフォールバック挙動を検証する
    render(<ShopRequestActions {...defaultProps} changes={{ unknownField: 'value' }} />)
    fireEvent.click(screen.getByText('承認'))
    expect(screen.getByText('unknownField:')).toBeInTheDocument()
  })

  it('空の値の変更はフィルタリングされる', () => {
    render(<ShopRequestActions {...defaultProps} changes={{ name: '新名前', address: '' }} />)
    fireEvent.click(screen.getByText('承認'))
    expect(screen.getByText('名称:')).toBeInTheDocument()
  })
})
