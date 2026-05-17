/**
 * BonsaiActions - uncovered branch tests
 *
 * Targets:
 * - deleteBonsai throws exception (catch block line 141-142)
 * - deleteBonsai returns success: false without error field
 * - Menu toggle: clicking button when menu is open closes it
 */

import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BonsaiActions } from '@/components/bonsai/BonsaiActions'

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

const originalConfirm = window.confirm
const mockConfirm = vi.fn()

describe('BonsaiActions - uncovered branches', () => {
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

  // ----------------------------------------------------------------
  // deleteBonsai throws exception (catch block)
  // ----------------------------------------------------------------
  it('削除で例外が発生した場合にトーストを表示する', async () => {
    mockConfirm.mockReturnValue(true)
    mockDeleteBonsai.mockRejectedValue(new Error('Network failure'))
    const user = userEvent.setup()
    render(<BonsaiActions {...defaultProps} />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('button', { name: /削除/i }))

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
