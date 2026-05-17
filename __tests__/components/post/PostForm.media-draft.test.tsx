/**
 * PostForm - draft save with media files (lines 188, 428)
 *
 * Covers:
 * - Line 188: mediaUrls: mediaFiles.map((m) => m.url) in auto-save effect
 *   The arrow function (m) => m.url must be called, requiring non-empty mediaFiles
 * - Line 428: mediaUrls: mediaFiles.map((m) => m.url) in handleSaveDraft
 * - Line 418-419: defensive check (content.length === 0 && mediaFiles.length === 0)
 *   Reachable only if button disabled prop is bypassed
 *
 * We mock XMLHttpRequest to simulate successful image upload so mediaFiles gets populated.
 */
import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '../../utils/test-utils'
import { PostForm } from '@/components/post/PostForm'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: mockPush,
  }),
}))

const mockCreatePost = vi.fn()
vi.mock('@/lib/actions/post', () => ({
  createPost: (...args: unknown[]) => mockCreatePost(...args),
}))

const mockSaveDraft = vi.fn()
vi.mock('@/lib/actions/draft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
}))

vi.mock('@/lib/actions/mention', () => ({
  searchMentionUsers: vi.fn().mockResolvedValue([]),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
  useToast: () => ({
    toast: mockToast,
    toasts: [],
  }),
}))

// Mock prepareFileForUpload to return a File-like object
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn().mockImplementation(async () => {
    return new File(['img-data'], 'compressed.jpg', { type: 'image/jpeg' })
  }),
  isVideoFile: vi.fn(() => false),
  uploadVideoToR2: vi.fn(),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
}))

const mockGenres = {
  '松柏類': [
    { id: 'genre-1', name: '黒松', category: '松柏類' },
  ],
}

// Mock XMLHttpRequest to simulate successful upload
function createMockXHRClass(responseUrl = 'https://r2.example.com/test.jpg') {
  return class MockXHR {
    private _listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
    upload = {
      _listeners: {} as Record<string, Array<(...args: unknown[]) => void>>,
      addEventListener(event: string, cb: (...args: unknown[]) => void) {
        if (!this._listeners[event]) this._listeners[event] = []
        this._listeners[event].push(cb)
      },
    }
    status = 200
    responseText = JSON.stringify({ url: responseUrl, type: 'image' })
    addEventListener(event: string, cb: (...args: unknown[]) => void) {
      if (!this._listeners[event]) this._listeners[event] = []
      this._listeners[event].push(cb)
    }
    open() { /* noop */ }
    send() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const xhr = this
      Promise.resolve().then(() => {
        const loadListeners = xhr._listeners['load'] || []
        for (const cb of loadListeners) cb()
      })
    }
  }
}

describe('PostForm - media files in draft save (lines 188, 428)', () => {
  const originalXHR = globalThis.XMLHttpRequest

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // @ts-expect-error - mock XMLHttpRequest
    globalThis.XMLHttpRequest = createMockXHRClass()
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.XMLHttpRequest = originalXHR
  })

  it('auto-save includes non-empty mediaUrls when image was uploaded (line 188)', async () => {
    mockSaveDraft.mockResolvedValue({ id: 'draft-1' })

    render(<PostForm genres={mockGenres} draftId="draft-media-1" />)

    // Upload a file
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).not.toBeNull()
    const file = new File(['test-image-content'], 'photo.jpg', { type: 'image/jpeg' })

    await act(async () => {
      fireEvent.change(fileInput!, { target: { files: [file] } })
      // Wait for upload completion
      await vi.advanceTimersByTimeAsync(100)
    })

    // Now type content to trigger auto-save effect
    const textarea = screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')
    fireEvent.change(textarea, { target: { value: 'メディア付き投稿' } })

    // Advance past auto-save delay (2000ms)
    await vi.advanceTimersByTimeAsync(3000)

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled()
      const lastCall = mockSaveDraft.mock.calls[mockSaveDraft.mock.calls.length - 1][0]
      expect(lastCall.id).toBe('draft-media-1')
      // mediaUrls should contain the uploaded image URL
      expect(lastCall.mediaUrls).toEqual(['https://r2.example.com/test.jpg'])
    })
  })

  it('handleSaveDraft sends mediaUrls when image was uploaded (line 428)', async () => {
    mockSaveDraft.mockResolvedValue({ id: 'saved-draft' })
    vi.useRealTimers() // Use real timers for user interaction

    // @ts-expect-error - mock XMLHttpRequest for real timers
    globalThis.XMLHttpRequest = createMockXHRClass('https://r2.example.com/uploaded.jpg')

    render(<PostForm genres={mockGenres} />)

    // Type some content
    const textarea = screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')
    fireEvent.change(textarea, { target: { value: '画像付き下書き' } })

    // Upload a file
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).not.toBeNull()
    const file = new File(['test'], 'img.jpg', { type: 'image/jpeg' })

    await act(async () => {
      fireEvent.change(fileInput!, { target: { files: [file] } })
      // Wait for XHR to complete
      await new Promise(r => setTimeout(r, 50))
    })

    // Now click draft save button
    const draftButton = screen.getByRole('button', { name: '下書き保存' })
    expect(draftButton).not.toBeDisabled()

    await act(async () => {
      fireEvent.click(draftButton)
    })

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled()
      const callArgs = mockSaveDraft.mock.calls[0][0]
      expect(callArgs.mediaUrls).toEqual(['https://r2.example.com/uploaded.jpg'])
    })
  })
})
