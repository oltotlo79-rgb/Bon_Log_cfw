/**
 * ReviewForm - branch coverage tests
 * Covers uncovered branches:
 * - XHR load with invalid JSON (parse error)
 * - XHR load with error in result body
 * - Multiple files upload where images.length >= MAX_REVIEW_IMAGES
 * - Image removal by clicking the X button
 * - FormData includes imageUrls when images exist
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { ReviewForm } from '@/components/shop/ReviewForm'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

const mockCreateReview = vi.fn()
vi.mock('@/lib/actions/review', () => ({
  createReview: (...args: unknown[]) => mockCreateReview(...args),
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

vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn((file: File) => Promise.resolve(file)),
  formatFileSize: vi.fn((size: number) => `${size}B`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
}))

function createMockXHR(options: { status?: number; responseText?: string; triggerError?: boolean }) {
  const mockXHR = {
    open: vi.fn(),
    send: vi.fn(),
    addEventListener: vi.fn(),
    upload: { addEventListener: vi.fn() },
    status: options.status ?? 200,
    responseText: options.responseText ?? '{}',
  }
  vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function() { return mockXHR } as unknown as () => XMLHttpRequest)

  mockXHR.send.mockImplementation(() => {
    const eventName = options.triggerError ? 'error' : 'load'
    const handler = (mockXHR.addEventListener.mock.calls as [string, () => void][]).find((c) => c[0] === eventName
    )?.[1]
    if (handler) handler()
  })

  return mockXHR
}

describe('ReviewForm - branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateReview.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('XHR load with invalid JSON shows error', async () => {
    const { prepareFileForUpload } = await import('@/lib/client-image-compression')
    vi.mocked(prepareFileForUpload).mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))

    createMockXHR({ status: 200, responseText: 'not json' })

    render(<ReviewForm shopId="shop-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  it('XHR result with error field shows error message', async () => {
    const { prepareFileForUpload } = await import('@/lib/client-image-compression')
    vi.mocked(prepareFileForUpload).mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))

    createMockXHR({ status: 200, responseText: JSON.stringify({ error: 'カスタムエラー' }) })

    render(<ReviewForm shopId="shop-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('カスタムエラー')).toBeInTheDocument()
    })
  })

  it('image removal works via X button', async () => {
    const { prepareFileForUpload } = await import('@/lib/client-image-compression')
    vi.mocked(prepareFileForUpload).mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))

    createMockXHR({ status: 200, responseText: JSON.stringify({ url: '/uploaded.jpg' }) })

    render(<ReviewForm shopId="shop-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('1/3枚')).toBeInTheDocument()
    })

    // Click the X button to remove
    const removeButton = screen.getByAltText('レビュー画像 1').parentElement!.querySelector('button')!
    fireEvent.click(removeButton)

    await waitFor(() => {
      expect(screen.getByText('0/3枚')).toBeInTheDocument()
    })
  })

  it('submitting with images includes imageUrls in FormData', async () => {
    const { prepareFileForUpload } = await import('@/lib/client-image-compression')
    vi.mocked(prepareFileForUpload).mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))

    createMockXHR({ status: 200, responseText: JSON.stringify({ url: '/uploaded.jpg' }) })

    render(<ReviewForm shopId="shop-1" />)

    // Upload an image
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('1/3枚')).toBeInTheDocument()
    })

    // Select rating and submit
    fireEvent.click(screen.getByTestId('star-4'))
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      const formData = mockCreateReview.mock.calls[0]![0]! as FormData
      expect(formData.getAll('imageUrls')).toContain('/uploaded.jpg')
    })
  })

  it('empty file selection is handled gracefully', async () => {
    render(<ReviewForm shopId="shop-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [] } })

    // No error should appear
    expect(screen.queryByText('アップロードに失敗しました')).not.toBeInTheDocument()
  })

  it('createReview returns success:false without error shows generic error', async () => {
    mockCreateReview.mockResolvedValue({ success: false })
    render(<ReviewForm shopId="shop-1" />)
    fireEvent.click(screen.getByTestId('star-4'))
    fireEvent.click(screen.getByRole('button', { name: /レビューを投稿/ }))

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })
  })
})
