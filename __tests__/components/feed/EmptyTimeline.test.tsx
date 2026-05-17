import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { EmptyTimeline } from '@/components/feed/EmptyTimeline'

// Next.js Link モック
vi.mock('next/link', () => {
  const MockLink = ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  )
  MockLink.displayName = 'MockLink'
  return { default: MockLink }
})

describe('EmptyTimeline', () => {
  it('空状態メッセージをレンダリングする', () => {
    render(<EmptyTimeline />)
    expect(screen.getByText('タイムラインに投稿がありません')).toBeInTheDocument()
  })

  it('アイコンが表示される', () => {
    const { container } = render(<EmptyTimeline />)
    const iconContainer = container.querySelector('.w-16.h-16.mx-auto.mb-4.rounded-full')
    expect(iconContainer).toBeInTheDocument()
    const svg = iconContainer?.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('メッセージテキストが正しい', () => {
    render(<EmptyTimeline />)
    expect(screen.getByText('タイムラインに投稿がありません')).toBeInTheDocument()
  })

  it('見出しがh3要素である', () => {
    render(<EmptyTimeline />)
    const heading = screen.getByText('タイムラインに投稿がありません')
    expect(heading.tagName).toBe('H3')
  })

  it('スタイリングが適用されている', () => {
    const { container } = render(<EmptyTimeline />)
    const card = container.querySelector('.bg-card.rounded-lg.border.p-8.text-center')
    expect(card).toBeInTheDocument()
  })

  it('エラーなくレンダリングされる', () => {
    expect(() => render(<EmptyTimeline />)).not.toThrow()
  })

  it('提案テキストが含まれる', () => {
    render(<EmptyTimeline />)
    expect(screen.getByText('ユーザーをフォローすると、その人の投稿がここに表示されます')).toBeInTheDocument()
  })

  it('検索ページへのリンクが存在する', () => {
    render(<EmptyTimeline />)
    const link = screen.getByText('ユーザーを検索')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/search')
  })

  it('検索アイコンがリンク内に表示される', () => {
    render(<EmptyTimeline />)
    const link = screen.getByText('ユーザーを検索').closest('a')
    const svg = link?.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('コンテナが中央揃えレイアウトを持つ', () => {
    const { container } = render(<EmptyTimeline />)
    const card = container.firstChild
    expect(card).toHaveClass('text-center')
  })

  it('サブメッセージがmuted-foregroundクラスを持つ', () => {
    render(<EmptyTimeline />)
    const subMessage = screen.getByText('ユーザーをフォローすると、その人の投稿がここに表示されます')
    expect(subMessage).toHaveClass('text-muted-foreground')
  })

  it('見出しがfont-semiboldクラスを持つ', () => {
    render(<EmptyTimeline />)
    const heading = screen.getByText('タイムラインに投稿がありません')
    expect(heading).toHaveClass('font-semibold')
  })

  it('リンクボタンがプライマリスタイルを持つ', () => {
    render(<EmptyTimeline />)
    const link = screen.getByText('ユーザーを検索').closest('a')
    expect(link).toHaveClass('bg-primary', 'text-primary-foreground')
  })

  it('ユーザーグループアイコンのSVGが正しいクラスを持つ', () => {
    const { container } = render(<EmptyTimeline />)
    const iconContainer = container.querySelector('.w-16.h-16')
    const svg = iconContainer?.querySelector('svg')
    expect(svg).toHaveClass('w-8', 'h-8', 'text-muted-foreground')
  })

  it('ボタンエリアがレスポンシブレイアウトを持つ', () => {
    const { container } = render(<EmptyTimeline />)
    const buttonArea = container.querySelector('.flex.flex-col.sm\\:flex-row')
    expect(buttonArea).toBeInTheDocument()
  })
})
