import { vi } from 'vitest'
/**
 * ReviewDisplayコンポーネントのテスト
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ReportButtonモック
vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: ({ targetType, targetId }: { targetType: string; targetId: string }) => (
    <button data-testid="report-button" data-target-type={targetType} data-target-id={targetId}>
      通報
    </button>
  ),
}))

// StarRatingモック
vi.mock('@/components/shop/StarRating', () => ({
  StarRatingDisplay: ({ rating }: { rating: number; size?: string }) => (
    <div data-testid="star-rating-display">星{rating}</div>
  ),
  StarRatingInput: ({ value, onChange: _onChange }: { value: number; onChange: (v: number) => void }) => (
    <div data-testid="star-rating-input">
      <span>{value}</span>
    </div>
  ),
}))

// date-fnsモック
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '1時間前'),
}))
vi.mock('date-fns/locale', () => ({
  ja: {},
}))

// next/imageモック
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, className, width, height }: {
    src: string
    alt: string
    className?: string
    fill?: boolean
    width?: number
    height?: number
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} width={width} height={height} />
  ),
}))

import { ReviewDisplay } from '@/components/shop/review/ReviewDisplay'

const mockReview = {
  id: 'review-1',
  rating: 4,
  content: '素晴らしい盆栽園でした',
  createdAt: new Date('2024-01-01'),
  user: {
    id: 'user-1',
    nickname: 'テストユーザー',
    avatarUrl: null,
  },
  images: [],
}

const mockReviewWithAvatar = {
  ...mockReview,
  user: {
    ...mockReview.user,
    avatarUrl: '/avatar.jpg',
  },
}

const mockReviewWithImages = {
  ...mockReview,
  images: [
    { id: 'img-1', url: '/image1.jpg' },
    { id: 'img-2', url: '/image2.jpg' },
  ],
}

const defaultProps = {
  review: mockReview,
  isOwner: false,
  currentUserId: undefined,
  showDeleteConfirm: false,
  isPending: false,
  onEdit: vi.fn(),
  onShowDeleteConfirm: vi.fn(),
  onCancelDelete: vi.fn(),
  onDelete: vi.fn(),
}

describe('ReviewDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // レンダリング
  // ============================================================

  describe('レンダリング', () => {
    it('レビュー内容が表示される', () => {
      render(<ReviewDisplay {...defaultProps} />)

      expect(screen.getByText('素晴らしい盆栽園でした')).toBeInTheDocument()
    })

    it('レビュワーのニックネームが表示される', () => {
      render(<ReviewDisplay {...defaultProps} />)

      expect(screen.getByText('テストユーザー')).toBeInTheDocument()
    })

    it('星評価が表示される', () => {
      render(<ReviewDisplay {...defaultProps} />)

      expect(screen.getByTestId('star-rating-display')).toBeInTheDocument()
      expect(screen.getByTestId('star-rating-display')).toHaveTextContent('星4')
    })

    it('相対時間が表示される', () => {
      render(<ReviewDisplay {...defaultProps} />)

      expect(screen.getByText('1時間前')).toBeInTheDocument()
    })

    it('contentがnullの場合テキストを表示しない', () => {
      render(<ReviewDisplay {...defaultProps} review={{ ...mockReview, content: null }} />)

      expect(screen.queryByText('素晴らしい盆栽園でした')).not.toBeInTheDocument()
    })
  })

  // ============================================================
  // アバター
  // ============================================================

  describe('アバター', () => {
    it('アバターがない場合はイニシャルが表示される', () => {
      render(<ReviewDisplay {...defaultProps} />)

      expect(screen.getByText('テ')).toBeInTheDocument()
    })

    it('アバターがある場合はアバター画像が表示される', () => {
      const { container } = render(
        <ReviewDisplay {...defaultProps} review={mockReviewWithAvatar} />
      )

      const img = container.querySelector('img[src="/avatar.jpg"]')
      expect(img).toBeInTheDocument()
    })
  })

  // ============================================================
  // 画像
  // ============================================================

  describe('画像', () => {
    it('レビュー画像が表示される', () => {
      const { container } = render(
        <ReviewDisplay {...defaultProps} review={mockReviewWithImages} />
      )

      expect(container.querySelector('img[src="/image1.jpg"]')).toBeInTheDocument()
      expect(container.querySelector('img[src="/image2.jpg"]')).toBeInTheDocument()
    })

    it('画像がない場合は画像コンテナが表示されない', () => {
      const { container } = render(<ReviewDisplay {...defaultProps} />)

      expect(container.querySelector('img[alt="レビュー画像"]')).not.toBeInTheDocument()
    })
  })

  // ============================================================
  // オーナー操作
  // ============================================================

  describe('オーナー操作', () => {
    it('isOwnerがtrueの場合に編集ボタンが表示される', () => {
      render(<ReviewDisplay {...defaultProps} isOwner />)

      expect(screen.getByTitle('編集')).toBeInTheDocument()
    })

    it('isOwnerがtrueの場合に削除ボタンが表示される', () => {
      render(<ReviewDisplay {...defaultProps} isOwner />)

      expect(screen.getByTitle('削除')).toBeInTheDocument()
    })

    it('isOwnerがfalseの場合に編集・削除ボタンが表示されない', () => {
      render(<ReviewDisplay {...defaultProps} />)

      expect(screen.queryByTitle('編集')).not.toBeInTheDocument()
      expect(screen.queryByTitle('削除')).not.toBeInTheDocument()
    })

    it('編集ボタンをクリックするとonEditが呼ばれる', async () => {
      const user = userEvent.setup()
      const mockOnEdit = vi.fn()
      render(<ReviewDisplay {...defaultProps} isOwner onEdit={mockOnEdit} />)

      await user.click(screen.getByTitle('編集'))

      expect(mockOnEdit).toHaveBeenCalled()
    })

    it('削除ボタンをクリックするとonShowDeleteConfirmが呼ばれる', async () => {
      const user = userEvent.setup()
      const mockOnShowDeleteConfirm = vi.fn()
      render(<ReviewDisplay {...defaultProps} isOwner onShowDeleteConfirm={mockOnShowDeleteConfirm} />)

      await user.click(screen.getByTitle('削除'))

      expect(mockOnShowDeleteConfirm).toHaveBeenCalled()
    })
  })

  // ============================================================
  // 削除確認
  // ============================================================

  describe('削除確認', () => {
    it('showDeleteConfirmがtrueの場合に確認ボタンが表示される', () => {
      render(<ReviewDisplay {...defaultProps} isOwner showDeleteConfirm />)

      expect(screen.getByText('削除する')).toBeInTheDocument()
      expect(screen.getByText('キャンセル')).toBeInTheDocument()
    })

    it('showDeleteConfirmがtrueの場合に編集・削除ボタンが非表示', () => {
      render(<ReviewDisplay {...defaultProps} isOwner showDeleteConfirm />)

      expect(screen.queryByTitle('編集')).not.toBeInTheDocument()
      expect(screen.queryByTitle('削除')).not.toBeInTheDocument()
    })

    it('削除するボタンをクリックするとonDeleteが呼ばれる', async () => {
      const user = userEvent.setup()
      const mockOnDelete = vi.fn()
      render(<ReviewDisplay {...defaultProps} isOwner showDeleteConfirm onDelete={mockOnDelete} />)

      await user.click(screen.getByText('削除する'))

      expect(mockOnDelete).toHaveBeenCalled()
    })

    it('キャンセルボタンをクリックするとonCancelDeleteが呼ばれる', async () => {
      const user = userEvent.setup()
      const mockOnCancelDelete = vi.fn()
      render(<ReviewDisplay {...defaultProps} isOwner showDeleteConfirm onCancelDelete={mockOnCancelDelete} />)

      await user.click(screen.getByText('キャンセル'))

      expect(mockOnCancelDelete).toHaveBeenCalled()
    })

    it('isPendingがtrueの場合「削除中...」と表示される', () => {
      render(<ReviewDisplay {...defaultProps} isOwner showDeleteConfirm isPending />)

      expect(screen.getByText('削除中...')).toBeInTheDocument()
    })
  })

  // ============================================================
  // 通報ボタン
  // ============================================================

  describe('通報ボタン', () => {
    it('非オーナーのログインユーザーに通報ボタンが表示される', () => {
      render(<ReviewDisplay {...defaultProps} currentUserId="other-user" />)

      expect(screen.getByTestId('report-button')).toBeInTheDocument()
    })

    it('未ログインユーザーには通報ボタンが表示されない', () => {
      render(<ReviewDisplay {...defaultProps} />)

      expect(screen.queryByTestId('report-button')).not.toBeInTheDocument()
    })

    it('オーナーには通報ボタンが表示されない', () => {
      render(<ReviewDisplay {...defaultProps} isOwner currentUserId="user-1" />)

      expect(screen.queryByTestId('report-button')).not.toBeInTheDocument()
    })
  })
})
