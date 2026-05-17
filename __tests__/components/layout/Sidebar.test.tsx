import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from '@/components/layout/Sidebar'

// next/image モック
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, width, height, className, priority }: {
    src: string
    alt: string
    width?: number
    height?: number
    className?: string
    priority?: boolean
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      data-priority={priority}
    />
  ),
}))

// next/navigation モック
const mockPathname = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}))

// next-auth/react モック
const mockSignOut = vi.fn()
vi.mock('next-auth/react', () => ({
  signOut: (options: { callbackUrl: string }) => mockSignOut(options),
}))

// NotificationBadge モック
vi.mock('@/components/notification/NotificationBadge', () => ({
  NotificationBadge: ({ className }: { className?: string }) => (
    <span data-testid="notification-badge" className={className}>3</span>
  ),
}))

// MessageBadge モック
vi.mock('@/components/message/MessageBadge', () => ({
  MessageBadge: ({ className }: { className?: string }) => (
    <span data-testid="message-badge" className={className}>5</span>
  ),
}))

// ThemeToggle モック
vi.mock('@/components/theme/ThemeToggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">テーマ切替</button>,
}))

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname.mockReturnValue('/feed')
  })

  it('ロゴと基本ナビゲーション項目を表示する', () => {
    render(<Sidebar />)

    expect(screen.getByAltText('BON-LOG')).toBeInTheDocument()
    expect(screen.getByText('ホーム')).toBeInTheDocument()
    expect(screen.getByText('検索')).toBeInTheDocument()
    expect(screen.getByText('通知')).toBeInTheDocument()
    expect(screen.getByText('メッセージ')).toBeInTheDocument()
    expect(screen.getByText('ブックマーク')).toBeInTheDocument()
    expect(screen.getByText('設定')).toBeInTheDocument()
  })

  it('通知バッジとメッセージバッジを表示する', () => {
    render(<Sidebar />)

    expect(screen.getByTestId('notification-badge')).toBeInTheDocument()
    expect(screen.getByTestId('message-badge')).toBeInTheDocument()
  })

  it('userIdがある場合はプロフィールリンクを表示する', () => {
    render(<Sidebar userId="user-1" />)

    const profileLink = screen.getByRole('link', { name: /プロフィール/ })
    expect(profileLink).toHaveAttribute('href', '/users/user-1')
  })

  it('isPremiumがtrueの場合はプレミアムメニューを表示する', () => {
    render(<Sidebar isPremium={true} />)

    expect(screen.getByText('予約投稿')).toBeInTheDocument()
    expect(screen.getByText('投稿分析')).toBeInTheDocument()
  })

  it('ログアウトボタンをクリックするとsignOutを呼び出す', () => {
    render(<Sidebar />)

    const logoutButton = screen.getByText('ログアウト').closest('button')!
    fireEvent.click(logoutButton)

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })

  it('isGuestのときはトップページへボタンを表示しルートにリダイレクトする', () => {
    render(<Sidebar isGuest />)

    expect(screen.getByText('トップページへ')).toBeInTheDocument()
    const button = screen.getByText('トップページへ').closest('button')!
    fireEvent.click(button)

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' })
  })

  it('現在のパスと一致するナビゲーションをアクティブにする', () => {
    mockPathname.mockReturnValue('/feed')
    render(<Sidebar />)

    const homeLink = screen.getByRole('link', { name: /ホーム/ })
    expect(homeLink).toHaveClass('bg-primary')

    const searchLink = screen.getByRole('link', { name: /検索/ })
    expect(searchLink).not.toHaveClass('bg-primary')
  })

  it('デスクトップ専用表示（hidden lg:flex）である', () => {
    const { container } = render(<Sidebar />)

    const aside = container.querySelector('aside')
    expect(aside).toHaveClass('hidden', 'lg:flex')
  })
})
