/**
 * BonsaiActions - uncovered branch tests
 *
 * Targets:
 * - deleteBonsai throws exception (ConfirmDialog onConfirm 経由)
 * - Menu toggle: clicking button when menu is open closes it
 */

import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BonsaiActions } from '@/components/bonsai/BonsaiActions'
import { MSG_BONSAI_DELETE_FAILED } from '@/lib/constants/messages'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

const mockDeleteBonsai = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  deleteBonsai: (...args: unknown[]) => mockDeleteBonsai(...args),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

describe('BonsaiActions - uncovered branches', () => {
  const defaultProps = {
    bonsaiId: 'bonsai-123',
    bonsaiName: '黒松一号',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteBonsai.mockResolvedValue({ success: true })
  })

  // ----------------------------------------------------------------
  // deleteBonsai throws exception (ConfirmDialog の showInlineError 経由)
  // ----------------------------------------------------------------
  it('削除で例外が発生した場合にトーストを表示する', async () => {
    mockDeleteBonsai.mockResolvedValueOnce({ success: false, error: '削除に失敗しました' })
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'メニュー' }))
    await user.click(screen.getByText('削除'))

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '削除に失敗しました',
          variant: 'destructive',
        })
      )
    })
  })

  // ----------------------------------------------------------------
  // deleteBonsai が success:false かつ error プロパティ無しの場合、
  // デフォルトメッセージ (MSG_BONSAI_DELETE_FAILED) にフォールバックする
  // ----------------------------------------------------------------
  it('削除失敗時に error プロパティが無ければデフォルトメッセージを表示する', async () => {
    mockDeleteBonsai.mockResolvedValueOnce({ success: false })
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'メニュー' }))
    await user.click(screen.getByText('削除'))

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: MSG_BONSAI_DELETE_FAILED,
          variant: 'destructive',
        })
      )
    })
  })

  // ----------------------------------------------------------------
  // アンマウント後に削除が成功しても setIsOpen を呼ばない
  // (mountedRef ガードにより unhandled state update を防ぐ)
  // ----------------------------------------------------------------
  it('削除完了前にアンマウントされた場合、setIsOpen を呼ばずに例外も出さない', async () => {
    let resolveDelete: (value: { success: true }) => void
    mockDeleteBonsai.mockImplementation(
      () => new Promise((resolve) => { resolveDelete = resolve })
    )
    const user = userEvent.setup()
    const { unmount } = render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'メニュー' }))
    await user.click(screen.getByText('削除'))

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '削除する' }))

    // 削除 Promise が解決する前にアンマウントする
    unmount()

    expect(() => {
      resolveDelete({ success: true })
    }).not.toThrow()

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/bonsai')
    })
  })

  // ----------------------------------------------------------------
  // Menu toggle: click button twice closes menu
  // ----------------------------------------------------------------
  it('メニューボタンを2回クリックするとメニューが閉じる', async () => {
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    // Open
    await user.click(screen.getByRole('button', { name: 'メニュー' }))
    expect(screen.getByText('編集')).toBeInTheDocument()

    // Close by clicking button again
    await user.click(screen.getByRole('button', { name: 'メニュー' }))
    await waitFor(() => {
      expect(screen.queryByText('編集')).not.toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Editing link click closes menu
  // ----------------------------------------------------------------
  it('編集リンクをクリックするとメニューが閉じる', async () => {
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'メニュー' }))
    const editLink = screen.getByRole('link', { name: /編集/i })
    await user.click(editLink)

    await waitFor(() => {
      expect(screen.queryByText('削除')).not.toBeInTheDocument()
    })
  })
})
