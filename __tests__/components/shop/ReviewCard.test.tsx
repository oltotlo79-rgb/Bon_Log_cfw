import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'

// Prisma/DBモック（コンポーネントインポート前に必須）
vi.mock('@/lib/db', () => ({
  prisma: {},
}))

// Server Actions モック（ホイスティング対応）
const mockDeleteReview = vi.fn()
const mockUpdateReview = vi.fn()
vi.mock('@/lib/actions/review', () => ({
  deleteReview: (...args: unknown[]) => mockDeleteReview(...args),
  updateReview: (...args: unknown[]) => mockUpdateReview(...args),
}))

// client-image-compression モック
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn(),
  formatFileSize: vi.fn((size: number) => `${size}B`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
}))

// ReportButton モック
vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: ({ targetType, targetId }: { targetType: string; targetId: string }) => (
    <button data-testid="report-button" data-target-type={targetType} data-target-id={targetId}>通報</button>
  ),
}))

// StarRating モック
vi.mock('@/components/shop/StarRating', () => ({
  StarRatingDisplay: ({ rating }: { rating: number; size?: string }) => (
    <div data-testid="star-rating-display">星{rating}</div>
  ),
  StarRatingInput: ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div data-testid="star-rating-input">
      <span data-testid="edit-rating">{value}</span>
      {[1, 2, 3, 4, 5].map((v) => (
        <button key={v} data-testid={`edit-star-${v}`} onClick={() => onChange(v)}>
          星{v}
        </button>
      ))}
    </div>
  ),
}))

// date-fns モック
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '3時間前'),
}))
vi.mock('date-fns/locale', () => ({
  ja: {},
}))

// next/image モック
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, className }: { src: string; alt: string; fill?: boolean; className?: string; width?: number; height?: number }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}))

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

import { ReviewCard } from '@/components/shop/ReviewCard'

const mockReview = {
  id: 'review-1',
  rating: 4,
  content: 'とても良い盆栽園でした',
  createdAt: new Date('2024-06-01'),
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
    { id: 'img-3', url: '/image3.jpg' },
  ],
}

