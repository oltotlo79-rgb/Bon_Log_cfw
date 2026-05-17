/**
 * DraftEditForm - 追加の未カバー分岐テスト
 *
 * 対象分岐:
 * - 画像アップロード成功レスポンスに type がない場合のフォールバック
 * - 動画アップロードの進捗コールバック
 * - 画像アップロードの progress イベント（lengthComputable）
 * - 自動保存で連続変更時のデバウンスリセット
 * - autoSave 成功後に再度変更すると savedDisplayTimer がリセットされる
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
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
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
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

const mockConfirm = vi.fn()
window.confirm = mockConfirm

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

describe('DraftEditForm - 追加分岐テスト', () => {
  const mockDraft = {
    id: 'draft-1',
    content: 'テスト下書き',
    media: [],
    genres: [],
  }

  const mockGenres = {
    '樹種': [
      { id: 'genre-1', name: '松柏類', category: '樹種' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirm.mockReturnValue(true)
    mockSaveDraft.mockResolvedValue({ success: true })
    mockPublishDraft.mockResolvedValue({ success: true })
    mockDeleteDraft.mockResolvedValue({ success: true })
    mockIsVideoFile.mockReturnValue(false)
    mockPrepareFileForUpload.mockResolvedValue(new File(['test'], 'test.jpg', { type: 'image/jpeg' }))
    mockXHRInstances.length = 0
  })

  afterAll(() => {
    global.XMLHttpRequest = OriginalXHR
  })

  it('画像アップロード成功時にtype未定義の場合imageにフォールバックする', async () => {
    global.XMLHttpRequest = vi.fn(function () {
      const instance = new MockXHR()
      instance.send = vi.fn().mockImplementation(() => {
        const loadCb = instance.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'load')
        if (loadCb) {
          instance.status = 200
          // type フィールドがないレスポンス
          instance.responseText = JSON.stringify({ url: '/uploaded-no-type.jpg' })
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
      // type がなくてもメディアがプレビューに追加される
      const img = container.querySelector('img[src="/uploaded-no-type.jpg"]')
      expect(img).toBeInTheDocument()
    })
  })

  it('画像アップロードでレスポンスにerrorがある場合にエラーを表示する', async () => {
    global.XMLHttpRequest = vi.fn(function () {
      const instance = new MockXHR()
      instance.send = vi.fn().mockImplementation(() => {
        const loadCb = instance.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'load')
        if (loadCb) {
          instance.status = 200
          instance.responseText = JSON.stringify({ error: 'サーバーエラー発生' })
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
      expect(screen.getByText('サーバーエラー発生')).toBeInTheDocument()
    })
  })

  it('動画アップロードでerrorがundefined/falsy でurl付きの場合はメディアが追加される', async () => {
    mockIsVideoFile.mockReturnValue(true)
    // error フィールドが存在するが falsy
    mockUploadVideoToR2.mockResolvedValue({ error: '', url: '/video-ok.mp4' })

    const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['vid'], 'test.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      // error が falsy なので 'error' in result は true だが result.error が falsy
      // コード: if ('error' in result && result.error) → false パスへ
      // else if (result.url) → メディア追加
      const video = container.querySelector('video[src="/video-ok.mp4"]')
      expect(video).toBeInTheDocument()
    })
  })

  it('自動保存成功後に再度変更すると保存タイマーがリセットされる', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockSaveDraft.mockResolvedValue({ success: true })
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？')

    // 最初の変更
    fireEvent.change(textarea, { target: { value: '最初の変更' } })
    await vi.advanceTimersByTimeAsync(3000)

    await waitFor(() => {
      expect(screen.getByText(/自動保存しました/)).toBeInTheDocument()
    })

    // 2回目の変更（savedDisplayTimerのリセットをテスト）
    fireEvent.change(textarea, { target: { value: '2回目の変更' } })
    await vi.advanceTimersByTimeAsync(3000)

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalledTimes(2)
    })

    vi.useRealTimers()
  })
})
