import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { QuoteList } from '@/components/analytics/QuoteList'

// Avatar コンポーネントをモック
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="avatar">{children}</div>
  ),
  AvatarImage: ({ src, alt }: { src?: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    src ? <img src={src} alt={alt} data-testid="avatar-image" /> : null
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="avatar-fallback">{children}</span>
  ),
}))

describe('QuoteList', () => {
  const mockQuotes = [
    {
      id: 'quote-1',
      content: '素晴らしい盆栽ですね！',
      user: {
        id: 'user-1',
        nickname: '盆栽太郎',
        avatarUrl: 'https://example.com/avatar1.jpg',
      },
      originalPostId: 'post-1',
      originalContent: '今日の盆栽です',
      likeCount: 10,
      commentCount: 5,
      createdAt: new Date(),
    },
    {
      id: 'quote-2',
      content: '参考になります',
      user: {
        id: 'user-2',
        nickname: '花子',
        avatarUrl: null,
      },
      originalPostId: 'post-2',
      originalContent: '剪定のコツ',
      likeCount: 3,
      commentCount: 1,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1日前
    },
  ]

  it('引用投稿一覧を表示する', () => {
    render(<QuoteList quotes={mockQuotes} />)

    expect(screen.getByText('盆栽太郎')).toBeInTheDocument()
    expect(screen.getByText('花子')).toBeInTheDocument()
  })

  it('引用投稿のコンテンツを表示する', () => {
    render(<QuoteList quotes={mockQuotes} />)

    expect(screen.getByText('素晴らしい盆栽ですね！')).toBeInTheDocument()
    expect(screen.getByText('参考になります')).toBeInTheDocument()
  })

  it('元の投稿内容を表示する', () => {
    render(<QuoteList quotes={mockQuotes} />)

    // 複数の引用があるのでgetAllByTextを使用
    const quoteLabels = screen.getAllByText(/引用元:/)
    expect(quoteLabels.length).toBeGreaterThanOrEqual(1)
  })

  it('いいね数を表示する', () => {
    render(<QuoteList quotes={mockQuotes} />)

    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('コメント数を表示する', () => {
    render(<QuoteList quotes={mockQuotes} />)

    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('投稿詳細ページへのリンクを持つ', () => {
    render(<QuoteList quotes={mockQuotes} />)

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/posts/quote-1')
    expect(links[1]).toHaveAttribute('href', '/posts/quote-2')
  })

  it('アバター画像を表示する', () => {
    render(<QuoteList quotes={mockQuotes} />)

    // モックされたAvatarImageを確認
    expect(screen.getByTestId('avatar-image')).toBeInTheDocument()
  })

  it('アバターがない場合はイニシャルを表示する', () => {
    render(<QuoteList quotes={mockQuotes} />)

    expect(screen.getByText('花')).toBeInTheDocument()
  })

  it('引用がない場合は空メッセージを表示する', () => {
    render(<QuoteList quotes={[]} />)

    expect(screen.getByText('引用された投稿はありません')).toBeInTheDocument()
  })

  it('相対時間を表示する（今日）', () => {
    render(<QuoteList quotes={mockQuotes} />)

    expect(screen.getByText('今日')).toBeInTheDocument()
  })

  it('相対時間を表示する（昨日）', () => {
    render(<QuoteList quotes={mockQuotes} />)

    expect(screen.getByText('昨日')).toBeInTheDocument()
  })

  it('最大10件まで表示する', () => {
    const manyQuotes = Array.from({ length: 15 }, (_, i) => ({
      id: `quote-${i}`,
      content: `引用${i}`,
      user: {
        id: `user-${i}`,
        nickname: `ユーザー${i}`,
        avatarUrl: null,
      },
      originalPostId: `post-${i}`,
      originalContent: `元投稿${i}`,
      likeCount: i,
      commentCount: i,
      createdAt: new Date(),
    }))

    render(<QuoteList quotes={manyQuotes} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(10)
  })

  it('コンテンツがnullの場合はコンテンツを表示しない', () => {
    const quotesWithNullContent = [
      {
        ...mockQuotes[0],
        content: null,
      },
    ]

    render(<QuoteList quotes={quotesWithNullContent} />)

    expect(screen.queryByText('素晴らしい盆栽ですね！')).not.toBeInTheDocument()
  })
})
