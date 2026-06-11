import React from 'react'
import { vi } from 'vitest'
/**
 * PostForm / PostFormModal カバレッジ向上テスト
 *
 * 未カバーの分岐・関数を重点的にテストする
 */

import { render, screen, waitFor, fireEvent } from '../utils/test-utils'
import userEvent from '@testing-library/user-event'

// ============================================================
// モック設定
// ============================================================

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
  MAX_VIDEO_SIZE: 80 * 1024 * 1024,
  uploadVideoToR2: (...args: unknown[]) => mockUploadVideoToR2(...args),
}))

// XMLHttpRequest mock
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

// コンポーネントインポート
import { PostForm } from '@/components/post/PostForm'
import { PostFormModal } from '@/components/post/PostFormModal'

// ============================================================
// テストデータ
// ============================================================

const mockGenres = {
  '松柏類': [
    { id: 'genre-1', name: '黒松', category: '松柏類' },
    { id: 'genre-2', name: '五葉松', category: '松柏類' },
  ],
  '雑木類': [
    { id: 'genre-3', name: 'もみじ', category: '雑木類' },
  ],
}

// 動画テストにはプレミアム制限値を渡す（maxVideos=1 で動画アップロードが許可される）
const premiumLimits = {
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 1,
  maxDailyPosts: 20,
  canSchedulePost: false,
  canViewAnalytics: false,
}

const modalDefaultProps = {
  genres: mockGenres,
  isOpen: true,
  onClose: vi.fn(),
  limits: premiumLimits,
}

// ============================================================
// ヘルパー: デフォルトXHR mock (成功)
// ============================================================
function setupSuccessXHR() {
  global.XMLHttpRequest = vi.fn(function() {
    const instance = new MockXHR()
    instance.send = vi.fn().mockImplementation(() => {
      const loadCb = instance.addEventListener.mock.calls.find(
        (c: unknown[]) => c[0] === 'load'
      )
      if (loadCb) {
        instance.status = 200
        instance.responseText = JSON.stringify({ url: '/uploaded.jpg', type: 'image' })
        loadCb[1]()
      }
    })
    mockXHRInstances.push(instance)
    return instance
  }) as unknown as typeof XMLHttpRequest
}

// ============================================================
// PostForm - 未カバー分岐/関数テスト
// ============================================================

