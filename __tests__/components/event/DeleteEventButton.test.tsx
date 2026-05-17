import { vi } from 'vitest'
/**
 * イベント削除ボタンコンポーネントのテスト
 */

import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { DeleteEventButton } from '@/components/event/DeleteEventButton'

// モックのセットアップ
const mockDeleteEvent = vi.fn()
vi.mock('@/lib/actions/event', () => ({
  deleteEvent: (...args: unknown[]) => mockDeleteEvent(...args),
}))

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// lucide-reactのモック
vi.mock('lucide-react', () => ({
  Trash2: ({ className }: { className?: string }) => (
    <svg data-testid="trash-icon" className={className} />
  ),
}))

describe('DeleteEventButton', () => {
  const defaultProps = { eventId: 'event-123' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteEvent.mockResolvedValue({ success: true })
  })

  // 1
  it('削除ボタンを表示する', () => {
    render(<DeleteEventButton {...defaultProps} />)
    expect(screen.getByRole('button', { name: /削除/i })).toBeInTheDocument()
  })

  // 2
  it('クリックで確認ダイアログを表示する', async () => {
    const user = userEvent.setup()
    render(<DeleteEventButton {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /削除/i }))
    expect(screen.getByText(/この操作は取り消せません/i)).toBeInTheDocument()
  })

  // 3
  it('確認ダイアログに警告テキストが表示される', async () => {
    const user = userEvent.setup()
    render(<DeleteEventButton {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /削除/i }))
    expect(screen.getByText(/このイベントを削除しますか/i)).toBeInTheDocument()
  })

  // 4
  it('キャンセルで確認ダイアログが閉じる', async () => {
    const user = userEvent.setup()
    render(<DeleteEventButton {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /削除/i }))
    expect(screen.getByText(/この操作は取り消せません/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /キャンセル/i }))
    expect(screen.queryByText(/この操作は取り消せません/i)).not.toBeInTheDocument()
  })

  // 5
  it('確認でdeleteEventが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<DeleteEventButton {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /削除/i }))
    await user.click(screen.getByRole('button', { name: /削除する/i }))

    await waitFor(() => {
      expect(mockDeleteEvent).toHaveBeenCalled()
    })
  })

  // 6
  it('deleteEventに正しいイベントIDが渡される', async () => {
    const user = userEvent.setup()
    render(<DeleteEventButton {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /削除/i }))
    await user.click(screen.getByRole('button', { name: /削除する/i }))

    await waitFor(() => {
      expect(mockDeleteEvent).toHaveBeenCalledWith('event-123')
    })
  })

  // 7
  it('削除成功でイベント一覧ページにリダイレクトする', async () => {
    const user = userEvent.setup()
    render(<DeleteEventButton {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /削除/i }))
    await user.click(screen.getByRole('button', { name: /削除する/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/events')
    })
  })

  // 8
  it('削除エラーでエラーメッセージを表示する', async () => {
    mockDeleteEvent.mockResolvedValue({ error: '削除に失敗しました' })
    const user = userEvent.setup()
    render(<DeleteEventButton {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /削除/i }))
    await user.click(screen.getByRole('button', { name: /削除する/i }))

    await waitFor(() => {
      expect(screen.getByText(/削除に失敗しました/i)).toBeInTheDocument()
    })
  })

  // 9
  it('削除中はボタンが無効化される', async () => {
    mockDeleteEvent.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 200)))
    const user = userEvent.setup()
    render(<DeleteEventButton {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /削除/i }))
    await user.click(screen.getByRole('button', { name: /削除する/i }))

    expect(screen.getByRole('button', { name: /削除中/i })).toBeDisabled()
  })

  // 10
  it('削除中はローディング状態を表示する', async () => {
    mockDeleteEvent.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 200)))
    const user = userEvent.setup()
    render(<DeleteEventButton {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /削除/i }))
    await user.click(screen.getByRole('button', { name: /削除する/i }))

    expect(screen.getByText(/削除中/i)).toBeInTheDocument()
  })

  // 11
  it('アイコンが表示される', () => {
    render(<DeleteEventButton {...defaultProps} />)
    expect(screen.getByTestId('trash-icon')).toBeInTheDocument()
  })

  // 12
  it('aria-labelが設定されている', () => {
    render(<DeleteEventButton {...defaultProps} />)
    expect(screen.getByRole('button', { name: /イベントを削除/i })).toBeInTheDocument()
  })

  // 13
  it('確認ダイアログにキャンセルと削除ボタンがある', async () => {
    const user = userEvent.setup()
    render(<DeleteEventButton {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /削除/i }))

    expect(screen.getByRole('button', { name: /削除する/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /キャンセル/i })).toBeInTheDocument()
  })

  // 14
  it('削除成功でrouter.pushが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<DeleteEventButton {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /削除/i }))
    await user.click(screen.getByRole('button', { name: /削除する/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/events')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  // 15
  it('キャンセル後に再度ダイアログを開ける', async () => {
    const user = userEvent.setup()
    render(<DeleteEventButton {...defaultProps} />)

    // 一度開いて閉じる
    await user.click(screen.getByRole('button', { name: /削除/i }))
    await user.click(screen.getByRole('button', { name: /キャンセル/i }))
    expect(screen.queryByText(/この操作は取り消せません/i)).not.toBeInTheDocument()

    // 再度開く
    await user.click(screen.getByRole('button', { name: /削除/i }))
    expect(screen.getByText(/この操作は取り消せません/i)).toBeInTheDocument()
  })

  // 16
  it('確認ダイアログにrole="dialog"がある', async () => {
    const user = userEvent.setup()
    render(<DeleteEventButton {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /削除/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
