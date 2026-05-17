import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { ReviewList } from '@/components/shop/ReviewList'

// ReviewCard モック
vi.mock('@/components/shop/ReviewCard', () => ({
  ReviewCard: ({ review, currentUserId }: { review: { id: string; content: string | null }; currentUserId?: string }) => (
    <div data-testid={`review-${review.id}`}>
      <span>{review.content || 'コメントなし'}</span>
      {currentUserId && <span>ユーザーID: {currentUserId}</span>}
    </div>
  ),
}))

describe('ReviewList', () => {
  const mockReviews = [
    {
      id: 'review-1',
      rating: 5,
      content: '素晴らしい盆栽園でした',
      createdAt: new Date('2024-01-15'),
      user: {
        id: 'user-1',
        nickname: 'ユーザー1',
        avatarUrl: null,
      },
      images: [],
    },
    {
      id: 'review-2',
      rating: 4,
      content: '品揃えが豊富',
      createdAt: new Date('2024-01-10'),
      user: {
        id: 'user-2',
        nickname: 'ユーザー2',
        avatarUrl: '/avatar.jpg',
      },
      images: [{ id: 'img-1', url: '/image1.jpg' }],
    },
    {
      id: 'review-3',
      rating: 3,
      content: null,
      createdAt: new Date('2024-01-05'),
      user: {
        id: 'user-3',
        nickname: 'ユーザー3',
        avatarUrl: null,
      },
      images: [],
    },
  ]

  it('レビュー一覧を表示する', () => {
    render(<ReviewList reviews={mockReviews} />)

    expect(screen.getByTestId('review-review-1')).toBeInTheDocument()
    expect(screen.getByTestId('review-review-2')).toBeInTheDocument()
    expect(screen.getByTestId('review-review-3')).toBeInTheDocument()
  })

  it('各レビューの内容を表示する', () => {
    render(<ReviewList reviews={mockReviews} />)

    expect(screen.getByText('素晴らしい盆栽園でした')).toBeInTheDocument()
    expect(screen.getByText('品揃えが豊富')).toBeInTheDocument()
  })

  it('コンテンツがないレビューも表示する', () => {
    render(<ReviewList reviews={mockReviews} />)

    expect(screen.getByText('コメントなし')).toBeInTheDocument()
  })

  it('レビューが0件の場合は空メッセージを表示する', () => {
    render(<ReviewList reviews={[]} />)

    expect(screen.getByText('まだレビューがありません')).toBeInTheDocument()
  })

  it('currentUserIdをReviewCardに渡す', () => {
    render(<ReviewList reviews={mockReviews} currentUserId="user-1" />)

    expect(screen.getAllByText('ユーザーID: user-1')).toHaveLength(3)
  })

  it('currentUserIdがない場合はReviewCardにundefinedを渡す', () => {
    render(<ReviewList reviews={mockReviews} />)

    expect(screen.queryByText(/ユーザーID:/)).not.toBeInTheDocument()
  })

  it('レビューが1件の場合も正しく表示する', () => {
    render(<ReviewList reviews={[mockReviews[0]]} />)

    expect(screen.getByTestId('review-review-1')).toBeInTheDocument()
    expect(screen.queryByText('まだレビューがありません')).not.toBeInTheDocument()
  })
})
