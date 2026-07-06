import { vi } from 'vitest'
/**
 * ReviewCard の追加カバレッジテスト
 *
 * 対象:
 * - handleDelete: deleteReview 失敗時に router.refresh を呼ばない
 * - handleEdit: review.content が null の場合 editContent が空文字になる
 * - handleImageUpload: file 未選択時の早期 return / XHR が非 2xx ステータスを返す場合 /
 *   result.url も result.error も無い場合
 * - handleSaveEdit: deleteImageIds / newImages が非空の場合の FormData 追加 (forEach) /
 *   updateReview 失敗が error フィールドを持たない場合のフォールバックメッセージ
 * - onRemoveNewImage: 新規アップロード画像の削除
 */

import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

vi.mock('@/lib/db', () => ({ prisma: {} }))

const mockDeleteReview = vi.fn()
const mockUpdateReview = vi.fn()
vi.mock('@/lib/actions/review', () => ({
  deleteReview: (...args: unknown[]) => mockDeleteReview(...args),
  updateReview: (...args: unknown[]) => mockUpdateReview(...args),
}))

vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn(),
  formatFileSize: vi.fn((size: number) => `${size}B`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
}))

vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: () => <button data-testid="report-button">通報</button>,
}))

vi.mock('@/components/shop/StarRating', () => ({
  StarRatingDisplay: ({ rating }: { rating: number }) => (
    <div data-testid="star-rating-display">星{rating}</div>
  ),
  StarRatingInput: ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div data-testid="star-rating-input">
      <span data-testid="edit-rating">{value}</span>
      {[1, 2, 3, 4, 5].map((v) => (
        <button key={v} data-testid={`edit-star-${v}`} onClick={() => onChange(v)}>星{v}</button>
      ))}
    </div>
  ),
}))

vi.mock('date-fns', () => ({ formatDistanceToNow: vi.fn(() => '3時間前') }))
vi.mock('date-fns/locale', () => ({ ja: {} }))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ data: { user: { id: 'test-user-id' } }, status: 'authenticated' }),
}))

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

import { ReviewCard } from '@/components/shop/ReviewCard'

const mockReview = {
  id: 'review-1',
  rating: 4,
  content: 'とても良い盆栽園でした',
  createdAt: new Date('2024-06-01'),
  user: { id: 'user-1', nickname: 'テストユーザー', avatarUrl: null },
  images: [],
}

const mockReviewNoContent = { ...mockReview, content: null }

function setupUploadXhr({ status, responseText }: { status: number; responseText: string }) {
  const mockXHR = {
    open: vi.fn(),
    send: vi.fn(),
    addEventListener: vi.fn(),
    status,
    responseText,
  }
  vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function () {
    return mockXHR
  } as unknown as () => XMLHttpRequest)
  mockXHR.send.mockImplementation(() => {
    const loadHandler = (mockXHR.addEventListener.mock.calls as [string, () => void][]).find(
      (c) => c[0] === 'load',
    )?.[1]
    if (loadHandler) loadHandler()
  })
  return mockXHR
}

