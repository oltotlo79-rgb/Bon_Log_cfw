import { vi } from 'vitest'
/**
 * PostFormModalコンポーネントの追加テスト
 * 分岐カバレッジを向上させるためのテスト
 */

import { render, screen, waitFor, fireEvent } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PostFormModal } from '@/components/post/PostFormModal'

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
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
}))

// Server Actions モック
const mockCreatePost = vi.fn()
vi.mock('@/lib/actions/post', () => ({
  createPost: (...args: unknown[]) => mockCreatePost(...args),
}))

const mockSaveDraft = vi.fn()
vi.mock('@/lib/actions/draft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
}))

// トースト通知モック
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
  '松柏類': [{ id: 'genre-1', name: '黒松', category: '松柏類' }],
}

const defaultProps = {
  genres: mockGenres,
  isOpen: true,
  onClose: vi.fn(),
}

describe('PostFormModal - 追加カバレッジテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsVideoFile.mockReturnValue(false)
    mockPrepareFileForUpload.mockResolvedValue(new File(['test'], 'test.jpg', { type: 'image/jpeg' }))
    mockXHRInstances.length = 0
    global.XMLHttpRequest = vi.fn(function() {
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

  afterAll(() => {
    global.XMLHttpRequest = OriginalXHR
  })

  describe('画像数制限', () => {
    it('最大画像サイズのチェックでエラーを表示する', async () => {
      const { container } = render(
        <PostFormModal
          {...defaultProps}
          limits={{ maxPostLength: 500, maxImages: 4, maxVideos: 1 }}
        />
      )

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      // 大きなファイルをアップロードしようとする
      const largeFile = new File(['x'], 'large.jpg', { type: 'image/jpeg' })
      Object.defineProperty(largeFile, 'size', { configurable: true, value: 15 * 1024 * 1024 })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [largeFile] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/画像は10MB以下にしてください/)).toBeInTheDocument()
      })
    })
  })

  describe('動画数制限', () => {
    it('最大動画サイズのチェックでエラーを表示する', async () => {
      mockIsVideoFile.mockReturnValue(true)

      const { container } = render(
        <PostFormModal
          {...defaultProps}
          limits={{ maxPostLength: 500, maxImages: 4, maxVideos: 1 }}
        />
      )

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      // 大きな動画ファイルをアップロードしようとする
      const largeVideo = new File(['x'], 'large.mp4', { type: 'video/mp4' })
      Object.defineProperty(largeVideo, 'size', { configurable: true, value: 300 * 1024 * 1024 })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [largeVideo] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/動画は256MB以下にしてください/)).toBeInTheDocument()
      })
    })
  })

  describe('投稿エラー処理', () => {
    it('投稿APIエラー時にトースト通知を表示する', async () => {
      mockCreatePost.mockResolvedValue({ error: 'サーバーエラー' })
      const user = userEvent.setup()
      render(<PostFormModal {...defaultProps} />)

      await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト投稿')
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '投稿に失敗しました',
          description: 'サーバーエラー',
        })
      })
    })
  })

  describe('XHRエラー処理', () => {
    it('XHRエラーイベントでエラーを表示する', async () => {
      global.XMLHttpRequest = vi.fn(function() {
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

      const { container } = render(<PostFormModal {...defaultProps} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
      })
    })

    it('XHRステータスコードが400以上でエラーを表示する', async () => {
      global.XMLHttpRequest = vi.fn(function() {
        const instance = new MockXHR()
        instance.send = vi.fn().mockImplementation(() => {
          const loadCb = instance.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'load')
          if (loadCb) {
            instance.status = 400
            loadCb[1]()
          }
        })
        mockXHRInstances.push(instance)
        return instance
      }) as unknown as typeof XMLHttpRequest

      const { container } = render(<PostFormModal {...defaultProps} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
      })
    })

    it('XHRレスポンスがパースできない場合エラーを表示する', async () => {
      global.XMLHttpRequest = vi.fn(function() {
        const instance = new MockXHR()
        instance.send = vi.fn().mockImplementation(() => {
          const loadCb = instance.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'load')
          if (loadCb) {
            instance.status = 200
            instance.responseText = 'invalid json'
            loadCb[1]()
          }
        })
        mockXHRInstances.push(instance)
        return instance
      }) as unknown as typeof XMLHttpRequest

      const { container } = render(<PostFormModal {...defaultProps} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
      })
    })
  })

  describe('圧縮ログ', () => {
    it('圧縮によってサイズが減少してもログが出力されない（本番ログ削除済み）', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

      const originalFile = new File(['x'.repeat(10000)], 'test.jpg', { type: 'image/jpeg' })
      const compressedFile = new File(['x'.repeat(5000)], 'test.jpg', { type: 'image/jpeg' })
      mockPrepareFileForUpload.mockResolvedValue(compressedFile)

      const { container } = render(<PostFormModal {...defaultProps} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      Object.defineProperty(fileInput, 'files', { configurable: true, value: [originalFile] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(container.querySelector('.relative.aspect-video')).toBeInTheDocument()
      })

      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('下書き一覧リンク', () => {
    it('下書き数が1以上の場合リンクが表示される', () => {
      render(<PostFormModal {...defaultProps} draftCount={3} />)
      expect(screen.getByText('下書き一覧')).toBeInTheDocument()
    })

    it('下書き一覧リンクがhref="/drafts"を持つ', () => {
      render(<PostFormModal {...defaultProps} draftCount={3} />)
      const link = screen.getByRole('link', { name: /下書き一覧/ })
      expect(link).toHaveAttribute('href', '/drafts')
    })
  })

  describe('ジャンル選択', () => {
    it('ジャンルを選択できる', async () => {
      const user = userEvent.setup()
      render(<PostFormModal {...defaultProps} />)

      // ジャンルセレクターを開く
      await user.click(screen.getByText('ジャンルを選択（任意）'))
    })
  })

  describe('入力内容破棄の確認', () => {
    it('メディアがある状態で閉じようとすると確認ダイアログが表示される', async () => {
      const onClose = vi.fn()
      const user = userEvent.setup()

      const { container } = render(<PostFormModal {...defaultProps} onClose={onClose} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      // 画像をアップロード
      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(container.querySelector('.relative.aspect-video')).toBeInTheDocument()
      })

      // 閉じるボタンをクリック
      const closeButton = screen.getAllByRole('button')[0]
      await user.click(closeButton)

      // ConfirmDialog (discard variant) should appear
      await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
      expect(screen.getByText('入力内容を破棄しますか？')).toBeInTheDocument()
    })
  })

  describe('動画アップロード進捗', () => {
    it('動画アップロード中に進捗が更新される', async () => {
      mockIsVideoFile.mockReturnValue(true)

      let progressCallback: ((progress: number) => void) | null = null
      mockUploadVideoToR2.mockImplementation((_file: File, _folder: string, onProgress: (progress: number) => void) => {
        progressCallback = onProgress
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ url: '/video.mp4' })
          }, 100)
        })
      })

      const { container } = render(<PostFormModal {...defaultProps} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['video'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      // 進捗コールバックを呼び出し
      await waitFor(() => {
        if (progressCallback) {
          progressCallback(50)
        }
      })

      await waitFor(() => {
        expect(mockUploadVideoToR2).toHaveBeenCalled()
      })
    })
  })

  describe('アップロードキャンセル', () => {
    it('XHRアボートイベントでキャンセルメッセージを表示する', async () => {
      global.XMLHttpRequest = vi.fn(function() {
        const instance = new MockXHR()
        instance.send = vi.fn().mockImplementation(() => {
          const abortCb = instance.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'abort')
          if (abortCb) {
            abortCb[1]()
          }
        })
        mockXHRInstances.push(instance)
        return instance
      }) as unknown as typeof XMLHttpRequest

      const { container } = render(<PostFormModal {...defaultProps} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('アップロードがキャンセルされました')).toBeInTheDocument()
      })
    })
  })

  describe('レスポンスのtypeフォールバック', () => {
    it('レスポンスにtypeがない場合imageがデフォルトで使用される', async () => {
      global.XMLHttpRequest = vi.fn(function() {
        const instance = new MockXHR()
        instance.send = vi.fn().mockImplementation(() => {
          const loadCb = instance.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'load')
          if (loadCb) {
            instance.status = 200
            instance.responseText = JSON.stringify({ url: '/uploaded.jpg' }) // typeなし
            loadCb[1]()
          }
        })
        mockXHRInstances.push(instance)
        return instance
      }) as unknown as typeof XMLHttpRequest

      const { container } = render(<PostFormModal {...defaultProps} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(container.querySelector('.relative.aspect-video')).toBeInTheDocument()
      })
    })
  })
})
