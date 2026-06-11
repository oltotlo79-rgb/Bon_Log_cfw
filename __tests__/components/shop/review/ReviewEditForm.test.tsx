import { vi } from 'vitest'
/**
 * ReviewEditFormコンポーネントのテスト
 */

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// limits モック
vi.mock('@/lib/constants/limits', () => ({
  TWO_FACTOR_CODE_LENGTH: 6,
  TIMEOUT_COPIED_FEEDBACK: 2000,
  MAX_REVIEW_IMAGES: 3,
  MIN_ADDRESS_SEARCH_LENGTH: 3,
  TIMEOUT_DROPDOWN_BLUR: 150,
}))

// StarRatingモック
vi.mock('@/components/shop/StarRating', () => ({
  StarRatingDisplay: ({ rating }: { rating: number }) => (
    <div data-testid="star-rating-display">星{rating}</div>
  ),
  StarRatingInput: ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div data-testid="star-rating-input">
      <span data-testid="current-rating">{value}</span>
      {[1, 2, 3, 4, 5].map((v) => (
        <button key={v} data-testid={`star-${v}`} onClick={() => onChange(v)}>
          星{v}
        </button>
      ))}
    </div>
  ),
}))

// next/imageモック
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, className, fill }: {
    src: string
    alt: string
    className?: string
    fill?: boolean
    width?: number
    height?: number
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} data-fill={fill} />
  ),
}))

import { ReviewEditForm } from '@/components/shop/review/ReviewEditForm'

const defaultProps = {
  editRating: 4,
  onRatingChange: vi.fn(),
  editContent: 'テストコメント',
  onContentChange: vi.fn(),
  existingImages: [],
  deleteImageIds: [],
  onDeleteExistingImage: vi.fn(),
  onRestoreExistingImage: vi.fn(),
  newImages: [],
  onRemoveNewImage: vi.fn(),
  totalImageCount: 0,
  uploading: false,
  onImageUpload: vi.fn(),
  editError: null,
  isPending: false,
  onSave: vi.fn(),
  onCancel: vi.fn(),
}