describe('ReviewCard', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteReview.mockResolvedValue({ success: true })
    mockUpdateReview.mockResolvedValue({ success: true })
  })

  it('レビュー内容を表示する', () => {
    render(<ReviewCard review={mockReview} />)
    expect(screen.getByText('とても良い盆栽園でした')).toBeInTheDocument()
  })

  it('レビューアーのニックネームを表示する', () => {
    render(<ReviewCard review={mockReview} />)
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
  })

  it('アバターがない場合はイニシャルを表示する', () => {
    render(<ReviewCard review={mockReview} />)
    expect(screen.getByText('テ')).toBeInTheDocument()
  })

  it('アバターがある場合はアバター画像を表示する', () => {
    const { container } = render(<ReviewCard review={mockReviewWithAvatar} />)
    const img = container.querySelector('img[src="/avatar.jpg"]')
    expect(img).toBeInTheDocument()
  })

  it('星評価を表示する', () => {
    render(<ReviewCard review={mockReview} />)
    expect(screen.getByTestId('star-rating-display')).toHaveTextContent('星4')
  })

  it('レビュー日時を表示する', () => {
    render(<ReviewCard review={mockReview} />)
    expect(screen.getByText('3時間前')).toBeInTheDocument()
  })

  it('レビュー画像を表示する', () => {
    const { container } = render(<ReviewCard review={mockReviewWithImages} />)
    expect(container.querySelectorAll('img[src="/image1.jpg"]')).toHaveLength(1)
    expect(container.querySelectorAll('img[src="/image2.jpg"]')).toHaveLength(1)
    expect(container.querySelectorAll('img[src="/image3.jpg"]')).toHaveLength(1)
  })

  it('オーナーには編集ボタンを表示する', () => {
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)
    expect(screen.getByTitle('編集')).toBeInTheDocument()
  })

  it('オーナーには削除ボタンを表示する', () => {
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)
    expect(screen.getByTitle('削除')).toBeInTheDocument()
  })

  it('非オーナーには編集・削除ボタンを表示しない', () => {
    render(<ReviewCard review={mockReview} currentUserId="other-user" />)
    expect(screen.queryByTitle('編集')).not.toBeInTheDocument()
    expect(screen.queryByTitle('削除')).not.toBeInTheDocument()
  })

  it('非オーナーのログインユーザーには通報ボタンを表示する', () => {
    render(<ReviewCard review={mockReview} currentUserId="other-user" />)
    expect(screen.getByTestId('report-button')).toBeInTheDocument()
  })

  it('編集ボタンクリックで編集モードに入る', async () => {
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('編集'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('とても良い盆栽園でした')).toBeInTheDocument()
    })
  })

  it('編集モードでテキストエリアが表示される', async () => {
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('編集'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('とても良い盆栽園でした')).toBeInTheDocument()
    })
  })

  it('編集モードで星評価入力が表示される', async () => {
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('編集'))

    await waitFor(() => {
      expect(screen.getByTestId('star-rating-input')).toBeInTheDocument()
    })
  })

  it('編集を保存できる', async () => {
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('編集'))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(mockUpdateReview).toHaveBeenCalledWith('review-1', expect.any(FormData))
    })
  })

  it('編集をキャンセルできる', async () => {
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('編集'))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    await waitFor(() => {
      // 通常表示モードに戻る
      expect(screen.getByText('とても良い盆栽園でした')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('とても良い盆栽園でした')).not.toBeInTheDocument()
    })
  })

  it('削除ボタンで確認ダイアログを表示する', async () => {
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('削除'))

    await waitFor(() => {
      expect(screen.getByText('キャンセル')).toBeInTheDocument()
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })
  })

  it('削除確認でdeleteReviewを呼ぶ', async () => {
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('削除'))
    await waitFor(() => {
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })

    await user.click(screen.getByText('削除する'))

    await waitFor(() => {
      expect(mockDeleteReview).toHaveBeenCalledWith('review-1')
    })
  })

  it('削除キャンセルでダイアログを閉じる', async () => {
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('削除'))
    await waitFor(() => {
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })

    await user.click(screen.getByText('キャンセル'))

    await waitFor(() => {
      expect(screen.queryByText('削除する')).not.toBeInTheDocument()
    })
  })

  it('削除成功後にrouter.refreshを呼ぶ', async () => {
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('削除'))
    await waitFor(() => {
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })

    await user.click(screen.getByText('削除する'))

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('画像なしのレビューが正常にレンダリングされる', () => {
    render(<ReviewCard review={mockReview} />)
    expect(screen.getByText('とても良い盆栽園でした')).toBeInTheDocument()
  })

  it('複数画像のレビューが正常にレンダリングされる', () => {
    const { container } = render(<ReviewCard review={mockReviewWithImages} />)
    const images = container.querySelectorAll('img[alt="レビュー画像"]')
    expect(images).toHaveLength(3)
  })

  it('相対時間フォーマットで日時を表示する', () => {
    render(<ReviewCard review={mockReview} />)
    expect(screen.getByText('3時間前')).toBeInTheDocument()
  })

  it('未ログインユーザーには操作ボタンを表示しない', () => {
    render(<ReviewCard review={mockReview} />)
    expect(screen.queryByTitle('編集')).not.toBeInTheDocument()
    expect(screen.queryByTitle('削除')).not.toBeInTheDocument()
    expect(screen.queryByTestId('report-button')).not.toBeInTheDocument()
  })

  it('contentがnullのレビューはコメントを表示しない', () => {
    const reviewNoContent = { ...mockReview, content: null }
    render(<ReviewCard review={reviewNoContent} />)
    expect(screen.queryByText('とても良い盆栽園でした')).not.toBeInTheDocument()
  })

  describe('編集モード - 画像操作', async () => {
    it('編集モードで既存画像を表示する', async () => {
      const user = userEvent.setup()
      render(<ReviewCard review={mockReviewWithImages} currentUserId="user-1" />)

      await user.click(screen.getByTitle('編集'))

      await waitFor(() => {
        expect(screen.getByText('画像 (3/3枚)')).toBeInTheDocument()
      })
    })

    it('既存画像を削除マークできる', async () => {
      const user = userEvent.setup()
      const { container } = render(<ReviewCard review={mockReviewWithImages} currentUserId="user-1" />)

      await user.click(screen.getByTitle('編集'))

      await waitFor(() => {
        expect(screen.getByText('画像 (3/3枚)')).toBeInTheDocument()
      })

      // Click the X button on first image
      const deleteButtons = container.querySelectorAll('.bg-destructive.text-destructive-foreground.rounded-full')
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0])
      }

      await waitFor(() => {
        // Image count should decrease
        expect(screen.getByText('画像 (2/3枚)')).toBeInTheDocument()
      })
    })

    it('削除マークした画像を復元できる', async () => {
      const user = userEvent.setup()
      const { container } = render(<ReviewCard review={mockReviewWithImages} currentUserId="user-1" />)

      await user.click(screen.getByTitle('編集'))

      await waitFor(() => {
        expect(screen.getByText('画像 (3/3枚)')).toBeInTheDocument()
      })

      // Delete mark an image
      const deleteButtons = container.querySelectorAll('.bg-destructive.text-destructive-foreground.rounded-full')
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0])
      }

      await waitFor(() => {
        expect(screen.getByText('画像 (2/3枚)')).toBeInTheDocument()
      })

      // Restore the deleted image
      const restoreBtn = screen.getByText('元に戻す')
      fireEvent.click(restoreBtn)

      await waitFor(() => {
        expect(screen.getByText('画像 (3/3枚)')).toBeInTheDocument()
      })
    })

    it('編集モードで評価を変更できる', async () => {
      const user = userEvent.setup()
      render(<ReviewCard review={mockReview} currentUserId="user-1" />)

      await user.click(screen.getByTitle('編集'))

      await waitFor(() => {
        expect(screen.getByTestId('star-rating-input')).toBeInTheDocument()
      })

      // Change rating to 5
      fireEvent.click(screen.getByTestId('edit-star-5'))

      await waitFor(() => {
        expect(screen.getByTestId('edit-rating')).toHaveTextContent('5')
      })
    })

    it('編集モードでコメントを変更できる', async () => {
      const user = userEvent.setup()
      render(<ReviewCard review={mockReview} currentUserId="user-1" />)

      await user.click(screen.getByTitle('編集'))

      await waitFor(() => {
        const textarea = screen.getByDisplayValue('とても良い盆栽園でした')
        fireEvent.change(textarea, { target: { value: '更新されたコメント' } })
        expect(screen.getByDisplayValue('更新されたコメント')).toBeInTheDocument()
      })
    })

    it('更新エラー時にエラーメッセージを表示する', async () => {
      mockUpdateReview.mockResolvedValue({ error: '更新に失敗しました' })
      const user = userEvent.setup()
      render(<ReviewCard review={mockReview} currentUserId="user-1" />)

      await user.click(screen.getByTitle('編集'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '保存' }))

      await waitFor(() => {
        expect(screen.getByText('更新に失敗しました')).toBeInTheDocument()
      })
    })

    it('画像上限に達した場合にエラーを表示する', async () => {
      const user = userEvent.setup()
      const { container } = render(<ReviewCard review={mockReviewWithImages} currentUserId="user-1" />)

      await user.click(screen.getByTitle('編集'))

      await waitFor(() => {
        expect(screen.getByText('画像 (3/3枚)')).toBeInTheDocument()
      })

      // Try to upload when at limit
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('画像は3枚までです')).toBeInTheDocument()
      })
    })

    it('画像サイズ超過でエラーを表示する', async () => {
      const user = userEvent.setup()
      const { container } = render(<ReviewCard review={mockReview} currentUserId="user-1" />)

      await user.click(screen.getByTitle('編集'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
      })

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const bigFile = new File(['test'], 'big.jpg', { type: 'image/jpeg' })
      Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 })
      fireEvent.change(fileInput, { target: { files: [bigFile] } })

      await waitFor(() => {
        expect(screen.getByText(/画像は.*MB以下にしてください/)).toBeInTheDocument()
      })
    })

    it('画像アップロード成功時に新規画像が追加される', async () => {
       
      const { prepareFileForUpload } = await import('@/lib/client-image-compression')
      prepareFileForUpload.mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))

      // Mock XHR
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        addEventListener: vi.fn(),
        status: 200,
        responseText: JSON.stringify({ url: '/uploaded.jpg' }),
      }
      vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function() { return mockXHR } as unknown as () => XMLHttpRequest)
      mockXHR.send.mockImplementation(() => {
        const loadHandler = mockXHR.addEventListener.mock.calls.find(
          (c: [string, () => void]) => c[0] === 'load'
        )?.[1]
        if (loadHandler) loadHandler()
      })

      const user = userEvent.setup()
      const { container } = render(<ReviewCard review={mockReview} currentUserId="user-1" />)

      await user.click(screen.getByTitle('編集'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
      })

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1024 })
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('画像 (1/3枚)')).toBeInTheDocument()
      })

      vi.restoreAllMocks()
    })

    it('画像アップロードXHRエラー時にエラーを表示する', async () => {
       
      const { prepareFileForUpload } = await import('@/lib/client-image-compression')
      prepareFileForUpload.mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))

      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        addEventListener: vi.fn(),
      }
      vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function() { return mockXHR } as unknown as () => XMLHttpRequest)
      mockXHR.send.mockImplementation(() => {
        const errorHandler = mockXHR.addEventListener.mock.calls.find(
          (c: [string, () => void]) => c[0] === 'error'
        )?.[1]
        if (errorHandler) errorHandler()
      })

      const user = userEvent.setup()
      const { container } = render(<ReviewCard review={mockReview} currentUserId="user-1" />)

      await user.click(screen.getByTitle('編集'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
      })

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1024 })
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
      })

      vi.restoreAllMocks()
    })

    it('圧縮エラー時にエラーを表示する', async () => {
       
      const { prepareFileForUpload } = await import('@/lib/client-image-compression')
      prepareFileForUpload.mockRejectedValue(new Error('compression failed'))

      const user = userEvent.setup()
      const { container } = render(<ReviewCard review={mockReview} currentUserId="user-1" />)

      await user.click(screen.getByTitle('編集'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
      })

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1024 })
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
      })
    })

    it('編集キャンセルで画像状態がリセットされる', async () => {
      const user = userEvent.setup()
      const { container } = render(<ReviewCard review={mockReviewWithImages} currentUserId="user-1" />)

      await user.click(screen.getByTitle('編集'))

      await waitFor(() => {
        expect(screen.getByText('画像 (3/3枚)')).toBeInTheDocument()
      })

      // Delete mark one image
      const deleteButtons = container.querySelectorAll('.bg-destructive.text-destructive-foreground.rounded-full')
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0])
      }

      // Cancel editing
      await user.click(screen.getByRole('button', { name: 'キャンセル' }))

      // Should return to display mode
      await waitFor(() => {
        expect(screen.queryByText('画像 (2/3枚)')).not.toBeInTheDocument()
      })
    })
  })
})
