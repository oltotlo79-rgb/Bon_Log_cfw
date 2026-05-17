/**
 * MobileNav - uncovered lines coverage tests
 *
 * Targets: lines 97-98
 * - Click outside handler: when showMoreMenu is open and user clicks outside menuRef,
 *   the menu should close
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { MobileNav } from '@/components/layout/MobileNav'

// next/navigation mock
const mockPathname = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}))

// NotificationBadge mock
vi.mock('@/components/notification/NotificationBadge', () => ({
  NotificationBadge: ({ className }: { className?: string }) => (
    <span data-testid="notification-badge" className={className}>3</span>
  ),
}))

// MessageBadge mock
vi.mock('@/components/message/MessageBadge', () => ({
  MessageBadge: ({ className }: { className?: string }) => (
    <span data-testid="message-badge" className={className}>5</span>
  ),
}))

describe('MobileNav - click outside to close menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname.mockReturnValue('/feed')
  })

  it('メニューが開いている状態で外側をクリックするとメニューが閉じる', () => {
    render(
      <div>
        <div data-testid="outside-area">外側エリア</div>
        <MobileNav />
      </div>
    )

    // Open the menu
    fireEvent.click(screen.getByText('もっと見る'))
    expect(screen.getByText('マイ盆栽')).toBeInTheDocument()

    // Click outside the menu using mousedown (the handler listens to mousedown)
    fireEvent.mouseDown(screen.getByTestId('outside-area'))

    // Menu should be closed
    expect(screen.queryByText('マイ盆栽')).not.toBeInTheDocument()
  })

  it('メニューが開いている状態でメニュー内をクリックしてもメニューは閉じない', () => {
    render(<MobileNav userId="user-1" />)

    // Open the menu
    fireEvent.click(screen.getByText('もっと見る'))
    expect(screen.getByText('マイ盆栽')).toBeInTheDocument()

    // Click inside the menu (on a menu item text area, not a link)
    const menuItem = screen.getByText('盆栽園マップ')
    fireEvent.mouseDown(menuItem)

    // Menu should still be open
    expect(screen.getByText('マイ盆栽')).toBeInTheDocument()
  })

  it('メニューが閉じている状態ではmousedownイベントリスナーが登録されない', () => {
    const addEventSpy = vi.spyOn(document, 'addEventListener')

    render(<MobileNav />)

    // Menu is closed by default, so no mousedown listener should be added
    const mousedownCalls = addEventSpy.mock.calls.filter(
      call => call[0] === 'mousedown'
    )
    expect(mousedownCalls.length).toBe(0)

    addEventSpy.mockRestore()
  })

  it('パス変更時にメニューが閉じる', () => {
    const { rerender } = render(<MobileNav />)

    // Open the menu
    fireEvent.click(screen.getByText('もっと見る'))
    expect(screen.getByText('マイ盆栽')).toBeInTheDocument()

    // Simulate pathname change (re-render with different pathname)
    mockPathname.mockReturnValue('/search')
    rerender(<MobileNav />)

    // Menu should be closed after path change
    expect(screen.queryByText('マイ盆栽')).not.toBeInTheDocument()
  })

  it('もっと見るメニュー内のアイテムがアクティブパスの場合ハイライトされる', () => {
    mockPathname.mockReturnValue('/bookmarks')
    render(<MobileNav userId="user-1" />)

    // The more button itself should show as active since /bookmarks is in allMoreMenuItems
    const moreButton = screen.getByLabelText('その他のメニュー')
    expect(moreButton.className).toContain('text-sumi')
  })

  it('プロフィールパスがアクティブの場合もっと見るボタンがアクティブになる', () => {
    mockPathname.mockReturnValue('/users/user-1')
    render(<MobileNav userId="user-1" />)

    const moreButton = screen.getByLabelText('その他のメニュー')
    expect(moreButton.className).toContain('text-sumi')
  })

  it('フッターリンク（利用規約、プライバシーなど）がその他アコーディオン展開時に表示される', () => {
    render(<MobileNav />)

    fireEvent.click(screen.getByText('もっと見る'))
    fireEvent.click(screen.getByTestId('mobile-nav-others-toggle'))

    expect(screen.getByText('利用規約')).toBeInTheDocument()
    expect(screen.getByText('プライバシー')).toBeInTheDocument()
    expect(screen.getByText('ヘルプ')).toBeInTheDocument()
    expect(screen.getByText('特商法表記')).toBeInTheDocument()
  })

  it('パス変更時にメニューと一緒にアコーディオンの開閉状態もリセットされる', () => {
    const { rerender } = render(<MobileNav />)

    fireEvent.click(screen.getByText('もっと見る'))
    fireEvent.click(screen.getByTestId('mobile-nav-guides-toggle'))
    expect(screen.getByTestId('mobile-nav-guides-toggle')).toHaveAttribute('aria-expanded', 'true')

    // パス変更
    mockPathname.mockReturnValue('/search')
    rerender(<MobileNav />)

    // メニュー再オープン時にアコーディオンは閉じている
    fireEvent.click(screen.getByText('もっと見る'))
    expect(screen.getByTestId('mobile-nav-guides-toggle')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('農薬・病害虫')).not.toBeInTheDocument()
  })

  it('もっと見るメニューがガイド項目のパスに対してもアクティブ判定される', () => {
    mockPathname.mockReturnValue('/pesticides')
    render(<MobileNav />)

    const moreButton = screen.getByLabelText('その他のメニュー')
    expect(moreButton.className).toContain('text-sumi')
  })

  it('もっと見るメニューが法的情報パスに対してもアクティブ判定される', () => {
    mockPathname.mockReturnValue('/terms')
    render(<MobileNav />)

    const moreButton = screen.getByLabelText('その他のメニュー')
    expect(moreButton.className).toContain('text-sumi')
  })

  it('Escapeキー押下でメニューが閉じる', () => {
    render(<MobileNav />)

    fireEvent.click(screen.getByText('もっと見る'))
    expect(screen.getByText('マイ盆栽')).toBeInTheDocument()

    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'Escape' })

    expect(screen.queryByText('マイ盆栽')).not.toBeInTheDocument()
  })

  it('Escape以外のキーではメニューは閉じない', () => {
    render(<MobileNav />)

    fireEvent.click(screen.getByText('もっと見る'))
    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'Enter' })

    expect(screen.getByText('マイ盆栽')).toBeInTheDocument()
  })
})
