import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ScheduledPostList } from '@/components/post/ScheduledPostList'

// Next.js navigation モック
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

// ScheduledPostCard モック
vi.mock('@/components/post/ScheduledPostCard', () => ({
  ScheduledPostCard: ({ post }: { post: { id: string; content: string | null } }) => (
    <div data-testid={`card-${post.id}`}>
      {post.content || 'テキストなし'}
    </div>
  ),
}))

describe('ScheduledPostList', () => {
  const mockPosts = [
    {
      id: 'pending-1',
      content: '予約中の投稿1',
      scheduledAt: new Date('2024-06-01T10:00:00'),
      status: 'pending' as const,
      createdAt: new Date(),
      publishedPostId: null,
      media: [],
      genres: [],
    },
    {
      id: 'pending-2',
      content: '予約中の投稿2',
      scheduledAt: new Date('2024-06-02T10:00:00'),
      status: 'pending' as const,
      createdAt: new Date(),
      publishedPostId: null,
      media: [],
      genres: [],
    },
    {
      id: 'published-1',
      content: '公開済みの投稿',
      scheduledAt: new Date('2024-05-01T10:00:00'),
      status: 'published' as const,
      createdAt: new Date(),
      publishedPostId: 'post-123',
      media: [],
      genres: [],
    },
    {
      id: 'failed-1',
      content: '失敗した投稿',
      scheduledAt: new Date('2024-05-02T10:00:00'),
      status: 'failed' as const,
      createdAt: new Date(),
      publishedPostId: null,
      media: [],
      genres: [],
    },
    {
      id: 'cancelled-1',
      content: 'キャンセルした投稿',
      scheduledAt: new Date('2024-05-03T10:00:00'),
      status: 'cancelled' as const,
      createdAt: new Date(),
      publishedPostId: null,
      media: [],
      genres: [],
    },
  ]

  it('タブを3つ表示する', () => {
    render(<ScheduledPostList scheduledPosts={mockPosts} />)
    expect(screen.getByRole('tab', { name: /予約中/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /公開済み/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /その他/i })).toBeInTheDocument()
  })

  it('各タブに件数を表示する', () => {
    render(<ScheduledPostList scheduledPosts={mockPosts} />)
    expect(screen.getByText(/予約中 \(2\)/)).toBeInTheDocument()
    expect(screen.getByText(/公開済み \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/その他 \(2\)/)).toBeInTheDocument()
  })

  it('初期状態で予約中タブがアクティブ', () => {
    render(<ScheduledPostList scheduledPosts={mockPosts} />)
    const pendingTab = screen.getByRole('tab', { name: /予約中/i })
    expect(pendingTab).toHaveAttribute('data-state', 'active')
  })

  it('予約中タブで予約中の投稿を表示する', () => {
    render(<ScheduledPostList scheduledPosts={mockPosts} />)
    expect(screen.getByTestId('card-pending-1')).toBeInTheDocument()
    expect(screen.getByTestId('card-pending-2')).toBeInTheDocument()
  })

  it('公開済みタブをクリックすると公開済みの投稿を表示する', async () => {
    const user = userEvent.setup()
    render(<ScheduledPostList scheduledPosts={mockPosts} />)

    await user.click(screen.getByRole('tab', { name: /公開済み/i }))

    expect(screen.getByTestId('card-published-1')).toBeInTheDocument()
  })

  it('その他タブをクリックすると失敗・キャンセル投稿を表示する', async () => {
    const user = userEvent.setup()
    render(<ScheduledPostList scheduledPosts={mockPosts} />)

    await user.click(screen.getByRole('tab', { name: /その他/i }))

    expect(screen.getByTestId('card-failed-1')).toBeInTheDocument()
    expect(screen.getByTestId('card-cancelled-1')).toBeInTheDocument()
  })

  it('予約中の投稿が0件の場合は空メッセージを表示する', () => {
    const postsWithoutPending = mockPosts.filter(p => p.status !== 'pending')
    render(<ScheduledPostList scheduledPosts={postsWithoutPending} />)
    expect(screen.getByText('予約中の投稿はありません')).toBeInTheDocument()
  })

  it('公開済みの投稿が0件の場合は空メッセージを表示する', async () => {
    const user = userEvent.setup()
    const postsWithoutPublished = mockPosts.filter(p => p.status !== 'published')
    render(<ScheduledPostList scheduledPosts={postsWithoutPublished} />)

    await user.click(screen.getByRole('tab', { name: /公開済み/i }))

    expect(screen.getByText('公開済みの予約投稿はありません')).toBeInTheDocument()
  })

  it('その他の投稿が0件の場合は空メッセージを表示する', async () => {
    const user = userEvent.setup()
    const postsWithoutOther = mockPosts.filter(p => p.status !== 'failed' && p.status !== 'cancelled')
    render(<ScheduledPostList scheduledPosts={postsWithoutOther} />)

    await user.click(screen.getByRole('tab', { name: /その他/i }))

    expect(screen.getByText('失敗・キャンセルされた投稿はありません')).toBeInTheDocument()
  })

  it('空の配列が渡された場合は全てのタブで空メッセージを表示する', async () => {
    const user = userEvent.setup()
    render(<ScheduledPostList scheduledPosts={[]} />)

    // 予約中タブ
    expect(screen.getByText('予約中の投稿はありません')).toBeInTheDocument()

    // 公開済みタブ
    await user.click(screen.getByRole('tab', { name: /公開済み/i }))
    expect(screen.getByText('公開済みの予約投稿はありません')).toBeInTheDocument()

    // その他タブ
    await user.click(screen.getByRole('tab', { name: /その他/i }))
    expect(screen.getByText('失敗・キャンセルされた投稿はありません')).toBeInTheDocument()
  })

  it('タブ切り替えでアクティブ状態が変わる', async () => {
    const user = userEvent.setup()
    render(<ScheduledPostList scheduledPosts={mockPosts} />)

    const pendingTab = screen.getByRole('tab', { name: /予約中/i })
    const publishedTab = screen.getByRole('tab', { name: /公開済み/i })

    // 初期状態
    expect(pendingTab).toHaveAttribute('data-state', 'active')
    expect(publishedTab).toHaveAttribute('data-state', 'inactive')

    // 公開済みタブクリック後
    await user.click(publishedTab)
    expect(pendingTab).toHaveAttribute('data-state', 'inactive')
    expect(publishedTab).toHaveAttribute('data-state', 'active')
  })
})
