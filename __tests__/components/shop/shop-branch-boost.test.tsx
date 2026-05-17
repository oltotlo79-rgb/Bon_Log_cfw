/**
 * Shop components - branch coverage boost tests
 *
 * Targets:
 * - ShopForm: existingId branch in createShop error (line 115-117)
 * - ShopForm: createShop success with shopId
 * - ShopForm: cancel button calls router.back()
 * - ShopForm: delete with no initialData?.id returns early
 * - ShopForm: deleteShop success calls router.replace
 * - ShopForm: confirm dialog cancel
 * - ReviewForm: file size too large error
 * - ReviewForm: XHR error event
 * - ReviewForm: XHR non-200 status
 * - ReviewForm: image limit exceeded
 * - ReviewForm: prepareFileForUpload exception
 * - ReviewForm: rating=0 validation
 * - ReviewForm: content.trim() included in FormData
 * - ReviewForm: onSuccess callback called on success
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { ShopForm } from '@/components/shop/ShopForm'
import { ReviewForm } from '@/components/shop/ReviewForm'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockPush = vi.fn()
const mockBack = vi.fn()
const mockReplace = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    refresh: mockRefresh,
  }),
}))

const mockCreateShop = vi.fn()
const mockUpdateShop = vi.fn()
const mockDeleteShop = vi.fn()
const mockSearchAddressSuggestions = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  createShop: (...args: unknown[]) => mockCreateShop(...args),
  updateShop: (...args: unknown[]) => mockUpdateShop(...args),
  deleteShop: (...args: unknown[]) => mockDeleteShop(...args),
  searchAddressSuggestions: (...args: unknown[]) => mockSearchAddressSuggestions(...args),
  createShopChangeRequest: vi.fn(),
}))

const mockCreateReview = vi.fn()
vi.mock('@/lib/actions/review', () => ({
  createReview: (...args: unknown[]) => mockCreateReview(...args),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

vi.mock('@/components/shop/StarRating', () => ({
  StarRating: ({ rating, interactive, onChange }: { rating: number; size?: string; interactive?: boolean; onChange?: (v: number) => void }) => (
    <div data-testid="star-rating">
      <span data-testid="current-rating">{rating}</span>
      {interactive && [1, 2, 3, 4, 5].map((v) => (
        <button key={v} data-testid={`star-${v}`} onClick={() => onChange?.(v)}>星{v}</button>
      ))}
    </div>
  ),
}))

const mockPrepareFileForUpload = vi.fn()
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: (...args: unknown[]) => mockPrepareFileForUpload(...args),
  formatFileSize: vi.fn((size: number) => `${size}B`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
}))

vi.mock('@/components/shop/BusinessHoursInput', () => ({
  BusinessHoursInput: ({ value, onChange }: { value: string; onChange: (v: string) => void; disabled?: boolean }) => (
    <input data-testid="business-hours-field" value={value} onChange={(e) => onChange(e.target.value)} placeholder="営業時間" />
  ),
}))

const mockGenres = [
  { id: 'genre-1', name: '黒松', category: '松柏類' },
]

const mockInitialData = {
  id: 'shop-1',
  name: 'テスト盆栽園',
  address: '東京都渋谷区',
  latitude: 35.6 as number | null,
  longitude: 139.7 as number | null,
  phone: '03-1234-5678' as string | null,
  website: 'https://example.com' as string | null,
  businessHours: '9:00-17:00' as string | null,
  closedDays: '水曜日' as string | null,
  genres: [mockGenres[0]],
}

describe('ShopForm - branch boost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchAddressSuggestions.mockResolvedValue({ suggestions: [] })
  })

  it('createShop error with existingId shows extended error message', async () => {
    mockCreateShop.mockResolvedValue({
      success: false,
      error: '重複の可能性',
      existingId: 'existing-shop-1',
    })
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('このまま登録')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('このまま登録'))

    await waitFor(() => {
      expect(screen.getByText(/既存の盆栽園を確認しますか/)).toBeInTheDocument()
    })
  })

  it('createShop success with shopId redirects to new shop page', async () => {
    mockCreateShop.mockResolvedValue({ success: true, data: { shopId: 'new-shop-id' } })
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('このまま登録')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('このまま登録'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/shops/new-shop-id')
    })
  })

  it('cancel button calls router.back()', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(mockBack).toHaveBeenCalled()
  })

  it('deleteShop success calls router.replace to /shops', async () => {
    mockDeleteShop.mockResolvedValue({ success: true })
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    fireEvent.click(screen.getByRole('button', { name: 'この盆栽園を削除' }))

    await waitFor(() => {
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('削除する'))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/shops')
    })
  })

  it('confirm dialog cancel button hides dialog and re-enables submit', async () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('戻って位置取得')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('戻って位置取得'))

    await waitFor(() => {
      expect(screen.queryByText('戻って位置取得')).not.toBeInTheDocument()
    })
    // Submit button should be re-enabled
    expect(screen.getByRole('button', { name: '登録する' })).not.toBeDisabled()
  })

  it('create mode shows 登録中... while pending', async () => {
    mockCreateShop.mockImplementation(() => new Promise(() => {}))
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })

    // Need to submit with lat/lng to avoid confirm dialog
    // Set coordinates by calling the component's callback
    // Since there's no direct way, we'll trigger the confirm path and confirm
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('このまま登録')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('このまま登録'))

    await waitFor(() => {
      expect(screen.getByText('登録中...')).toBeInTheDocument()
    })
  })

  it('delete cancel button hides delete dialog', async () => {
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    fireEvent.click(screen.getByRole('button', { name: 'この盆栽園を削除' }))

    await waitFor(() => {
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })

    // Click the cancel button in delete dialog
    const cancelButtons = screen.getAllByRole('button', { name: 'キャンセル' })
    const deleteDialogCancel = cancelButtons[cancelButtons.length - 1]
    fireEvent.click(deleteDialogCancel)

    await waitFor(() => {
      expect(screen.queryByText('盆栽園を削除')).not.toBeInTheDocument()
    })
  })
})

describe('ReviewForm - branch boost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateReview.mockResolvedValue({ success: true })
    mockPrepareFileForUpload.mockResolvedValue(new File(['test'], 'test.jpg', { type: 'image/jpeg' }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rating=0 shows validation error on submit', async () => {
    render(<ReviewForm shopId="shop-1" />)
    // Submit the form directly since button is disabled when rating=0
    const form = document.querySelector('form')!
    fireEvent.submit(form)
    await waitFor(() => {
      expect(screen.getByText('評価を選択してください')).toBeInTheDocument()
    })
  })

  it('image file size too large shows error', async () => {
    render(<ReviewForm shopId="shop-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    const largeFile = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(largeFile, 'size', { value: 15 * 1024 * 1024 })
    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    await waitFor(() => {
      expect(screen.getByText(/MB以下にしてください/)).toBeInTheDocument()
    })
  })

  it('XHR error event shows error', async () => {
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      addEventListener: vi.fn(),
      upload: { addEventListener: vi.fn() },
      status: 200,
      responseText: '{}',
    }
    vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function() { return mockXHR } as unknown as () => XMLHttpRequest)
    mockXHR.send.mockImplementation(() => {
      const errorCb = mockXHR.addEventListener.mock.calls.find((c: [string, () => void]) => c[0] === 'error')?.[1]
      if (errorCb) errorCb()
    })

    render(<ReviewForm shopId="shop-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  it('XHR non-200 response shows error', async () => {
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      addEventListener: vi.fn(),
      upload: { addEventListener: vi.fn() },
      status: 500,
      responseText: 'Server Error',
    }
    vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function() { return mockXHR } as unknown as () => XMLHttpRequest)
    mockXHR.send.mockImplementation(() => {
      const loadCb = mockXHR.addEventListener.mock.calls.find((c: [string, () => void]) => c[0] === 'load')?.[1]
      if (loadCb) loadCb()
    })

    render(<ReviewForm shopId="shop-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  it('prepareFileForUpload exception shows error', async () => {
    mockPrepareFileForUpload.mockRejectedValue(new Error('Compression failed'))

    render(<ReviewForm shopId="shop-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  it('onSuccess callback called after successful review submission', async () => {
    const onSuccess = vi.fn()
    render(<ReviewForm shopId="shop-1" onSuccess={onSuccess} />)
    fireEvent.click(screen.getByTestId('star-4'))
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('content.trim() is included in FormData when present', async () => {
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-4'))
    fireEvent.change(screen.getByPlaceholderText('盆栽園の感想を書いてください...'), {
      target: { value: '  良い盆栽園です  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      const formData = mockCreateReview.mock.calls[0][0] as FormData
      expect(formData.get('content')).toBe('良い盆栽園です')
    })
  })

  it('content not included when only whitespace', async () => {
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-4'))
    fireEvent.change(screen.getByPlaceholderText('盆栽園の感想を書いてください...'), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      const formData = mockCreateReview.mock.calls[0][0] as FormData
      expect(formData.get('content')).toBeNull()
    })
  })
})