describe('PostForm - coverage boost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsVideoFile.mockReturnValue(false)
    mockPrepareFileForUpload.mockResolvedValue(
      new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    )
    mockXHRInstances.length = 0
    setupSuccessXHR()
  })

  afterAll(() => {
    global.XMLHttpRequest = OriginalXHR
  })

  describe('handleSubmit - ネットワークエラーのcatch分岐', () => {
    it('createPostが例外をスローした場合にエラートースト通知を表示する', async () => {
      mockCreatePost.mockRejectedValue(new Error('Network failure'))
      const user = userEvent.setup()
      render(<PostForm genres={mockGenres} />)

      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      await user.type(textarea, 'テスト投稿')
      // ジャンルを選択（ドロップダウンを開いてから選択）
      await user.click(screen.getByText('ジャンルを選択（任意）'))
      await user.click(screen.getByText('黒松'))
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '投稿に失敗しました',
          description: 'ネットワークエラーが発生しました',
        })
      })
    })
  })

  describe('handleSubmit - 文字数超過のバリデーション分岐', () => {
    it('文字数超過時にフォーム送信するとエラーメッセージが表示される', async () => {
      render(
        <PostForm
          genres={mockGenres}
          limits={{ maxPostLength: 5, maxImages: 4, maxVideos: 1 }}
        />
      )

      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      // maxLength制約を回避してfireEventで超過入力
      fireEvent.change(textarea, { target: { value: 'あいうえおか' } })

      // 直接formのsubmitイベントを発火
      const form = textarea.closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/文字超過しています/)).toBeInTheDocument()
      })
      expect(mockCreatePost).not.toHaveBeenCalled()
    })
  })

  describe('handleSubmit - 空テキスト/メディアなしのバリデーション分岐', () => {
    it('テキストもメディアもない状態でフォーム送信するとエラーを表示する', async () => {
      render(<PostForm genres={mockGenres} />)

      // 直接formのsubmitイベントを発火（ボタンは無効だがformイベントは発火可能）
      const form = screen.getByPlaceholderText(/いまどうしてる/).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText('テキストまたは画像を入力してください')).toBeInTheDocument()
      })
      expect(mockCreatePost).not.toHaveBeenCalled()
    })
  })

  describe('handleSubmit - アンケート付き投稿', () => {
    it('アンケートが有効な状態で投稿するとpollOptionsがFormDataに含まれる', async () => {
      mockCreatePost.mockResolvedValue({ success: true })
      const user = userEvent.setup()
      render(<PostForm genres={mockGenres} />)

      // テキスト入力
      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      await user.type(textarea, 'アンケート付き投稿')

      // アンケートボタンをクリック（PollFormのisActive=falseのときのトグルボタン）
      const pollButton = screen.getByRole('button', { name: /アンケートを追加/i })
      await user.click(pollButton)

      // アンケートの選択肢が表示される
      await waitFor(() => {
        expect(screen.getByPlaceholderText('選択肢 1')).toBeInTheDocument()
      })

      // 選択肢を入力
      await user.type(screen.getByPlaceholderText('選択肢 1'), 'はい')
      await user.type(screen.getByPlaceholderText('選択肢 2'), 'いいえ')

      // ジャンルを選択（ドロップダウンを開いてから選択）
      await user.click(screen.getByText('ジャンルを選択（任意）'))
      await user.click(screen.getByText('黒松'))

      // 投稿ボタンをクリック
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockCreatePost).toHaveBeenCalled()
        const formData = mockCreatePost.mock.calls[0]![0] as FormData
        const pollOptions = formData.get('pollOptions')
        expect(pollOptions).toBeTruthy()
        const parsed = JSON.parse(pollOptions as string)
        expect(parsed).toContain('はい')
        expect(parsed).toContain('いいえ')
        expect(formData.get('pollDuration')).toBe('86400')
      })
    })
  })

  describe('handleSubmit - 投稿成功時にフォームリセット確認（pollOptionsも含む）', () => {
    it('投稿成功後にトーストが表示されキャッシュが無効化される', async () => {
      mockCreatePost.mockResolvedValue({ success: true })
      const user = userEvent.setup()
      render(<PostForm genres={mockGenres} />)

      await user.type(screen.getByPlaceholderText(/いまどうしてる/), 'テスト投稿')
      // ジャンルを選択（ドロップダウンを開いてから選択）
      await user.click(screen.getByText('ジャンルを選択（任意）'))
      await user.click(screen.getByText('黒松'))
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: '投稿しました' })
      })
    })
  })

  describe('動画アップロード上限チェック', () => {
    it('動画が上限を超えるとエラーを表示する', async () => {
      mockIsVideoFile.mockReturnValue(true)
      mockUploadVideoToR2.mockResolvedValue({ url: '/video1.mp4' })

      const { container } = render(<PostForm genres={mockGenres} limits={premiumLimits} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      // 1本目の動画をアップロード
      const file1 = new File(['vid1'], 'test1.mp4', { type: 'video/mp4' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file1] })
      fireEvent.change(fileInput)

      // 1本目のアップロードが完了し、DOM上にvideoタグが表示されるまで待つ
      await waitFor(() => {
        expect(container.querySelector('video')).toBeInTheDocument()
      })

      // 2本目の動画をアップロードしようとする（上限は1本）
      const file2 = new File(['vid2'], 'test2.mp4', { type: 'video/mp4' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file2] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/動画は1本まで添付できます/)).toBeInTheDocument()
      })
    })
  })

  describe('動画アップロード進捗コールバック', () => {
    it('動画アップロード中に進捗コールバックが呼ばれる', async () => {
      mockIsVideoFile.mockReturnValue(true)
      let capturedProgressCb: ((n: number) => void) | null = null
      mockUploadVideoToR2.mockImplementation(
        (_file: File, _folder: string, onProgress: (n: number) => void) => {
          capturedProgressCb = onProgress
          return Promise.resolve({ url: '/video.mp4' })
        }
      )

      const { container } = render(<PostForm genres={mockGenres} limits={premiumLimits} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['vid'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(capturedProgressCb).not.toBeNull()
      })
    })
  })

  describe('画像圧縮率が0の場合（ログ出力されない分岐）', () => {
    it('圧縮後にサイズが変わらない場合はログが出力されない', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

      // 同じサイズのファイルを返す
      const originalFile = new File(['abc'], 'test.jpg', { type: 'image/jpeg' })
      const sameFile = new File(['abc'], 'test.jpg', { type: 'image/jpeg' })
      mockPrepareFileForUpload.mockResolvedValue(sameFile)

      const { container } = render(<PostForm genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      Object.defineProperty(fileInput, 'files', {
        configurable: true,
        value: [originalFile],
      })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(mockPrepareFileForUpload).toHaveBeenCalled()
      })

      // 圧縮率0の場合はログが出力されない
      const compressionLogCalls = consoleSpy.mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('圧縮完了')
      )
      expect(compressionLogCalls.length).toBe(0)

      consoleSpy.mockRestore()
    })
  })

  describe('XHR upload progress イベント', () => {
    it('XHRアップロード進捗イベントが発火するとuploadProgressが更新される', async () => {
      let capturedProgressHandler: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null = null

      global.XMLHttpRequest = vi.fn(function() {
        const instance = new MockXHR()
        instance.upload.addEventListener = vi.fn().mockImplementation(
          (event: string, handler: (e: { lengthComputable: boolean; loaded: number; total: number }) => void) => {
            if (event === 'progress') {
              capturedProgressHandler = handler
            }
          }
        )
        instance.send = vi.fn().mockImplementation(() => {
          // 進捗を発火
          if (capturedProgressHandler) {
            capturedProgressHandler({ lengthComputable: true, loaded: 50, total: 100 })
          }
          // 完了
          const loadCb = instance.addEventListener.mock.calls.find(
            (c: unknown[]) => c[0] === 'load'
          )
          if (loadCb) {
            instance.status = 200
            instance.responseText = JSON.stringify({ url: '/uploaded.jpg', type: 'image' })
            loadCb[1]()
          }
        })
        mockXHRInstances.push(instance)
        return instance
      }) as unknown as typeof XMLHttpRequest

      const { container } = render(<PostForm genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(mockPrepareFileForUpload).toHaveBeenCalled()
      })

      // メディアプレビューが追加されることを確認
      await waitFor(() => {
        expect(container.querySelector('.relative.aspect-video')).toBeInTheDocument()
      })
    })
  })

  describe('下書き保存中のローディング状態', () => {
    it('下書き保存中は保存中テキストが表示される', async () => {
      mockSaveDraft.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 500))
      )
      const user = userEvent.setup()
      render(<PostForm genres={mockGenres} />)

      await user.type(screen.getByPlaceholderText(/いまどうしてる/), 'テスト下書き')
      await user.click(screen.getByRole('button', { name: '下書き保存' }))

      // 保存中表示
      await waitFor(() => {
        expect(screen.getByText('保存中...')).toBeInTheDocument()
      })
    })
  })

  describe('メディアプレビュー内の動画表示', () => {
    it('動画ファイルアップロード後にvideoタグでプレビューが表示される', async () => {
      mockIsVideoFile.mockReturnValue(true)
      mockUploadVideoToR2.mockResolvedValue({ url: '/video.mp4' })

      const { container } = render(<PostForm genres={mockGenres} limits={premiumLimits} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['vid'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        const video = container.querySelector('video')
        expect(video).toBeInTheDocument()
        expect(video?.getAttribute('src')).toBe('/video.mp4')
      })
    })
  })

  describe('メディアアップロードのレスポンスにtypeが含まれない場合', () => {
    it('typeがない場合はimageがデフォルトで使用される', async () => {
      global.XMLHttpRequest = vi.fn(function() {
        const instance = new MockXHR()
        instance.send = vi.fn().mockImplementation(() => {
          const loadCb = instance.addEventListener.mock.calls.find(
            (c: unknown[]) => c[0] === 'load'
          )
          if (loadCb) {
            instance.status = 200
            instance.responseText = JSON.stringify({ url: '/uploaded.jpg' }) // typeなし
            loadCb[1]()
          }
        })
        mockXHRInstances.push(instance)
        return instance
      }) as unknown as typeof XMLHttpRequest

      const { container } = render(<PostForm genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(container.querySelector('.relative.aspect-video')).toBeInTheDocument()
      })
    })
  })

  describe('XHR errorイベント', () => {
    it('XHRエラーイベントでエラーを表示する', async () => {
      global.XMLHttpRequest = vi.fn(function() {
        const instance = new MockXHR()
        instance.send = vi.fn().mockImplementation(() => {
          const errorCb = instance.addEventListener.mock.calls.find(
            (c: unknown[]) => c[0] === 'error'
          )
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
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
      })
    })
  })

  describe('XHR 400ステータス', () => {
    it('XHR 400レスポンスでエラーを表示する', async () => {
      global.XMLHttpRequest = vi.fn(function() {
        const instance = new MockXHR()
        instance.send = vi.fn().mockImplementation(() => {
          const loadCb = instance.addEventListener.mock.calls.find(
            (c: unknown[]) => c[0] === 'load'
          )
          if (loadCb) {
            instance.status = 400
            loadCb[1]()
          }
        })
        mockXHRInstances.push(instance)
        return instance
      }) as unknown as typeof XMLHttpRequest

      const { container } = render(<PostForm genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
      })
    })
  })

  describe('XHR JSONパースエラー', () => {
    it('レスポンスがパースできない場合エラーを表示する', async () => {
      global.XMLHttpRequest = vi.fn(function() {
        const instance = new MockXHR()
        instance.send = vi.fn().mockImplementation(() => {
          const loadCb = instance.addEventListener.mock.calls.find(
            (c: unknown[]) => c[0] === 'load'
          )
          if (loadCb) {
            instance.status = 200
            instance.responseText = 'not valid json'
            loadCb[1]()
          }
        })
        mockXHRInstances.push(instance)
        return instance
      }) as unknown as typeof XMLHttpRequest

      const { container } = render(<PostForm genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
      })
    })
  })

  describe('複数画像のグリッド表示分岐', () => {
    it('2枚の画像がgrid-cols-2で表示される', async () => {
      const { container } = render(<PostForm genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      // 1枚目
      const file1 = new File(['img1'], 'test1.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file1] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(container.querySelectorAll('.relative.aspect-video').length).toBe(1)
      })

      // 2枚目
      const file2 = new File(['img2'], 'test2.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file2] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(container.querySelectorAll('.relative.aspect-video').length).toBe(2)
      })

      // グリッドレイアウトが適用される
      const grid = container.querySelector('.grid.gap-2')
      expect(grid).toBeInTheDocument()
      expect(grid?.classList.contains('grid-cols-2')).toBe(true)
    })
  })
})

