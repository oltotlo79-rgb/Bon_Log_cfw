/**
 * PostForm - 未カバー分岐のテスト
 *
 * 対象: poll creation toggle, image limit per-type, submit with empty content+media,
 * network error on submit, character count edge cases, auto-save
 */

import { vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PostForm } from '@/components/post/PostForm'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockRefresh = vi.fn()
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
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

const mockPrepareFileForUpload = vi.fn()
const mockIsVideoFile = vi.fn()
const mockUploadVideoToR2 = vi.fn()

vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: (...args: unknown[]) => mockPrepareFileForUpload(...args),
  isVideoFile: (...args: unknown[]) => mockIsVideoFile(...args),
  formatFileSize: vi.fn().mockReturnValue('1 MB'),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: (...args: unknown[]) => mockUploadVideoToR2(...args),
}))

class MockXHR {
  status = 200
  responseText = '{}'
  upload = { addEventListener: vi.fn() }
  addEventListener = vi.fn()
  open = vi.fn()
  send = vi.fn()
  abort = vi.fn()
}

const mockXHRInstances: MockXHR[] = []
const OriginalXHR = global.XMLHttpRequest

const mockGenres = {
  '松柏類': [
    { id: 'genre-1', name: '黒松', category: '松柏類' },
  ],
}

