

import { vi } from 'vitest'
import {
  compressImage,
  prepareFileForUpload,
  uploadVideoToR2,
} from '@/lib/client-image-compression'

describe('client-image-compression カバレッジ向上テスト', () => {
  // ============================================================
  // compressImage - 大きなファイルの圧縮テスト
  // ============================================================

  describe('compressImage - 大きなファイルの圧縮', () => {
    let mockDrawImage: ReturnType<typeof vi.fn>
    let mockToBlob: ReturnType<typeof vi.fn>
    let mockGetContext: ReturnType<typeof vi.fn>
    let originalCreateElement: typeof document.createElement
    let originalCreateObjectURL: typeof URL.createObjectURL
    let originalRevokeObjectURL: typeof URL.revokeObjectURL
    let OriginalImage: typeof Image

    beforeEach(() => {
      mockDrawImage = vi.fn()
      mockToBlob = vi.fn()
      mockGetContext = vi.fn(() => ({
        drawImage: mockDrawImage,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      }))

      // document.createElementのモック
      originalCreateElement = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: mockGetContext,
            toBlob: mockToBlob,
          } as unknown as HTMLCanvasElement
        }
        return originalCreateElement(tag)
      })

      // URL APIのモック
      originalCreateObjectURL = URL.createObjectURL
      originalRevokeObjectURL = URL.revokeObjectURL
      URL.createObjectURL = vi.fn(() => 'blob:mock')
      URL.revokeObjectURL = vi.fn()

      // Imageコンストラクタのモック
      OriginalImage = globalThis.Image
      class MockImage {
        width = 2000
        height = 1000
        src = ''
        onload: (() => void) | null = null
        onerror: (() => void) | null = null

        constructor() {
          // 非同期でonloadを呼び出す
          setTimeout(() => {
            if (this.onload) {
              this.onload()
            }
          }, 0)
        }
      }
      globalThis.Image = MockImage as unknown as typeof Image
    })

    afterEach(() => {
      vi.restoreAllMocks()
      URL.createObjectURL = originalCreateObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL
      globalThis.Image = OriginalImage
    })

    it('500KBを超える画像ファイルを圧縮する', async () => {
      // toBlobのモック - 圧縮されたBlobを返す
      mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
        cb(new Blob(['compressed'], { type: 'image/jpeg' }))
      })

      // 600KBの大きなファイルを作成
      const largeData = new Uint8Array(600 * 1024)
      const file = new File([largeData], 'large.jpg', { type: 'image/jpeg' })

      const result = await compressImage(file)

      expect(result.file).not.toBe(file) // 新しいファイルが返される
      expect(result.originalSize).toBe(file.size)
      expect(result.compressedSize).toBeLessThan(result.originalSize)
      expect(result.compressionRatio).toBeGreaterThan(0)
      expect(mockGetContext).toHaveBeenCalled()
      expect(mockDrawImage).toHaveBeenCalled()
      expect(URL.createObjectURL).toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalled()
    })

    it('横長画像（landscape）を正しくリサイズする', async () => {
      // 横長の画像（width > height）
      class LandscapeImage {
        width = 3840 // 4K横長
        height = 2160
        src = ''
        onload: (() => void) | null = null
        onerror: (() => void) | null = null

        constructor() {
          setTimeout(() => {
            if (this.onload) {
              this.onload()
            }
          }, 0)
        }
      }
      globalThis.Image = LandscapeImage as unknown as typeof Image

      mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
        cb(new Blob(['compressed'], { type: 'image/jpeg' }))
      })

      const largeData = new Uint8Array(600 * 1024)
      const file = new File([largeData], 'landscape.jpg', { type: 'image/jpeg' })

      await compressImage(file)

      expect(mockDrawImage).toHaveBeenCalled()
    })

    it('縦長画像（portrait）を正しくリサイズする', async () => {
      // 縦長の画像（height > width）
      class PortraitImage {
        width = 1080
        height = 1920 // 縦長
        src = ''
        onload: (() => void) | null = null
        onerror: (() => void) | null = null

        constructor() {
          setTimeout(() => {
            if (this.onload) {
              this.onload()
            }
          }, 0)
        }
      }
      globalThis.Image = PortraitImage as unknown as typeof Image

      mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
        cb(new Blob(['compressed'], { type: 'image/jpeg' }))
      })

      const largeData = new Uint8Array(600 * 1024)
      const file = new File([largeData], 'portrait.jpg', { type: 'image/jpeg' })

      await compressImage(file)

      expect(mockDrawImage).toHaveBeenCalled()
    })

    it('小さい画像（maxSize以下）はリサイズしない', async () => {
      // 小さい画像（1920以下）
      class SmallImage {
        width = 800
        height = 600
        src = ''
        onload: (() => void) | null = null
        onerror: (() => void) | null = null

        constructor() {
          setTimeout(() => {
            if (this.onload) {
              this.onload()
            }
          }, 0)
        }
      }
      globalThis.Image = SmallImage as unknown as typeof Image

      mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
        cb(new Blob(['compressed'], { type: 'image/jpeg' }))
      })

      const largeData = new Uint8Array(600 * 1024)
      const file = new File([largeData], 'small.jpg', { type: 'image/jpeg' })

      await compressImage(file)

      expect(mockDrawImage).toHaveBeenCalled()
    })

    it('品質を段階的に下げて目標サイズに収める', async () => {
      let callCount = 0

      // 最初は大きいBlobを返し、2回目で小さいBlobを返す
      mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
        callCount++
        if (callCount === 1) {
          // 最初: 2MBの大きなBlob（目標1MB超過）
          const largeBlob = new Blob([new Uint8Array(2 * 1024 * 1024)], {
            type: 'image/jpeg',
          })
          cb(largeBlob)
        } else {
          // 2回目以降: 小さなBlob
          cb(new Blob(['compressed'], { type: 'image/jpeg' }))
        }
      })

      const largeData = new Uint8Array(600 * 1024)
      const file = new File([largeData], 'quality-test.jpg', {
        type: 'image/jpeg',
      })

      const result = await compressImage(file, { maxSizeMB: 1 })

      expect(mockToBlob).toHaveBeenCalledTimes(2) // 2回試行
      expect(result.compressedSize).toBeLessThan(2 * 1024 * 1024)
    })

    it('Canvas contextがnullの場合はエラーハンドリングして元ファイルを返す', async () => {
      // getContextがnullを返すモック
      mockGetContext.mockReturnValue(null)

      const largeData = new Uint8Array(600 * 1024)
      const file = new File([largeData], 'error.jpg', { type: 'image/jpeg' })

      const result = await compressImage(file)

      expect(result.file).toBe(file) // 元のファイルを返す
      expect(result.compressionRatio).toBe(0)
    })

    it('画像読み込みエラー時は元ファイルを返す', async () => {
      // 画像読み込み失敗のモック
      class ErrorImage {
        width = 0
        height = 0
        src = ''
        onload: (() => void) | null = null
        onerror: (() => void) | null = null

        constructor() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror()
            }
          }, 0)
        }
      }
      globalThis.Image = ErrorImage as unknown as typeof Image

      const largeData = new Uint8Array(600 * 1024)
      const file = new File([largeData], 'error.jpg', { type: 'image/jpeg' })

      const result = await compressImage(file)

      expect(result.file).toBe(file)
      expect(result.compressionRatio).toBe(0)
      expect(URL.revokeObjectURL).toHaveBeenCalled()
    })

    it('canvasToBlob失敗時は元ファイルを返す', async () => {
      // toBlobでnullを返す
      mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
        cb(null)
      })

      const largeData = new Uint8Array(600 * 1024)
      const file = new File([largeData], 'blob-error.jpg', {
        type: 'image/jpeg',
      })

      const result = await compressImage(file)

      expect(result.file).toBe(file)
      expect(result.compressionRatio).toBe(0)
    })

    it('カスタムオプションで圧縮する', async () => {
      mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
        cb(new Blob(['compressed'], { type: 'image/jpeg' }))
      })

      const largeData = new Uint8Array(600 * 1024)
      const file = new File([largeData], 'custom.jpg', { type: 'image/jpeg' })

      await compressImage(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1280,
        quality: 0.7,
      })

      expect(mockDrawImage).toHaveBeenCalled()
      expect(mockToBlob).toHaveBeenCalled()
    })
  })

  // ============================================================
  // prepareFileForUpload - 画像ファイルの処理
  // ============================================================

  describe('prepareFileForUpload - 画像ファイル', () => {
    let mockDrawImage: ReturnType<typeof vi.fn>
    let mockToBlob: ReturnType<typeof vi.fn>
    let mockGetContext: ReturnType<typeof vi.fn>
    let originalCreateElement: typeof document.createElement
    let originalCreateObjectURL: typeof URL.createObjectURL
    let originalRevokeObjectURL: typeof URL.revokeObjectURL
    let OriginalImage: typeof Image

    beforeEach(() => {
      mockDrawImage = vi.fn()
      mockToBlob = vi.fn()
      mockGetContext = vi.fn(() => ({
        drawImage: mockDrawImage,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      }))

      originalCreateElement = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: mockGetContext,
            toBlob: mockToBlob,
          } as unknown as HTMLCanvasElement
        }
        return originalCreateElement(tag)
      })

      originalCreateObjectURL = URL.createObjectURL
      originalRevokeObjectURL = URL.revokeObjectURL
      URL.createObjectURL = vi.fn(() => 'blob:mock')
      URL.revokeObjectURL = vi.fn()

      OriginalImage = globalThis.Image
      class MockImage {
        width = 2000
        height = 1000
        src = ''
        onload: (() => void) | null = null
        onerror: (() => void) | null = null

        constructor() {
          setTimeout(() => {
            if (this.onload) {
              this.onload()
            }
          }, 0)
        }
      }
      globalThis.Image = MockImage as unknown as typeof Image

      mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
        cb(new Blob(['compressed'], { type: 'image/jpeg' }))
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
      URL.createObjectURL = originalCreateObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL
      globalThis.Image = OriginalImage
    })

    it('画像ファイルはcompressImageを呼び出して圧縮する（本番ログ削除済み）', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation()

      // 大きな画像ファイル（圧縮対象）
      const largeData = new Uint8Array(600 * 1024)
      const imageFile = new File([largeData], 'image.jpg', {
        type: 'image/jpeg',
      })

      const result = await prepareFileForUpload(imageFile)

      expect(result.name).toContain('.jpg')
      expect(consoleLogSpy).not.toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })

    it('圧縮率が0の場合はログを出力しない', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation()

      // 小さな画像ファイル（圧縮スキップ）
      const smallData = new Uint8Array(400 * 1024)
      const imageFile = new File([smallData], 'small.jpg', {
        type: 'image/jpeg',
      })

      await prepareFileForUpload(imageFile)

      // 圧縮スキップの場合はログが出ない
      expect(consoleLogSpy).not.toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })
  })

  // ============================================================
  // uploadVideoToR2 - 成功パス
  // ============================================================

  describe('uploadVideoToR2 - 成功パス', () => {
    let originalFetch: typeof global.fetch
    let originalXHR: typeof XMLHttpRequest

    beforeEach(() => {
      originalFetch = global.fetch
      originalXHR = global.XMLHttpRequest
    })

    afterEach(() => {
      global.fetch = originalFetch
      global.XMLHttpRequest = originalXHR
    })

    it('正常にアップロードが完了する', async () => {
      // Presigned URL取得のモック
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            presignedUrl: 'https://r2.example.com/upload',
            fileUrl: 'https://r2.example.com/videos/video.mp4',
          }),
      })

      const mockOpen = vi.fn()
      const mockSend = vi.fn()
      const mockSetRequestHeader = vi.fn()
      const mockAddEventListener = vi.fn()
      const mockUploadAddEventListener = vi.fn()

      // XMLHttpRequestのモック
      global.XMLHttpRequest = vi.fn().mockImplementation(function() {
        const xhr = {
          open: mockOpen,
          send: mockSend,
          setRequestHeader: mockSetRequestHeader,
          addEventListener: mockAddEventListener,
          upload: { addEventListener: mockUploadAddEventListener },
          status: 200,
        }

        // sendが呼ばれたらloadイベントを発火
        mockSend.mockImplementation(() => {
          setTimeout(() => {
            const loadHandler = mockAddEventListener.mock.calls.find(
              (call: [string, () => void]) => call[0] === 'load'
            )
            if (loadHandler) {
              loadHandler[1]()
            }
          }, 0)
        })

        return xhr
      }) as unknown as typeof XMLHttpRequest

      const videoFile = new File(['video content'], 'test.mp4', {
        type: 'video/mp4',
      })

      const result = await uploadVideoToR2(videoFile)

      expect(result.url).toBe('https://r2.example.com/videos/video.mp4')
      expect(result.error).toBeUndefined()
      expect(mockOpen).toHaveBeenCalledWith(
        'PUT',
        'https://r2.example.com/upload'
      )
      expect(mockSetRequestHeader).toHaveBeenCalledWith(
        'Content-Type',
        'video/mp4'
      )
      expect(mockSend).toHaveBeenCalledWith(videoFile)
    })

    it('プログレスコールバックが正しく呼ばれる', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            presignedUrl: 'https://r2.example.com/upload',
            fileUrl: 'https://r2.example.com/videos/video.mp4',
          }),
      })

      const mockAddEventListener = vi.fn()
      const mockUploadAddEventListener = vi.fn()

      global.XMLHttpRequest = vi.fn().mockImplementation(function() { return {
        open: vi.fn(),
        send: vi.fn().mockImplementation(() => {
          // loadイベントを発火
          setTimeout(() => {
            const loadHandler = mockAddEventListener.mock.calls.find(
              (call: [string, () => void]) => call[0] === 'load'
            )
            if (loadHandler) {
              loadHandler[1]()
            }
          }, 0)
        }),
        setRequestHeader: vi.fn(),
        addEventListener: mockAddEventListener,
        upload: { addEventListener: mockUploadAddEventListener },
        status: 200,
      } }) as unknown as typeof XMLHttpRequest

      const onProgress = vi.fn()
      const videoFile = new File(['video content'], 'test.mp4', {
        type: 'video/mp4',
      })

      const uploadPromise = uploadVideoToR2(videoFile, 'posts', onProgress)

      // 少し待ってからprogressイベントをシミュレート
      await new Promise((resolve) => setTimeout(resolve, 10))

      const progressHandler = mockUploadAddEventListener.mock.calls.find(
        (call: [string, (event: ProgressEvent) => void]) =>
          call[0] === 'progress'
      )

      if (progressHandler) {
        const mockProgressEvent = {
          lengthComputable: true,
          loaded: 5000000,
          total: 10000000,
        } as ProgressEvent
        progressHandler[1](mockProgressEvent)
      }

      expect(onProgress).toHaveBeenCalledWith(50)

      await uploadPromise
    })

    it('アップロード中にabortイベントが発生した場合', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            presignedUrl: 'https://r2.example.com/upload',
            fileUrl: 'https://r2.example.com/videos/video.mp4',
          }),
      })

      const mockAddEventListener = vi.fn()

      global.XMLHttpRequest = vi.fn().mockImplementation(function() { return {
        open: vi.fn(),
        send: vi.fn().mockImplementation(() => {
          setTimeout(() => {
            const abortHandler = mockAddEventListener.mock.calls.find(
              (call: [string, () => void]) => call[0] === 'abort'
            )
            if (abortHandler) {
              abortHandler[1]()
            }
          }, 0)
        }),
        setRequestHeader: vi.fn(),
        addEventListener: mockAddEventListener,
        upload: { addEventListener: vi.fn() },
        status: 0,
      } }) as unknown as typeof XMLHttpRequest

      const videoFile = new File(['video content'], 'test.mp4', {
        type: 'video/mp4',
      })

      const result = await uploadVideoToR2(videoFile)

      expect(result.error).toBe('アップロードがキャンセルされました')
    })

    it('アップロードステータスが300以上の場合はエラーを返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            presignedUrl: 'https://r2.example.com/upload',
            fileUrl: 'https://r2.example.com/videos/video.mp4',
          }),
      })

      const mockAddEventListener = vi.fn()

      global.XMLHttpRequest = vi.fn().mockImplementation(function() { return {
        open: vi.fn(),
        send: vi.fn().mockImplementation(() => {
          setTimeout(() => {
            const loadHandler = mockAddEventListener.mock.calls.find(
              (call: [string, () => void]) => call[0] === 'load'
            )
            if (loadHandler) {
              loadHandler[1]()
            }
          }, 0)
        }),
        setRequestHeader: vi.fn(),
        addEventListener: mockAddEventListener,
        upload: { addEventListener: vi.fn() },
        status: 403,
      } }) as unknown as typeof XMLHttpRequest

      const videoFile = new File(['video content'], 'test.mp4', {
        type: 'video/mp4',
      })

      const result = await uploadVideoToR2(videoFile)

      expect(result.error).toBe('アップロードに失敗しました')
    })

    it('カスタムフォルダパスを指定してアップロードする', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            presignedUrl: 'https://r2.example.com/upload',
            fileUrl: 'https://r2.example.com/custom/video.mp4',
          }),
      })

      const mockAddEventListener = vi.fn()

      global.XMLHttpRequest = vi.fn().mockImplementation(function() { return {
        open: vi.fn(),
        send: vi.fn().mockImplementation(() => {
          setTimeout(() => {
            const loadHandler = mockAddEventListener.mock.calls.find(
              (call: [string, () => void]) => call[0] === 'load'
            )
            if (loadHandler) {
              loadHandler[1]()
            }
          }, 0)
        }),
        setRequestHeader: vi.fn(),
        addEventListener: mockAddEventListener,
        upload: { addEventListener: vi.fn() },
        status: 200,
      } }) as unknown as typeof XMLHttpRequest

      const videoFile = new File(['video content'], 'test.mp4', {
        type: 'video/mp4',
      })

      const result = await uploadVideoToR2(videoFile, 'custom')

      expect(global.fetch).toHaveBeenCalledWith('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'video/mp4',
          fileSize: videoFile.size,
          folder: 'custom',
        }),
      })
      expect(result.url).toBe('https://r2.example.com/custom/video.mp4')
    })
  })
})
