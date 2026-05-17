/**
 * BonsaiRecordForm - uncovered branch tests
 *
 * Targets:
 * - handleSubmit with empty content and no images (validation line 185-188)
 * - handleSubmit with images (upload flow)
 * - Upload response without url field
 * - Multiple images sliced to max 4
 * - handleImageSelect with null files
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { BonsaiRecordForm } from '@/components/bonsai/BonsaiRecordForm'

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
    refresh: mockRefresh,
  }),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, fill, className }: { src: string; alt: string; fill?: boolean; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-fill={fill ? 'true' : undefined} className={className} />
  ),
}))

const mockAddBonsaiRecord = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  addBonsaiRecord: (...args: unknown[]) => mockAddBonsaiRecord(...args),
}))

const mockPrepareFileForUpload = vi.fn()
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: (...args: unknown[]) => mockPrepareFileForUpload(...args),
  formatFileSize: vi.fn((size: number) => `${size}B`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockCreateObjectURL = vi.fn(() => 'blob:test-url')
const mockRevokeObjectURL = vi.fn()
URL.createObjectURL = mockCreateObjectURL
URL.revokeObjectURL = mockRevokeObjectURL

describe('BonsaiRecordForm - uncovered branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddBonsaiRecord.mockResolvedValue({ success: true })
    mockPrepareFileForUpload.mockResolvedValue(new File(['test'], 'test.jpg', { type: 'image/jpeg' }))
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ url: '/uploaded-image.jpg' }),
    })
  })

  // ----------------------------------------------------------------
  // Submit with empty form triggers validation error
  // ----------------------------------------------------------------
  it('テキストも画像もない場合にバリデーションエラーを表示する', async () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    // Directly submit the form (bypass button disabled check)
    const form = document.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('テキストまたは画像を入力してください')).toBeInTheDocument()
    })
    expect(mockAddBonsaiRecord).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // Submit with images triggers upload flow
  // ----------------------------------------------------------------
  it('画像付きで送信するとアップロードフローが実行される', async () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    // Add an image
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    // Submit
    const form = document.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockPrepareFileForUpload).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/upload/avatar', expect.any(Object))
    })

    await waitFor(() => {
      expect(mockAddBonsaiRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          bonsaiId: 'bonsai-1',
          imageUrls: ['/uploaded-image.jpg'],
        })
      )
    })
  })

  // ----------------------------------------------------------------
  // Upload response without url field
  // ----------------------------------------------------------------
  it('アップロードレスポンスにurlがない場合はimageUrlsに含まれない', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ error: 'upload failed' }),
    })

    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    // Add an image
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    // Submit
    const form = document.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockAddBonsaiRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          bonsaiId: 'bonsai-1',
          imageUrls: undefined, // No images uploaded successfully
        })
      )
    })
  })

  // ----------------------------------------------------------------
  // handleImageSelect with null files
  // ----------------------------------------------------------------
  it('ファイルがnullの場合は何も起きない', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    // Simulate change event with null files
    Object.defineProperty(fileInput, 'files', { value: null, configurable: true })
    fireEvent.change(fileInput)

    expect(mockCreateObjectURL).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // addBonsaiRecord error with null error field
  // ----------------------------------------------------------------
  it('記録作成でerrorがnullの場合にデフォルトエラーを表示する', async () => {
    mockAddBonsaiRecord.mockResolvedValue({ error: null })
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    fireEvent.change(screen.getByPlaceholderText(/成長の様子/), { target: { value: 'テスト' } })
    fireEvent.click(screen.getByRole('button', { name: '記録する' }))

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Multiple images sliced to max 4
  // ----------------------------------------------------------------
  it('5枚以上の画像を選択しても4枚までに制限される', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    const files = Array.from({ length: 6 }, (_, i) =>
      new File(['test'], `test${i}.jpg`, { type: 'image/jpeg' })
    )

    fireEvent.change(fileInput, { target: { files } })

    // Should have called createObjectURL for all 6, but only 4 stored
    // We count the image previews
    const images = document.querySelectorAll('img[src="blob:test-url"]')
    expect(images.length).toBeLessThanOrEqual(4)
  })

  // ----------------------------------------------------------------
  // Content-only submission (no images)
  // ----------------------------------------------------------------
  it('テキストのみで画像なしの場合にimageUrlsがundefinedで送信される', async () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    fireEvent.change(screen.getByPlaceholderText(/成長の様子/), { target: { value: 'テストのみ' } })
    fireEvent.click(screen.getByRole('button', { name: '記録する' }))

    await waitFor(() => {
      expect(mockAddBonsaiRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          bonsaiId: 'bonsai-1',
          content: 'テストのみ',
          imageUrls: undefined,
        })
      )
    })
  })
})
