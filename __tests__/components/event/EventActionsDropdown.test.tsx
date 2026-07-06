import { vi } from 'vitest'
/**
 * イベント操作ドロップダウンコンポーネントのテスト
 */

import { render, screen, fireEvent } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { EventActionsDropdown } from '@/components/event/EventActionsDropdown'

// モックのセットアップ
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
  MoreHorizontal: ({ className }: { className?: string }) => (
    <svg data-testid="more-icon" className={className} />
  ),
  Edit: ({ className }: { className?: string }) => (
    <svg data-testid="edit-icon" className={className} />
  ),
  Trash2: ({ className }: { className?: string }) => (
    <svg data-testid="trash-icon" className={className} />
  ),
  Flag: ({ className }: { className?: string }) => (
    <svg data-testid="flag-icon" className={className} />
  ),
  Share: ({ className }: { className?: string }) => (
    <svg data-testid="share-icon" className={className} />
  ),
}))

describe('EventActionsDropdown', () => {
  const ownerProps = {
    eventId: 'event-123',
    isOwner: true,
    onDelete: vi.fn(),
    onReport: vi.fn(),
  }

  const nonOwnerProps = {
    eventId: 'event-123',
    isOwner: false,
    onDelete: vi.fn(),
    onReport: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1
  it('ドロップダウントリガーボタンを表示する', () => {
    render(<EventActionsDropdown {...ownerProps} />)
    expect(screen.getByRole('button', { name: /イベント操作メニュー/i })).toBeInTheDocument()
  })

  // 2
  it('クリックでドロップダウンメニューが開く', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...ownerProps} />)
    await user.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  // 3
  it('オーナーに編集リンクを表示する', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...ownerProps} />)
    await user.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))
    expect(screen.getByRole('menuitem', { name: /編集/i })).toBeInTheDocument()
  })

  // 4
  it('オーナーに削除オプションを表示する', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...ownerProps} />)
    await user.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))
    expect(screen.getByRole('menuitem', { name: /削除/i })).toBeInTheDocument()
  })

  // 5
  it('編集リンクに正しいhrefが設定されている', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...ownerProps} />)
    await user.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))
    const editLink = screen.getByRole('menuitem', { name: /編集/i })
    expect(editLink).toHaveAttribute('href', '/events/event-123/edit')
  })

  // 6
  it('共有オプションを表示する', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...ownerProps} />)
    await user.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))
    expect(screen.getByRole('menuitem', { name: /共有/i })).toBeInTheDocument()
  })

  // 7
  it('再クリックでドロップダウンが閉じる', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...ownerProps} />)
    const trigger = screen.getByRole('button', { name: /イベント操作メニュー/i })
    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  // 8
  it('メニューアイテムがアクセシブルである', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...ownerProps} />)
    await user.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))
    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems.length).toBeGreaterThanOrEqual(2)
  })

  // 9
  it('非オーナーには通報オプションを表示する', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...nonOwnerProps} />)
    await user.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))
    expect(screen.getByRole('menuitem', { name: /通報/i })).toBeInTheDocument()
  })

  // 10
  it('非オーナーには編集リンクを表示しない', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...nonOwnerProps} />)
    await user.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))
    expect(screen.queryByRole('menuitem', { name: /編集/i })).not.toBeInTheDocument()
  })

  // 11
  it('アイコンが正しく表示される', () => {
    render(<EventActionsDropdown {...ownerProps} />)
    expect(screen.getByTestId('more-icon')).toBeInTheDocument()
  })

  // 12
  it('メニューアイテムに適切なラベルがある', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...ownerProps} />)
    await user.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))
    expect(screen.getByText('編集')).toBeInTheDocument()
    expect(screen.getByText('削除')).toBeInTheDocument()
    expect(screen.getByText('共有')).toBeInTheDocument()
  })

  // 13
  it('削除クリックでonDeleteが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...ownerProps} />)
    await user.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))
    await user.click(screen.getByRole('menuitem', { name: /削除/i }))

    expect(ownerProps.onDelete).toHaveBeenCalled()
  })

  // 14
  it('トリガーボタンにaria-haspopup属性がある', () => {
    render(<EventActionsDropdown {...ownerProps} />)
    const trigger = screen.getByRole('button', { name: /イベント操作メニュー/i })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  })

  // 15
  it('開閉を複数回繰り返せる', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...ownerProps} />)
    const trigger = screen.getByRole('button', { name: /イベント操作メニュー/i })

    // 開く
    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // 閉じる
    await user.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    // 再度開く
    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  // 16
  it('aria-expanded属性が正しく切り替わる', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...ownerProps} />)
    const trigger = screen.getByRole('button', { name: /イベント操作メニュー/i })

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  // 17
  it('通報クリックでonReportが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...nonOwnerProps} />)
    await user.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))
    await user.click(screen.getByRole('menuitem', { name: /通報/i }))

    expect(nonOwnerProps.onReport).toHaveBeenCalled()
  })

  // 18
  it('編集リンククリックでメニューが閉じる', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown {...ownerProps} />)
    await user.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))
    await user.click(screen.getByRole('menuitem', { name: /編集/i }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  // 19
  it('共有クリックでイベントURLをクリップボードにコピーし、メニューを閉じる', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    })

    render(<EventActionsDropdown {...ownerProps} />)
    // userEvent.setup() は内部で clipboard API をエミュレートし navigator.clipboard を
    // 上書きしてしまうため、このケースは userEvent を使わず fireEvent で click する
    fireEvent.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /共有/i }))

    expect(writeTextMock).toHaveBeenCalledWith(`${window.location.origin}/events/event-123`)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  // 20
  it('onDelete が未指定でも削除クリックで例外にならない', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown eventId="event-123" isOwner />)
    await user.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))

    await expect(user.click(screen.getByRole('menuitem', { name: /削除/i }))).resolves.not.toThrow()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  // 21
  it('onReport が未指定でも通報クリックで例外にならない', async () => {
    const user = userEvent.setup()
    render(<EventActionsDropdown eventId="event-123" isOwner={false} />)
    await user.click(screen.getByRole('button', { name: /イベント操作メニュー/i }))

    await expect(user.click(screen.getByRole('menuitem', { name: /通報/i }))).resolves.not.toThrow()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
