import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BonsaiActions } from '@/components/bonsai/BonsaiActions'

// Next.js navigation モック
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// Server Action モック
const mockDeleteBonsai = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  deleteBonsai: (...args: unknown[]) => mockDeleteBonsai(...args),
}))

// useToast モック
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

// window.confirm モック
const originalConfirm = window.confirm
const mockConfirm = vi.fn()

describe('BonsaiActions', () => {
  const defaultProps = {
    bonsaiId: 'bonsai-123',
    bonsaiName: '黒松一号',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    window.confirm = mockConfirm
  })

  afterEach(() => {
    window.confirm = originalConfirm
  })

  it('メニューボタンを表示する', () => {
    render(<BonsaiActions {...defaultProps} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('メニューボタンクリックでドロップダウンを開く', async () => {
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button'))

    expect(screen.getByText('編集')).toBeInTheDocument()
    expect(screen.getByText('削除')).toBeInTheDocument()
  })

  it('編集リンクが正しいhrefを持つ', async () => {
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button'))

    expect(screen.getByRole('link', { name: /編集/i })).toHaveAttribute(
      'href',
      '/bonsai/bonsai-123/edit'
    )
  })

  it('メニュー外クリックでメニューを閉じる', async () => {
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    // メニューを開く
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('編集')).toBeInTheDocument()

    // オーバーレイをクリック（メニュー外）
    const overlay = document.querySelector('.fixed.inset-0')
    if (overlay) {
      await user.click(overlay)
    }

    // メニューが閉じている
    await waitFor(() => {
      expect(screen.queryByText('編集')).not.toBeInTheDocument()
    })
  })

  it('削除ボタンクリックで確認ダイアログを表示する', async () => {
    mockConfirm.mockReturnValue(false)
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('button', { name: /削除/i }))

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.stringContaining('黒松一号')
    )
  })

  it('確認ダイアログでキャンセル時は削除されない', async () => {
    mockConfirm.mockReturnValue(false)
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('button', { name: /削除/i }))

    expect(mockDeleteBonsai).not.toHaveBeenCalled()
  })

  it('確認ダイアログでOK時に削除が実行される', async () => {
    mockConfirm.mockReturnValue(true)
    mockDeleteBonsai.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('button', { name: /削除/i }))

    await waitFor(() => {
      expect(mockDeleteBonsai).toHaveBeenCalledWith('bonsai-123')
    })
  })

  it('削除成功時に盆栽一覧にリダイレクトする', async () => {
    mockConfirm.mockReturnValue(true)
    mockDeleteBonsai.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('button', { name: /削除/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/bonsai')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('削除エラー時にトーストを表示する', async () => {
    mockConfirm.mockReturnValue(true)
    mockDeleteBonsai.mockResolvedValue({ error: '削除に失敗しました' })

    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('button', { name: /削除/i }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '削除に失敗しました', variant: 'destructive' }))
    })
  })

  it('削除中は削除ボタンが無効化される', async () => {
    mockConfirm.mockReturnValue(true)
    // 削除処理を遅延させる
    mockDeleteBonsai.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
    )
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('button', { name: /削除/i }))

    // 削除中のテキストが表示される
    await waitFor(() => {
      expect(screen.getByText('削除中...')).toBeInTheDocument()
    })
  })
})