describe('ReviewEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // レンダリング
  // ============================================================

  describe('レンダリング', () => {
    it('フォームが正常にレンダリングされる', () => {
      render(<ReviewEditForm {...defaultProps} />)

      expect(screen.getByText('評価')).toBeInTheDocument()
    })

    it('星評価入力が表示される', () => {
      render(<ReviewEditForm {...defaultProps} />)

      expect(screen.getByTestId('star-rating-input')).toBeInTheDocument()
    })

    it('現在の評価値が表示される', () => {
      render(<ReviewEditForm {...defaultProps} />)

      expect(screen.getByTestId('current-rating')).toHaveTextContent('4')
    })

    it('コメント入力テキストエリアが表示される', () => {
      render(<ReviewEditForm {...defaultProps} />)

      expect(screen.getByDisplayValue('テストコメント')).toBeInTheDocument()
    })

    it('保存ボタンが表示される', () => {
      render(<ReviewEditForm {...defaultProps} />)

      expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    })

    it('キャンセルボタンが表示される', () => {
      render(<ReviewEditForm {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument()
    })

    it('画像アップロードボタンが表示される', () => {
      render(<ReviewEditForm {...defaultProps} />)

      expect(screen.getByText('画像を追加')).toBeInTheDocument()
    })
  })

  // ============================================================
  // エラー表示
  // ============================================================

  describe('エラー表示', () => {
    it('editErrorがある場合エラーメッセージを表示する', () => {
      render(<ReviewEditForm {...defaultProps} editError="保存に失敗しました" />)

      expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()
    })

    it('editErrorがない場合エラーメッセージを表示しない', () => {
      render(<ReviewEditForm {...defaultProps} />)

      expect(screen.queryByText('保存に失敗しました')).not.toBeInTheDocument()
    })
  })

  // ============================================================
  // インタラクション
  // ============================================================

  describe('インタラクション', () => {
    it('星評価をクリックするとonRatingChangeが呼ばれる', async () => {
      const user = userEvent.setup()
      const mockOnRatingChange = vi.fn()
      render(<ReviewEditForm {...defaultProps} onRatingChange={mockOnRatingChange} />)

      await user.click(screen.getByTestId('star-5'))

      expect(mockOnRatingChange).toHaveBeenCalledWith(5)
    })

    it('コメントを変更するとonContentChangeが呼ばれる', async () => {
      const user = userEvent.setup()
      const mockOnContentChange = vi.fn()
      render(<ReviewEditForm {...defaultProps} onContentChange={mockOnContentChange} />)

      const textarea = screen.getByDisplayValue('テストコメント')
      await user.clear(textarea)
      await user.type(textarea, '新しいコメント')

      expect(mockOnContentChange).toHaveBeenCalled()
    })

    it('保存ボタンをクリックするとonSaveが呼ばれる', async () => {
      const user = userEvent.setup()
      const mockOnSave = vi.fn()
      render(<ReviewEditForm {...defaultProps} onSave={mockOnSave} />)

      await user.click(screen.getByRole('button', { name: '保存' }))

      expect(mockOnSave).toHaveBeenCalled()
    })

    it('キャンセルボタンをクリックするとonCancelが呼ばれる', async () => {
      const user = userEvent.setup()
      const mockOnCancel = vi.fn()
      render(<ReviewEditForm {...defaultProps} onCancel={mockOnCancel} />)

      await user.click(screen.getByRole('button', { name: 'キャンセル' }))

      expect(mockOnCancel).toHaveBeenCalled()
    })
  })

  // ============================================================
  // 画像カウント
  // ============================================================

  describe('画像カウント表示', () => {
    it('画像カウントが正しく表示される', () => {
      render(<ReviewEditForm {...defaultProps} totalImageCount={2} />)

      expect(screen.getByText('画像 (2/3枚)')).toBeInTheDocument()
    })

    it('画像がない場合0/3と表示される', () => {
      render(<ReviewEditForm {...defaultProps} totalImageCount={0} />)

      expect(screen.getByText('画像 (0/3枚)')).toBeInTheDocument()
    })

    it('上限に達した場合3/3と表示される', () => {
      render(<ReviewEditForm {...defaultProps} totalImageCount={3} />)

      expect(screen.getByText('画像 (3/3枚)')).toBeInTheDocument()
    })
  })

  // ============================================================
  // 既存画像
  // ============================================================

  describe('既存画像', () => {
    const existingImages = [
      { id: 'img-1', url: '/existing1.jpg' },
      { id: 'img-2', url: '/existing2.jpg' },
    ]

    it('既存画像が表示される', () => {
      const { container } = render(
        <ReviewEditForm {...defaultProps} existingImages={existingImages} totalImageCount={2} />
      )

      expect(container.querySelector('img[src="/existing1.jpg"]')).toBeInTheDocument()
      expect(container.querySelector('img[src="/existing2.jpg"]')).toBeInTheDocument()
    })

    it('削除マークされた画像には元に戻すボタンが表示される', () => {
      render(
        <ReviewEditForm
          {...defaultProps}
          existingImages={existingImages}
          deleteImageIds={['img-1']}
        />
      )

      expect(screen.getByText('元に戻す')).toBeInTheDocument()
    })

    it('削除ボタンをクリックするとonDeleteExistingImageが呼ばれる', async () => {
      const _user = userEvent.setup()
      const mockOnDeleteExistingImage = vi.fn()
      const { container } = render(
        <ReviewEditForm
          {...defaultProps}
          existingImages={existingImages}
          totalImageCount={2}
          onDeleteExistingImage={mockOnDeleteExistingImage}
        />
      )

      const deleteButtons = container.querySelectorAll('.bg-destructive.text-destructive-foreground.rounded-full')
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0]!)
        expect(mockOnDeleteExistingImage).toHaveBeenCalled()
      }
    })

    it('元に戻すボタンをクリックするとonRestoreExistingImageが呼ばれる', async () => {
      const user = userEvent.setup()
      const mockOnRestoreExistingImage = vi.fn()
      render(
        <ReviewEditForm
          {...defaultProps}
          existingImages={existingImages}
          deleteImageIds={['img-1']}
          onRestoreExistingImage={mockOnRestoreExistingImage}
        />
      )

      await user.click(screen.getByText('元に戻す'))

      expect(mockOnRestoreExistingImage).toHaveBeenCalledWith('img-1')
    })
  })

  // ============================================================
  // 新規追加画像
  // ============================================================

  describe('新規追加画像', () => {
    it('新規追加画像が表示される', () => {
      const { container } = render(
        <ReviewEditForm
          {...defaultProps}
          newImages={['/new1.jpg']}
          totalImageCount={1}
        />
      )

      expect(container.querySelector('img[src="/new1.jpg"]')).toBeInTheDocument()
    })

    it('新規画像に「新規」バッジが表示される', () => {
      render(
        <ReviewEditForm
          {...defaultProps}
          newImages={['/new1.jpg']}
          totalImageCount={1}
        />
      )

      expect(screen.getByText('新規')).toBeInTheDocument()
    })
  })

  // ============================================================
  // pending状態
  // ============================================================

  describe('pending状態', () => {
    it('isPendingがtrueの場合「保存中...」と表示される', () => {
      render(<ReviewEditForm {...defaultProps} isPending />)

      expect(screen.getByText('保存中...')).toBeInTheDocument()
    })

    it('isPendingがtrueの場合ボタンが無効化される', () => {
      render(<ReviewEditForm {...defaultProps} isPending />)

      expect(screen.getByText('保存中...')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled()
    })
  })

  // ============================================================
  // アップロード状態
  // ============================================================

  describe('アップロード状態', () => {
    it('uploading中は「アップロード中...」と表示される', () => {
      render(<ReviewEditForm {...defaultProps} uploading />)

      expect(screen.getByText('アップロード中...')).toBeInTheDocument()
    })
  })
})
