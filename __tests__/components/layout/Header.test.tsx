import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { Header } from '@/components/layout/Header'

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

// LogoutButton モック
vi.mock('@/components/auth/LogoutButton', () => ({
  LogoutButton: () => <button>ログアウト</button>,
}))

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ロゴ画像を表示する', () => {
    render(<Header />)

    const logo = screen.getByAltText('BON-LOG')
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', '/logo.png')
  })

  it('ロゴにフィードページへのリンクを設定する', () => {
    render(<Header />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/feed')
  })

  it('isPremiumがtrueの場合はプレミアムバッジを表示する', () => {
    render(<Header isPremium={true} />)

    const badge = screen.getByLabelText('プレミアム会員')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('role', 'img')
  })

  it('isPremiumがfalseまたは未指定の場合はプレミアムバッジを表示しない', () => {
    render(<Header isPremium={false} />)
    expect(screen.queryByLabelText('プレミアム会員')).not.toBeInTheDocument()
  })

  it('userIdがある場合は設定リンクを表示する', () => {
    render(<Header userId="user-1" />)

    const settingsLink = screen.getByRole('link', { name: '設定' })
    expect(settingsLink).toHaveAttribute('href', '/settings')
  })

  it('userIdがない場合は設定リンクを表示しない', () => {
    render(<Header />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1) // ロゴリンクのみ
  })

  it('ヘッダーはstickyかつモバイル専用表示である', () => {
    const { container } = render(<Header />)

    const header = container.querySelector('header')
    expect(header).toHaveClass('sticky', 'top-0', 'lg:hidden')
  })

  it('ログアウトボタンを表示する', () => {
    render(<Header />)

    expect(screen.getByText('ログアウト')).toBeInTheDocument()
  })
})
