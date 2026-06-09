/**
 * DraftEditForm - 未カバー分岐のテスト
 *
 * 対象: auto-save flow, XHR error paths, video upload success,
 * delete error without 'error' field, publish save error fallback
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { DraftEditForm } from '@/components/draft/DraftEditForm'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, fill, className }: { src: string; alt: string; fill?: boolean; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-fill={fill} className={className} />
  ),
}))

const mockSaveDraft = vi.fn()
const mockPublishDraft = vi.fn()
const mockDeleteDraft = vi.fn()
vi.mock('@/lib/actions/draft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
  publishDraft: (...args: unknown[]) => mockPublishDraft(...args),
  deleteDraft: (...args: unknown[]) => mockDeleteDraft(...args),
}))

vi.mock('@/components/post/GenreSelector', () => ({
  GenreSelector: ({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) => (
    <div data-testid="genre-selector">
      <span data-testid="selected-genres">{selectedIds.join(',')}</span>
      <button onClick={() => onChange(['genre-1', 'genre-2'])}>ジャンル選択</button>
    </div>
  ),
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

describe('DraftEditForm - 未カバー分岐', () => {
  const mockDraft = {
    id: 'draft-1',
    content: 'テスト下書き',
    media: [],
    genres: [
      { genreId: 'genre-1', genre: { id: 'genre-1', name: '松柏類' } },
    ],
  }

  const mockGenres = {
    '樹種': [
      { id: 'genre-1', name: '松柏類', category: '樹種' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockSaveDraft.mockResolvedValue({ success: true })
    mockPublishDraft.mockResolvedValue({ success: true })
    mockDeleteDraft.mockResolvedValue({ success: true })
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
  // Auto-save success shows indicator and then hides
  // ----------------------------------------------------------------
  it('自動保存成功時にインジケーターを表示し、一定時間後に消える', async () => {
    mockSaveDraft.mockResolvedValue({ success: true })
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？')
    fireEvent.change(textarea, { target: { value: '更新された内容' } })

    // Advance timers to trigger auto-save (DRAFT_AUTOSAVE_DELAY_MS)
    await vi.advanceTimersByTimeAsync(3000)

    await waitFor(() => {
      expect(screen.getByText(/自動保存しました/)).toBeInTheDocument()
    })

    // Advance to hide the indicator (DRAFT_AUTOSAVE_SAVED_DISPLAY_MS)
    await vi.advanceTimersByTimeAsync(3000)

    await waitFor(() => {
      expect(screen.queryByText(/自動保存しました/)).not.toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Auto-save: saveDraft returns error
  // ----------------------------------------------------------------
  it('自動保存でエラー返却時はインジケーターを表示しない', async () => {
    mockSaveDraft.mockResolvedValue({ error: '保存失敗' })
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？')
    fireEvent.change(textarea, { target: { value: '更新' } })

    await vi.advanceTimersByTimeAsync(3000)

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled()
    })

    expect(screen.queryByText(/自動保存しました/)).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // Auto-save: saveDraft throws exception
  // ----------------------------------------------------------------
  it('自動保存で例外発生時はインジケーターを表示しない', async () => {
    mockSaveDraft.mockRejectedValue(new Error('Network error'))
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？')
    fireEvent.change(textarea, { target: { value: '更新' } })

    await vi.advanceTimersByTimeAsync(3000)

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled()
    })

    expect(screen.queryByText(/自動保存しました/)).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // Auto-save: saving indicator shown during save
  // ----------------------------------------------------------------
  it('自動保存中に「保存中...」インジケーターを表示する', async () => {
    mockSaveDraft.mockImplementation(() => new Promise(() => {})) // never resolves
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？')
    fireEvent.change(textarea, { target: { value: '更新' } })

    await vi.advanceTimersByTimeAsync(3000)

    await waitFor(() => {
      expect(screen.getByText('保存中...')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Video upload success
  // ----------------------------------------------------------------
  it('動画アップロード成功時にメディアプレビューが表示される', async () => {
    vi.useRealTimers()
    mockIsVideoFile.mockReturnValue(true)
    mockUploadVideoToR2.mockResolvedValue({ url: '/video.mp4' })

    const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['vid'], 'test.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      const video = container.querySelector('video[src="/video.mp4"]')
      expect(video).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // XHR error event during image upload
  // ----------------------------------------------------------------
  it('画像アップロードのXHRエラーイベント時にエラー表示する', async () => {
    vi.useRealTimers()
    global.XMLHttpRequest = vi.fn(function () {
      const instance = new MockXHR()
      instance.send = vi.fn().mockImplementation(() => {
        const errorCb = instance.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'error')
        if (errorCb) errorCb[1]()
      })
      mockXHRInstances.push(instance)
      return instance
    }) as unknown as typeof XMLHttpRequest

    const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
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
          instance.responseText = 'Server Error'
          loadCb[1]()
        }
      })
      mockXHRInstances.push(instance)
      return instance
    }) as unknown as typeof XMLHttpRequest

    const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // XHR invalid JSON response
  // ----------------------------------------------------------------
  it('画像アップロードレスポンスのJSON解析失敗時にエラーを表示する', async () => {
    vi.useRealTimers()
    global.XMLHttpRequest = vi.fn(function () {
      const instance = new MockXHR()
      instance.send = vi.fn().mockImplementation(() => {
        const loadCb = instance.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'load')
        if (loadCb) {
          instance.status = 200
          instance.responseText = 'not-json'
          loadCb[1]()
        }
      })
      mockXHRInstances.push(instance)
      return instance
    }) as unknown as typeof XMLHttpRequest

    const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Delete with success: false but no 'error' field
  // handleDelete line 576
  // ----------------------------------------------------------------
  it('削除結果がsuccess: falseでerrorフィールドがない場合にデフォルトエラーを表示する', async () => {
    vi.useRealTimers()
    mockDeleteDraft.mockResolvedValue({ success: false })
    const user = userEvent.setup()
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    await user.click(screen.getByRole('button', { name: /削除/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Publish: saveDraft with error field as null -> falls back to 'エラー'
  // handlePublishConfirm: saveResult.error ?? MSG_ERROR_FALLBACK
  // ----------------------------------------------------------------
  it('投稿前の保存でerrorがnullの場合にデフォルトエラーを表示する', async () => {
    vi.useRealTimers()
    mockSaveDraft.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    await user.click(screen.getByRole('button', { name: /投稿する/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })
    expect(mockPublishDraft).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // Publish: publishDraft returns error with null -> fallback
  // handlePublishConfirm: result.error ?? MSG_ERROR_FALLBACK
  // ----------------------------------------------------------------
  it('投稿変換でerrorがnullの場合にデフォルトエラーを表示する', async () => {
    vi.useRealTimers()
    mockSaveDraft.mockResolvedValue({ success: true })
    mockPublishDraft.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    await user.click(screen.getByRole('button', { name: /投稿する/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Save with error as null -> fallback to 'エラー'
  // handleSave line 505: result.error ?? 'エラー'
  // ----------------------------------------------------------------
  it('保存でerrorがnullの場合にデフォルトエラーを表示する', async () => {
    vi.useRealTimers()
    mockSaveDraft.mockResolvedValue({ error: null })
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Files input is null (edge case guard)
  // handleFileSelect: files is null or empty
  // ----------------------------------------------------------------
  it('ファイル入力がnullの場合は何も起きない', () => {
    vi.useRealTimers()
    const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    Object.defineProperty(fileInput, 'files', { configurable: true, value: null })
    fireEvent.change(fileInput)

    expect(mockPrepareFileForUpload).not.toHaveBeenCalled()
  })
})