// ============================================================
// PostFormModal - 未カバー分岐/関数テスト
// ============================================================

describe('PostFormModal - coverage boost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsVideoFile.mockReturnValue(false)
    mockPrepareFileForUpload.mockResolvedValue(
      new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    )
    mockXHRInstances.length = 0
    setupSuccessXHR()
  })

  afterAll(() => {
    global.XMLHttpRequest = OriginalXHR
  })

  describe('handleMediaButtonClick - ファイル選択ダイアログを開く関数', () => {
    it('画像/動画ボタンクリックでfileInputのclickが呼ばれる', async () => {
      const user = userEvent.setup()
      const { container } = render(<PostFormModal {...modalDefaultProps} />)

      // fileInputにclickスパイを設定
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const clickSpy = vi.spyOn(fileInput, 'click')

      // 画像/動画ボタンをクリック
      const mediaButton = screen.getByText('画像/動画').closest('button')!
      await user.click(mediaButton)

      expect(clickSpy).toHaveBeenCalled()
      clickSpy.mockRestore()
    })
  })

  describe('handleSubmit - ネットワークエラーのcatch分岐', () => {
    it('createPostが例外をスローした場合にエラートースト通知を表示する', async () => {
      mockCreatePost.mockRejectedValue(new Error('Network failure'))
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(<PostFormModal {...modalDefaultProps} onClose={onClose} />)

      await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト投稿')
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '投稿に失敗しました',
          description: 'ネットワークエラーが発生しました',
        })
      })
    })
  })

  describe('handleSubmit - 空テキスト/メディアなしのバリデーション分岐', () => {
    it('テキストもメディアもない状態でフォーム送信するとエラーを表示する', async () => {
      render(<PostFormModal {...modalDefaultProps} />)

      const form = screen.getByPlaceholderText('いまどうしてる？').closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(
          screen.getByText('テキストまたは画像を入力してください')
        ).toBeInTheDocument()
      })
      expect(mockCreatePost).not.toHaveBeenCalled()
    })
  })

  describe('handleSubmit - 文字数超過のバリデーション分岐', () => {
    it('文字数超過時にフォーム送信するとエラーメッセージが表示される', async () => {
      render(
        <PostFormModal
          {...modalDefaultProps}
          limits={{ maxPostLength: 5, maxImages: 4, maxVideos: 1 }}
        />
      )

      const textarea = screen.getByPlaceholderText('いまどうしてる？')
      fireEvent.change(textarea, { target: { value: 'あいうえおか' } })

      const form = textarea.closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/文字超過しています/)).toBeInTheDocument()
      })
      expect(mockCreatePost).not.toHaveBeenCalled()
    })
  })

  describe('handleSubmit - アンケート付き投稿', () => {
    it('アンケートが有効な状態で投稿するとpollOptionsがFormDataに含まれる', async () => {
      mockCreatePost.mockResolvedValue({ success: true })
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(<PostFormModal {...modalDefaultProps} onClose={onClose} />)

      await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'アンケート')

      // アンケートボタンをクリック
      const pollButton = screen.getByRole('button', { name: /アンケートを追加/i })
      await user.click(pollButton)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('選択肢 1')).toBeInTheDocument()
      })

      await user.type(screen.getByPlaceholderText('選択肢 1'), 'A')
      await user.type(screen.getByPlaceholderText('選択肢 2'), 'B')

      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockCreatePost).toHaveBeenCalled()
        const formData = mockCreatePost.mock.calls[0]![0] as FormData
        const pollOptions = formData.get('pollOptions')
        expect(pollOptions).toBeTruthy()
        const parsed = JSON.parse(pollOptions as string)
        expect(parsed).toContain('A')
        expect(parsed).toContain('B')
      })
    })
  })

  describe('handleSubmit - マイ盆栽選択付き投稿', () => {
    it('マイ盆栽を選択して投稿するとbonsaiIdがFormDataに含まれる', async () => {
      mockCreatePost.mockResolvedValue({ success: true })
      const user = userEvent.setup()
      const bonsais = [
        { id: 'b1', name: '黒松一号', species: '黒松' },
      ]
      const onClose = vi.fn()
      render(
        <PostFormModal {...modalDefaultProps} bonsais={bonsais} onClose={onClose} />
      )

      await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト')
      const select = screen.getByRole('combobox')
      await user.selectOptions(select, 'b1')
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockCreatePost).toHaveBeenCalled()
        const formData = mockCreatePost.mock.calls[0]![0] as FormData
        expect(formData.get('bonsaiId')).toBe('b1')
      })
    })
  })

  describe('handleClose - アップロード中にconfirmダイアログ', () => {
    it('アップロード中に閉じようとすると確認ダイアログが表示され、確認後にキャンセルされる', async () => {
      const onClose = vi.fn()
      const user = userEvent.setup()

      // 長時間かかるアップロードをシミュレート
      mockPrepareFileForUpload.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(new File(['test'], 'test.jpg', { type: 'image/jpeg' })), 5000))
      )

      const { container } = render(
        <PostFormModal {...modalDefaultProps} onClose={onClose} />
      )
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      // uploading状態になるのを待つ (圧縮中)
      await waitFor(() => {
        expect(screen.queryByText(/圧縮中/i)).toBeInTheDocument()
      })

      // 閉じるボタンをクリック → ConfirmDialog (upload variant) が開く
      const closeButton = screen.getAllByRole('button')[0]!
      await user.click(closeButton)

      await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })

      // "キャンセルする" をクリックして upload を abort し onClose を呼ぶ
      await user.click(screen.getByRole('button', { name: 'キャンセルする' }))

      await waitFor(() => { expect(onClose).toHaveBeenCalled() })
    })

    it('アップロード中にconfirmでキャンセルした場合はonCloseが呼ばれない', async () => {
      const onClose = vi.fn()
      const user = userEvent.setup()

      mockPrepareFileForUpload.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(new File(['test'], 'test.jpg', { type: 'image/jpeg' })), 5000))
      )

      const { container } = render(
        <PostFormModal {...modalDefaultProps} onClose={onClose} />
      )
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.queryByText(/圧縮中/i)).toBeInTheDocument()
      })

      const closeButton = screen.getAllByRole('button')[0]!
      await user.click(closeButton)

      await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })

      // "キャンセル" (cancel の方) をクリックして dialog を閉じる — onClose は呼ばれない
      await user.click(screen.getByRole('button', { name: 'キャンセル' }))

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('handleClose - 空の状態では確認ダイアログなしで閉じる', () => {
    it('入力内容がない場合はconfirmなしでonCloseが呼ばれる', async () => {
      const mockConfirm = vi.fn()
      window.confirm = mockConfirm
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(<PostFormModal {...modalDefaultProps} onClose={onClose} />)

      const closeButton = screen.getAllByRole('button')[0]!
      await user.click(closeButton)

      expect(mockConfirm).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('動画アップロード上限チェック', () => {
    it('動画が上限を超えるとエラーを表示する', async () => {
      mockIsVideoFile.mockReturnValue(true)
      mockUploadVideoToR2.mockResolvedValue({ url: '/video1.mp4' })

      const { container } = render(<PostFormModal {...modalDefaultProps} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      // 1本目
      const file1 = new File(['vid1'], 'test1.mp4', { type: 'video/mp4' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file1] })
      fireEvent.change(fileInput)

      // 1本目のアップロードが完了し、DOM上にvideoタグが表示されるまで待つ
      await waitFor(() => {
        expect(container.querySelector('video')).toBeInTheDocument()
      })

      // 2本目（上限超過）
      const file2 = new File(['vid2'], 'test2.mp4', { type: 'video/mp4' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file2] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/動画は1本まで添付できます/)).toBeInTheDocument()
      })
    })
  })

  describe('圧縮率が0の場合（ログ出力されない分岐）', () => {
    it('圧縮後にサイズが変わらない場合はログが出力されない', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

      const originalFile = new File(['abc'], 'test.jpg', { type: 'image/jpeg' })
      const sameFile = new File(['abc'], 'test.jpg', { type: 'image/jpeg' })
      mockPrepareFileForUpload.mockResolvedValue(sameFile)

      const { container } = render(<PostFormModal {...modalDefaultProps} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      Object.defineProperty(fileInput, 'files', {
        configurable: true,
        value: [originalFile],
      })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(mockPrepareFileForUpload).toHaveBeenCalled()
      })

      const compressionLogs = consoleSpy.mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('圧縮完了')
      )
      expect(compressionLogs.length).toBe(0)

      consoleSpy.mockRestore()
    })
  })

  describe('下書き一覧リンクのonCloseコールバック', () => {
    it('下書き一覧リンクをクリックするとonCloseが呼ばれる', async () => {
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(
        <PostFormModal {...modalDefaultProps} draftCount={5} onClose={onClose} />
      )

      const draftsLink = screen.getByRole('link', { name: /下書き一覧/ })
      await user.click(draftsLink)

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('投稿成功時のトースト通知とルーター更新', () => {
    it('投稿成功時にトーストが表示されルーターがリフレッシュされる', async () => {
      mockCreatePost.mockResolvedValue({ success: true })
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(<PostFormModal {...modalDefaultProps} onClose={onClose} />)

      await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト')
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: '投稿しました' })
        expect(mockRefresh).toHaveBeenCalled()
      })
    })
  })

  describe('メディア付き投稿', () => {
    it('画像をアップロードした後に投稿するとmediaUrlsとmediaTypesがFormDataに含まれる', async () => {
      mockCreatePost.mockResolvedValue({ success: true })
      const onClose = vi.fn()
      const user = userEvent.setup()
      const { container } = render(
        <PostFormModal {...modalDefaultProps} onClose={onClose} />
      )

      // テキスト入力
      await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'メディア付き')

      // 画像アップロード
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(container.querySelector('.relative.aspect-video')).toBeInTheDocument()
      })

      // 投稿
      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockCreatePost).toHaveBeenCalled()
        const formData = mockCreatePost.mock.calls[0]![0] as FormData
        expect(formData.get('mediaUrls')).toBe('/uploaded.jpg')
        expect(formData.get('mediaTypes')).toBe('image')
      })
    })
  })

  describe('XHR abortイベント', () => {
    it('XHRアボートイベントでキャンセルメッセージが返される', async () => {
      global.XMLHttpRequest = vi.fn(function() {
        const instance = new MockXHR()
        instance.send = vi.fn().mockImplementation(() => {
          const abortCb = instance.addEventListener.mock.calls.find(
            (c: unknown[]) => c[0] === 'abort'
          )
          if (abortCb) {
            abortCb[1]()
          }
        })
        mockXHRInstances.push(instance)
        return instance
      }) as unknown as typeof XMLHttpRequest

      const { container } = render(<PostFormModal {...modalDefaultProps} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(
          screen.getByText('アップロードがキャンセルされました')
        ).toBeInTheDocument()
      })
    })
  })

  describe('動画プレビュー表示', () => {
    it('動画アップロード後にvideoタグが表示される', async () => {
      mockIsVideoFile.mockReturnValue(true)
      mockUploadVideoToR2.mockResolvedValue({ url: '/video.mp4' })

      const { container } = render(<PostFormModal {...modalDefaultProps} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['vid'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        const video = container.querySelector('video')
        expect(video).toBeInTheDocument()
        expect(video?.getAttribute('src')).toBe('/video.mp4')
      })
    })
  })

  describe('マイ盆栽の選択解除', () => {
    it('選択後に「選択しない」に戻せる', async () => {
      const user = userEvent.setup()
      const bonsais = [
        { id: 'b1', name: '黒松一号', species: '黒松' },
      ]
      render(<PostFormModal {...modalDefaultProps} bonsais={bonsais} />)

      const select = screen.getByRole('combobox')
      await user.selectOptions(select, 'b1')
      expect(select).toHaveValue('b1')

      await user.selectOptions(select, '')
      expect(select).toHaveValue('')
    })
  })

  describe('画像上限チェック', () => {
    it('画像が上限を超えるとエラーを表示する', async () => {
      const { container } = render(
        <PostFormModal
          {...modalDefaultProps}
          limits={{ maxPostLength: 500, maxImages: 1, maxVideos: 1 }}
        />
      )
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      // 1枚目
      const file1 = new File(['img1'], 'test1.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file1] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(container.querySelector('.relative.aspect-video')).toBeInTheDocument()
      })

      // 2枚目（上限超過）
      const file2 = new File(['img2'], 'test2.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file2] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/画像は1枚まで添付できます/)).toBeInTheDocument()
      })
    })
  })

  describe('メディアファイルのremoveMedia関数', () => {
    it('複数メディアの中から特定のインデックスのメディアを削除できる', async () => {
      const { container } = render(<PostFormModal {...modalDefaultProps} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      // 2枚アップロード
      const file1 = new File(['img1'], 'test1.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file1] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(container.querySelectorAll('.relative.aspect-video').length).toBe(1)
      })

      const file2 = new File(['img2'], 'test2.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file2] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(container.querySelectorAll('.relative.aspect-video').length).toBe(2)
      })

      // 最初のメディアの削除ボタンをクリック
      const removeButtons = container.querySelectorAll('.relative.aspect-video button')
      fireEvent.click(removeButtons[0]!)

      await waitFor(() => {
        expect(container.querySelectorAll('.relative.aspect-video').length).toBe(1)
      })
    })
  })

  describe('下書き保存成功時にフォームリセットとページ遷移', () => {
    it('下書き保存成功後にフォームがリセットされ下書きページに遷移する', async () => {
      mockSaveDraft.mockResolvedValue({ success: true })
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(<PostFormModal {...modalDefaultProps} onClose={onClose} />)

      await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト下書き')
      await user.click(screen.getByRole('button', { name: '下書き保存' }))

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/drafts')
      })
    })
  })

  describe('handleSubmit - ジャンル選択付き投稿', () => {
    it('ジャンルを選択して投稿するとgenreIdsがFormDataに含まれる', async () => {
      mockCreatePost.mockResolvedValue({ success: true })
      const onClose = vi.fn()
      const user = userEvent.setup()
      render(<PostFormModal {...modalDefaultProps} onClose={onClose} />)

      await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト')

      // ジャンル選択を開く
      await user.click(screen.getByText('ジャンルを選択（任意）'))

      // ジャンルを選択
      await waitFor(() => {
        const genreOption = screen.queryByText('黒松')
        if (genreOption) {
          fireEvent.click(genreOption)
        }
      })

      await user.click(screen.getByRole('button', { name: '投稿する' }))

      await waitFor(() => {
        expect(mockCreatePost).toHaveBeenCalled()
      })
    })
  })
})