describe('PostForm - 未カバー分岐', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockIsVideoFile.mockReturnValue(false)
    mockPrepareFileForUpload.mockResolvedValue(new File(['test'], 'test.jpg', { type: 'image/jpeg' }))
    mockXHRInstances.length = 0
    global.XMLHttpRequest = vi.fn(function () {
      const instance = new MockXHR()
      instance.send = vi.fn().mockImplementation(() => {
        const loadCb = instance.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'load')
        if (loadCb) {
          instance.status = 200
          instance.responseText = JSON.stringify({ url: '/uploaded.jpg', type: 'image' })
          loadCb[1]()
        }
      })
      mockXHRInstances.push(instance)
      return instance
    }) as unknown as typeof XMLHttpRequest
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  afterAll(() => {
    global.XMLHttpRequest = OriginalXHR
  })

  // ----------------------------------------------------------------
  // Poll toggle on/off
  // ----------------------------------------------------------------
  it('アンケートボタンでPollFormの表示/非表示を切り替えられる', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    // PollForm toggle button (inactive state shows a button with title "アンケートを追加")
    const pollToggle = screen.getByRole('button', { name: 'アンケートを追加' })
    expect(pollToggle).toBeInTheDocument()

    await user.click(pollToggle)

    // After activation, input fields for poll options appear
    expect(screen.getByPlaceholderText('選択肢 1')).toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // Submit with text but no genre -> still disabled
  // ----------------------------------------------------------------
  it('テキストのみでジャンル未選択の場合は投稿できない', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション'), 'テスト投稿')

    expect(screen.getByRole('button', { name: '投稿する' })).toBeDisabled()
    // Title attribute should indicate genre required
    expect(screen.getByRole('button', { name: '投稿する' })).toHaveAttribute('title', 'ジャンルを選択してください')
  })

  // ----------------------------------------------------------------
  // Submit empty form (both content='' and media=[])
  // handleSubmit line 332-335
  // ----------------------------------------------------------------
  it('コンテンツもメディアもない場合にフォーム送信するとエラーを表示する', async () => {
    vi.useRealTimers()
    render(<PostForm genres={mockGenres} />)

    // Force submit by dispatching event on form
    const form = document.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('テキストまたは画像を入力してください')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Submit with character count exceeded
  // handleSubmit line 337-339
  // ----------------------------------------------------------------
  it('文字数超過時にフォーム送信するとエラーを表示する', async () => {
    vi.useRealTimers()
    render(
      <PostForm
        genres={mockGenres}
        limits={{ maxPostLength: 5, maxImages: 4, maxVideos: 1 }}
      />
    )

    const textarea = screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')
    fireEvent.change(textarea, { target: { value: 'あいうえおか' } }) // 6 chars, max 5

    const form = document.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/文字超過しています/)).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Network error on createPost (catch block)
  // ----------------------------------------------------------------
  it('投稿のネットワークエラー時にトースト通知を表示する', async () => {
    vi.useRealTimers()
    mockCreatePost.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション'), 'テスト投稿')
    await user.click(screen.getByText('ジャンルを選択（任意）'))
    await user.click(screen.getByText('黒松'))
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: 'ネットワークエラーが発生しました',
        })
      )
    })
  })

  // ----------------------------------------------------------------
  // Image upload limit exceeded per type
  // handleFileSelect line 228-231: currentImageCount >= limits.maxImages
  // ----------------------------------------------------------------
  it('画像枚数上限超過時にエラーを表示する', async () => {
    vi.useRealTimers()
    const { container } = render(
      <PostForm
        genres={mockGenres}
        limits={{ maxPostLength: 500, maxImages: 1, maxVideos: 1 }}
      />
    )
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    // Upload first image
    const file1 = new File(['img1'], 'test1.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { value: [file1], configurable: true })
    fireEvent.change(fileInput)

    // 1枚目のアップロード完了（XHRレスポンス受信）を待つ
    await waitFor(() => {
      expect(container.querySelector('img[src="/uploaded.jpg"]')).toBeInTheDocument()
    }, { timeout: 5000 })

    // Try to upload second image（上限超過）
    const file2 = new File(['img2'], 'test2.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { value: [file2], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/画像は1枚まで添付できます/)).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  // ----------------------------------------------------------------
  // Video upload limit exceeded
  // handleFileSelect line 233-236: currentVideoCount >= limits.maxVideos
  // ----------------------------------------------------------------
  it('動画本数上限超過時にエラーを表示する', async () => {
    vi.useRealTimers()
    mockIsVideoFile.mockReturnValue(true)
    mockUploadVideoToR2.mockResolvedValue({ url: '/video.mp4' })

    const { container } = render(
      <PostForm
        genres={mockGenres}
        limits={{ maxPostLength: 500, maxImages: 4, maxVideos: 1 }}
      />
    )
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    // Upload first video
    const vid1 = new File(['vid'], 'test1.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput, 'files', { value: [vid1], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(mockUploadVideoToR2).toHaveBeenCalledTimes(1)
    })

    // Try second video
    const vid2 = new File(['vid2'], 'test2.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput, 'files', { value: [vid2], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/動画は1本まで添付できます/)).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Auto-save with draftId
  // ----------------------------------------------------------------
  it('draftIdがある場合に内容変更で自動保存が実行される', async () => {
    mockSaveDraft.mockResolvedValue({ success: true })
    render(<PostForm genres={mockGenres} draftId="draft-123" />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')
    fireEvent.change(textarea, { target: { value: 'テスト内容' } })

    // Advance timers to trigger auto-save
    await vi.advanceTimersByTimeAsync(3000)

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'draft-123',
          content: 'テスト内容',
        })
      )
    })
  })

  // ----------------------------------------------------------------
  // Auto-save error path
  // ----------------------------------------------------------------
  it('自動保存でエラーが返された場合にstatusがidleに戻る', async () => {
    mockSaveDraft.mockResolvedValue({ error: '保存失敗' })
    render(<PostForm genres={mockGenres} draftId="draft-123" />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')
    fireEvent.change(textarea, { target: { value: 'テスト' } })

    await vi.advanceTimersByTimeAsync(3000)

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled()
    })

    // No "自動保存しました" should appear
    expect(screen.queryByText(/自動保存しました/)).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // Auto-save exception path
  // ----------------------------------------------------------------
  it('自動保存で例外発生時にstatusがidleに戻る', async () => {
    mockSaveDraft.mockRejectedValue(new Error('Network error'))
    render(<PostForm genres={mockGenres} draftId="draft-123" />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')
    fireEvent.change(textarea, { target: { value: 'テスト' } })

    await vi.advanceTimersByTimeAsync(3000)

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled()
    })

    expect(screen.queryByText(/自動保存しました/)).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // Auto-save success shows indicator
  // ----------------------------------------------------------------
  it('自動保存成功時にインジケーターを表示する', async () => {
    mockSaveDraft.mockResolvedValue({ success: true })
    render(<PostForm genres={mockGenres} draftId="draft-123" />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')
    fireEvent.change(textarea, { target: { value: 'テスト' } })

    await vi.advanceTimersByTimeAsync(3000)

    await waitFor(() => {
      expect(screen.getByText(/自動保存しました/)).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Poll options included in submission
  // handleSubmit lines 349-352
  // ----------------------------------------------------------------
  it('アンケート付き投稿でpollOptionsがFormDataに含まれる', async () => {
    vi.useRealTimers()
    mockCreatePost.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション'), 'テスト投稿')
    await user.click(screen.getByText('ジャンルを選択（任意）'))
    await user.click(screen.getByText('黒松'))

    // Activate poll
    await user.click(screen.getByRole('button', { name: 'アンケートを追加' }))
    await user.type(screen.getByPlaceholderText('選択肢 1'), 'オプション1')
    await user.type(screen.getByPlaceholderText('選択肢 2'), 'オプション2')

    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalled()
      const formData = mockCreatePost.mock.calls[0][0] as FormData
      expect(formData.get('pollOptions')).toBeTruthy()
      expect(formData.get('pollDuration')).toBeTruthy()
    })
  })

  // ----------------------------------------------------------------
  // XHR upload error event
  // handleFileSelect: xhr error callback
  // ----------------------------------------------------------------
  it('画像アップロードのXHRエラー時にエラーを表示する', async () => {
    vi.useRealTimers()
    global.XMLHttpRequest = vi.fn(function () {
      const instance = new MockXHR()
      instance.send = vi.fn().mockImplementation(() => {
        const errorCb = instance.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'error')
        if (errorCb) {
          errorCb[1]()
        }
      })
      mockXHRInstances.push(instance)
      return instance
    }) as unknown as typeof XMLHttpRequest

    const { container } = render(<PostForm genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // XHR non-200 response
  // ----------------------------------------------------------------
  it('画像アップロードの非200レスポンス時にエラーを表示する', async () => {
    vi.useRealTimers()
    global.XMLHttpRequest = vi.fn(function () {
      const instance = new MockXHR()
      instance.send = vi.fn().mockImplementation(() => {
        const loadCb = instance.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'load')
        if (loadCb) {
          instance.status = 500
          instance.responseText = 'Internal Server Error'
          loadCb[1]()
        }
      })
      mockXHRInstances.push(instance)
      return instance
    }) as unknown as typeof XMLHttpRequest

    const { container } = render(<PostForm genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // XHR JSON parse error
  // ----------------------------------------------------------------
  it('画像アップロードレスポンスのJSON解析エラー時にエラーを表示する', async () => {
    vi.useRealTimers()
    global.XMLHttpRequest = vi.fn(function () {
      const instance = new MockXHR()
      instance.send = vi.fn().mockImplementation(() => {
        const loadCb = instance.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'load')
        if (loadCb) {
          instance.status = 200
          instance.responseText = 'not json'
          loadCb[1]()
        }
      })
      mockXHRInstances.push(instance)
      return instance
    }) as unknown as typeof XMLHttpRequest

    const { container } = render(<PostForm genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })
})
