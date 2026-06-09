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

describe('BonsaiActions', () => {
  const defaultProps = {
    bonsaiId: 'bonsai-123',
    bonsaiName: '黒松一号',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteBonsai.mockResolvedValue({ success: true })
  })

  it('メニューボタンを表示する', () => {
    render(<BonsaiActions {...defaultProps} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('メニューボタンクリックでドロップダウンを開く', async () => {
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'メニュー' }))

    expect(screen.getByText('編集')).toBeInTheDocument()
    expect(screen.getByText('削除')).toBeInTheDocument()
  })

  it('編集リンクが正しいhrefを持つ', async () => {
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'メニュー' }))

    expect(screen.getByRole('link', { name: /編集/i })).toHaveAttribute(
      'href',
      '/bonsai/bonsai-123/edit'
    )
  })

  it('メニュー外クリックでメニューを閉じる', async () => {
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    // メニューを開く
    await user.click(screen.getByRole('button', { name: 'メニュー' }))
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
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'メニュー' }))
    await user.click(screen.getByText('削除'))

    // ConfirmDialog の AlertDialog が開く
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })
    // タイトルに盆栽名が含まれる
    expect(screen.getByText(/黒松一号/)).toBeInTheDocument()
  })

  it('確認ダイアログでキャンセル時は削除されない', async () => {
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'メニュー' }))
    await user.click(screen.getByText('削除'))

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    // キャンセルボタンをクリック
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(mockDeleteBonsai).not.toHaveBeenCalled()
  })

  it('確認ダイアログでOK時に削除が実行される', async () => {
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'メニュー' }))
    await user.click(screen.getByText('削除'))

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    // 「削除する」ボタンをクリック（aria-label で特定）
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockDeleteBonsai).toHaveBeenCalledWith('bonsai-123')
    })
  })

  it('削除成功時に盆栽一覧にリダイレクトする', async () => {
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'メニュー' }))
    await user.click(screen.getByText('削除'))

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/bonsai')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('削除エラー時にトーストを表示する', async () => {
    mockDeleteBonsai.mockResolvedValue({ success: false, error: '削除に失敗しました' })

    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'メニュー' }))
    await user.click(screen.getByText('削除'))

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '削除に失敗しました', variant: 'destructive' }))
    })
  })

  it('削除中は「処理中...」が表示される', async () => {
    mockDeleteBonsai.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
    )
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'メニュー' }))
    await user.click(screen.getByText('削除'))

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '削除する' }))

    // 削除中のテキストが表示される
    await waitFor(() => {
      expect(screen.getByText('処理中...')).toBeInTheDocument()
    })
  })
})
