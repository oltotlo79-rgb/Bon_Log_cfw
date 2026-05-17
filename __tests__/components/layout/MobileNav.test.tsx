import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { MobileNav } from '@/components/layout/MobileNav'

// next/navigation モック
const mockPathname = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
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

describe('MobileNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname.mockReturnValue('/feed')
  })

  it('基本ナビゲーション項目を表示する', () => {
    render(<MobileNav />)

    expect(screen.getByText('ホーム')).toBeInTheDocument()
    expect(screen.getByText('検索')).toBeInTheDocument()
    expect(screen.getByText('通知')).toBeInTheDocument()
    expect(screen.getByText('メッセージ')).toBeInTheDocument()
    expect(screen.getByText('もっと見る')).toBeInTheDocument()
  })

  it('現在のパスに一致するナビゲーションをアクティブ表示する', () => {
    mockPathname.mockReturnValue('/feed')
    render(<MobileNav />)

    const homeLink = screen.getByRole('link', { name: /ホーム/ })
    expect(homeLink).toHaveClass('text-sumi')

    const searchLink = screen.getByRole('link', { name: /検索/ })
    expect(searchLink).toHaveClass('text-sumi/40')
  })

  it('通知バッジとメッセージバッジを表示する', () => {
    render(<MobileNav />)

    expect(screen.getByTestId('notification-badge')).toBeInTheDocument()
    expect(screen.getByTestId('message-badge')).toBeInTheDocument()
  })

  it('もっと見るボタンをクリックするとメニューを表示・非表示にする', () => {
    render(<MobileNav />)

    expect(screen.queryByText('マイ盆栽')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('もっと見る'))
    expect(screen.getByText('マイ盆栽')).toBeInTheDocument()
    expect(screen.getByText('盆栽園マップ')).toBeInTheDocument()
    expect(screen.getByText('設定')).toBeInTheDocument()
    // ガイド/その他 はアコーディオン化されてヘッダーのみ常時表示される
    expect(screen.getByText('育成ガイド')).toBeInTheDocument()
    expect(screen.getByText('その他')).toBeInTheDocument()

    fireEvent.click(screen.getByText('もっと見る'))
    expect(screen.queryByText('マイ盆栽')).not.toBeInTheDocument()
  })

  it('育成ガイドの中身は初期状態では非表示で、ヘッダーをタップすると展開される', () => {
    render(<MobileNav />)

    fireEvent.click(screen.getByText('もっと見る'))

    // 初期状態: ガイドの中身は非表示
    expect(screen.queryByText('農薬・病害虫')).not.toBeInTheDocument()
    expect(screen.queryByText('施肥ガイド')).not.toBeInTheDocument()
    expect(screen.queryByText('植物ホルモン')).not.toBeInTheDocument()
    expect(screen.queryByText('盆栽用語辞典')).not.toBeInTheDocument()

    // 育成ガイドを展開
    const guidesToggle = screen.getByTestId('mobile-nav-guides-toggle')
    fireEvent.click(guidesToggle)

    expect(guidesToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('農薬・病害虫')).toBeInTheDocument()
    expect(screen.getByText('施肥ガイド')).toBeInTheDocument()
    expect(screen.getByText('植物ホルモン')).toBeInTheDocument()
    expect(screen.getByText('盆栽用語辞典')).toBeInTheDocument()

    // 折りたたみ
    fireEvent.click(guidesToggle)
    expect(guidesToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('農薬・病害虫')).not.toBeInTheDocument()
  })

  it('その他の中身は初期状態では非表示で、ヘッダーをタップすると展開される', () => {
    render(<MobileNav />)

    fireEvent.click(screen.getByText('もっと見る'))

    expect(screen.queryByText('利用規約')).not.toBeInTheDocument()
    expect(screen.queryByText('プライバシー')).not.toBeInTheDocument()
    expect(screen.queryByText('特商法表記')).not.toBeInTheDocument()
    expect(screen.queryByText('ヘルプ')).not.toBeInTheDocument()

    const othersToggle = screen.getByTestId('mobile-nav-others-toggle')
    fireEvent.click(othersToggle)

    expect(othersToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('利用規約')).toBeInTheDocument()
    expect(screen.getByText('プライバシー')).toBeInTheDocument()
    expect(screen.getByText('特商法表記')).toBeInTheDocument()
    expect(screen.getByText('ヘルプ')).toBeInTheDocument()
  })

  it('育成ガイドを開いた状態でその他をタップすると育成ガイドは閉じる（相互排他）', () => {
    render(<MobileNav />)

    fireEvent.click(screen.getByText('もっと見る'))

    const guidesToggle = screen.getByTestId('mobile-nav-guides-toggle')
    const othersToggle = screen.getByTestId('mobile-nav-others-toggle')

    fireEvent.click(guidesToggle)
    expect(guidesToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('農薬・病害虫')).toBeInTheDocument()

    fireEvent.click(othersToggle)
    // ガイドは閉じる、その他が開く
    expect(guidesToggle).toHaveAttribute('aria-expanded', 'false')
    expect(othersToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByText('農薬・病害虫')).not.toBeInTheDocument()
    expect(screen.getByText('利用規約')).toBeInTheDocument()
  })

  it('メニューを閉じるとアコーディオンの開閉状態もリセットされる', () => {
    render(<MobileNav />)

    fireEvent.click(screen.getByText('もっと見る'))
    fireEvent.click(screen.getByTestId('mobile-nav-guides-toggle'))
    expect(screen.getByText('農薬・病害虫')).toBeInTheDocument()

    fireEvent.click(screen.getByText('もっと見る'))
    // メニュー再オープン時はアコーディオン閉じた状態
    fireEvent.click(screen.getByText('もっと見る'))
    expect(screen.queryByText('農薬・病害虫')).not.toBeInTheDocument()
    expect(screen.getByTestId('mobile-nav-guides-toggle')).toHaveAttribute('aria-expanded', 'false')
  })

  it('プレミアム会員の場合はプレミアムメニュー項目を表示する', () => {
    render(<MobileNav userId="user-1" isPremium={true} />)

    fireEvent.click(screen.getByText('もっと見る'))

    expect(screen.getByText('予約投稿')).toBeInTheDocument()
    expect(screen.getByText('投稿分析')).toBeInTheDocument()
    expect(screen.getByText('プレミアム')).toBeInTheDocument()
  })

  it('プレミアム会員でない場合はプレミアム項目を表示しない', () => {
    render(<MobileNav userId="user-1" isPremium={false} />)

    fireEvent.click(screen.getByText('もっと見る'))

    expect(screen.queryByText('予約投稿')).not.toBeInTheDocument()
    expect(screen.queryByText('投稿分析')).not.toBeInTheDocument()
  })

  it('各ナビゲーション項目に正しいhrefを設定する', () => {
    render(<MobileNav />)

    expect(screen.getByRole('link', { name: /ホーム/ })).toHaveAttribute('href', '/feed')
    expect(screen.getByRole('link', { name: /検索/ })).toHaveAttribute('href', '/search')
    expect(screen.getByRole('link', { name: /通知/ })).toHaveAttribute('href', '/notifications')
    expect(screen.getByRole('link', { name: /メッセージ/ })).toHaveAttribute('href', '/messages')
  })
})