describe('ReviewCard - 追加カバレッジテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteReview.mockResolvedValue({ success: true })
    mockUpdateReview.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deleteReview が失敗した場合、router.refresh を呼ばない', async () => {
    mockDeleteReview.mockResolvedValue({ success: false, error: '削除に失敗しました' })
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('削除'))
    await waitFor(() => expect(screen.getByText('削除する')).toBeInTheDocument())
    await user.click(screen.getByText('削除する'))

    await waitFor(() => {
      expect(mockDeleteReview).toHaveBeenCalledWith('review-1')
    })
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('review.content が null の場合、編集モードのコメント欄は空文字になる', async () => {
    const user = userEvent.setup()
    const { container } = render(<ReviewCard review={mockReviewNoContent} currentUserId="user-1" />)

    await user.click(screen.getByTitle('編集'))

    await waitFor(() => {
      const textarea = container.querySelector('textarea')
      expect(textarea).toHaveValue('')
    })
  })

  it('ファイル未選択で画像入力が変更されても状態は変わらない', async () => {
    const user = userEvent.setup()
    const { container } = render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('編集'))
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument())

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [] } })

    // エラーメッセージも新規画像も出ない (早期 return)
    expect(screen.queryByText(/アップロードに失敗/)).not.toBeInTheDocument()
    expect(screen.queryByText('画像 (1/3枚)')).not.toBeInTheDocument()
  })

  it('XHRが非2xxステータスを返す場合エラーメッセージを表示する', async () => {
    const { prepareFileForUpload } = await import('@/lib/client-image-compression')
    vi.mocked(prepareFileForUpload).mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))
    setupUploadXhr({ status: 500, responseText: '' })

    const user = userEvent.setup()
    const { container } = render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('編集'))
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument())

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  it('レスポンスに url も error も無い場合、新規画像は追加されない', async () => {
    const { prepareFileForUpload } = await import('@/lib/client-image-compression')
    vi.mocked(prepareFileForUpload).mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))
    setupUploadXhr({ status: 200, responseText: JSON.stringify({}) })

    const user = userEvent.setup()
    const { container } = render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('編集'))
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument())

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(fileInput.value).toBe('')
    })
    expect(screen.queryByText('画像 (1/3枚)')).not.toBeInTheDocument()
    expect(screen.queryByText(/アップロードに失敗/)).not.toBeInTheDocument()
  })

  it('新規アップロード画像を削除できる', async () => {
    const { prepareFileForUpload } = await import('@/lib/client-image-compression')
    vi.mocked(prepareFileForUpload).mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))
    setupUploadXhr({ status: 200, responseText: JSON.stringify({ url: '/uploaded.jpg' }) })

    const user = userEvent.setup()
    const { container } = render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('編集'))
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument())

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByAltText('新規画像 1')).toBeInTheDocument()
    })

    const newImageContainer = screen.getByAltText('新規画像 1').closest('div')!
    fireEvent.click(newImageContainer.querySelector('button')!)

    await waitFor(() => {
      expect(screen.queryByAltText('新規画像 1')).not.toBeInTheDocument()
    })
    expect(screen.getByText('画像 (0/3枚)')).toBeInTheDocument()
  })

  it('削除マークした既存画像・新規画像を含めて保存すると FormData に反映される', async () => {
    const { prepareFileForUpload } = await import('@/lib/client-image-compression')
    vi.mocked(prepareFileForUpload).mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))
    setupUploadXhr({ status: 200, responseText: JSON.stringify({ url: '/uploaded.jpg' }) })

    const reviewWithImage = {
      ...mockReview,
      images: [{ id: 'img-1', url: '/image1.jpg' }],
    }

    const user = userEvent.setup()
    const { container } = render(<ReviewCard review={reviewWithImage} currentUserId="user-1" />)

    await user.click(screen.getByTitle('編集'))
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument())

    // 既存画像を削除マーク
    const deleteExistingButton = container.querySelector('.bg-destructive.text-destructive-foreground.rounded-full')
    fireEvent.click(deleteExistingButton!)

    // 新規画像を追加
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByAltText('新規画像 1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(mockUpdateReview).toHaveBeenCalledTimes(1)
    })
    const [, formData] = mockUpdateReview.mock.calls[0]! as [string, FormData]
    expect(formData.getAll('deleteImageIds')).toEqual(['img-1'])
    expect(formData.getAll('imageUrls')).toEqual(['/uploaded.jpg'])
  })

  it('updateReview 失敗が error フィールドを持たない場合、フォールバックメッセージを表示する', async () => {
    mockUpdateReview.mockResolvedValue({ success: false })
    const user = userEvent.setup()
    render(<ReviewCard review={mockReview} currentUserId="user-1" />)

    await user.click(screen.getByTitle('編集'))
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(screen.getByText(MSG_ERROR_FALLBACK)).toBeInTheDocument()
    })
  })
})
