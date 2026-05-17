/**
 * useMediaUpload のユニットテスト。
 *
 * - 画像/動画の上限チェック
 * - ファイルサイズの上限チェック
 * - 動画は uploadVideoToR2 経由
 * - 画像は prepareFileForUpload + XHR
 * - エラーパス（ネットワーク失敗・JSON 失敗・5xx）
 */

import { vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// lib/client-image-compression は実際のモジュールではブラウザ専用のため node 環境でモック
const mockPrepareFile = vi.fn()
const mockIsVideo = vi.fn()
const mockUploadVideo = vi.fn()
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: (...args: unknown[]) => mockPrepareFile(...args),
  isVideoFile: (...args: unknown[]) => mockIsVideo(...args),
  uploadVideoToR2: (...args: unknown[]) => mockUploadVideo(...args),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
}))

import { useMediaUpload } from '@/hooks/use-media-upload'

function createFile(name: string, size: number, type: string): File {
  // Blob で size を制御するテスト用 File を作成
  const buf = new Uint8Array(Math.min(size, 16))
  const file = new File([buf], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('useMediaUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsVideo.mockReturnValue(false)
  })

  it('画像が上限に達している場合は onError を呼び中断する', async () => {
    const onError = vi.fn()
    const onUploadComplete = vi.fn()
    const { result } = renderHook(() =>
      useMediaUpload({
        maxImages: 4,
        maxVideos: 1,
        currentImageCount: 4,
        currentVideoCount: 0,
        onUploadComplete,
        onError,
      }),
    )
    const file = createFile('a.jpg', 1024, 'image/jpeg')
    await act(async () => {
      await result.current.uploadFile(file)
    })
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('画像は'))
    expect(onUploadComplete).not.toHaveBeenCalled()
  })

  it('動画が上限に達している場合は onError を呼び中断する', async () => {
    const onError = vi.fn()
    const onUploadComplete = vi.fn()
    mockIsVideo.mockReturnValue(true)
    const { result } = renderHook(() =>
      useMediaUpload({
        maxImages: 4,
        maxVideos: 1,
        currentImageCount: 0,
        currentVideoCount: 1,
        onUploadComplete,
        onError,
      }),
    )
    const file = createFile('a.mp4', 1024, 'video/mp4')
    await act(async () => {
      await result.current.uploadFile(file)
    })
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('動画は'))
    expect(mockUploadVideo).not.toHaveBeenCalled()
  })

  it('画像サイズが MAX_IMAGE_SIZE を超える場合は onError を呼ぶ', async () => {
    const onError = vi.fn()
    const onUploadComplete = vi.fn()
    const { result } = renderHook(() =>
      useMediaUpload({
        maxImages: 4,
        maxVideos: 1,
        currentImageCount: 0,
        currentVideoCount: 0,
        onUploadComplete,
        onError,
      }),
    )
    // 上限超過（11MB）
    const file = createFile('big.jpg', 11 * 1024 * 1024, 'image/jpeg')
    await act(async () => {
      await result.current.uploadFile(file)
    })
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('MB以下'))
    expect(onUploadComplete).not.toHaveBeenCalled()
  })

  it('動画は uploadVideoToR2 経由で onUploadComplete が呼ばれる', async () => {
    const onError = vi.fn()
    const onUploadComplete = vi.fn()
    mockIsVideo.mockReturnValue(true)
    mockUploadVideo.mockResolvedValueOnce({ url: 'https://r2.example.com/v.mp4' })
    const { result } = renderHook(() =>
      useMediaUpload({
        maxImages: 4,
        maxVideos: 1,
        currentImageCount: 0,
        currentVideoCount: 0,
        videoUploadPath: 'posts',
        onUploadComplete,
        onError,
      }),
    )
    const file = createFile('v.mp4', 1024 * 1024, 'video/mp4')
    await act(async () => {
      await result.current.uploadFile(file)
    })
    expect(mockUploadVideo).toHaveBeenCalledWith(file, 'posts', expect.any(Function))
    expect(onUploadComplete).toHaveBeenCalledWith({
      url: 'https://r2.example.com/v.mp4',
      type: 'video',
    })
  })

  it('動画 R2 アップロードでエラーが返るときは onError を呼ぶ', async () => {
    const onError = vi.fn()
    const onUploadComplete = vi.fn()
    mockIsVideo.mockReturnValue(true)
    mockUploadVideo.mockResolvedValueOnce({ error: 'R2 アップロード失敗' })
    const { result } = renderHook(() =>
      useMediaUpload({
        maxImages: 4,
        maxVideos: 1,
        currentImageCount: 0,
        currentVideoCount: 0,
        onUploadComplete,
        onError,
      }),
    )
    const file = createFile('v.mp4', 1024, 'video/mp4')
    await act(async () => {
      await result.current.uploadFile(file)
    })
    expect(onError).toHaveBeenCalledWith('R2 アップロード失敗')
    expect(onUploadComplete).not.toHaveBeenCalled()
  })

  it('画像は prepareFileForUpload で圧縮されてから XHR で送信される', async () => {
    const onError = vi.fn()
    const onUploadComplete = vi.fn()
    const compressed = createFile('compressed.jpg', 512, 'image/jpeg')
    mockPrepareFile.mockResolvedValueOnce(compressed)

    // XHR をモック
    class FakeXhr {
      upload = { addEventListener: vi.fn() }
      private listeners: Record<string, () => void> = {}
      status = 200
      responseText = JSON.stringify({ url: 'https://cdn/x.jpg', type: 'image' })
      addEventListener(name: string, fn: () => void) {
        this.listeners[name] = fn
      }
      open(_method: string, _url: string) {
        // no-op
      }
      send(_body: unknown) {
        // 送信即時に load を発火
        setTimeout(() => this.listeners.load?.(), 0)
      }
    }
    const originalXhr = globalThis.XMLHttpRequest
    // @ts-expect-error - test stub for XHR
    globalThis.XMLHttpRequest = FakeXhr

    try {
      const { result } = renderHook(() =>
        useMediaUpload({
          maxImages: 4,
          maxVideos: 1,
          currentImageCount: 0,
          currentVideoCount: 0,
          onUploadComplete,
          onError,
        }),
      )
      const file = createFile('a.jpg', 1024, 'image/jpeg')
      await act(async () => {
        await result.current.uploadFile(file)
      })
      expect(mockPrepareFile).toHaveBeenCalledWith(file, expect.objectContaining({ maxSizeMB: 1 }))
      expect(onUploadComplete).toHaveBeenCalledWith({ url: 'https://cdn/x.jpg', type: 'image' })
    } finally {
      globalThis.XMLHttpRequest = originalXhr
    }
  })

  it('画像 XHR が 500 を返すと onError でアップロード失敗を通知する', async () => {
    const onError = vi.fn()
    const onUploadComplete = vi.fn()
    mockPrepareFile.mockResolvedValueOnce(createFile('c.jpg', 512, 'image/jpeg'))

    class FakeXhr {
      upload = { addEventListener: vi.fn() }
      private listeners: Record<string, () => void> = {}
      status = 500
      responseText = ''
      addEventListener(name: string, fn: () => void) {
        this.listeners[name] = fn
      }
      open() {}
      send() {
        setTimeout(() => this.listeners.load?.(), 0)
      }
    }
    const originalXhr = globalThis.XMLHttpRequest
    // @ts-expect-error - test stub for XHR
    globalThis.XMLHttpRequest = FakeXhr

    try {
      const { result } = renderHook(() =>
        useMediaUpload({
          maxImages: 4,
          maxVideos: 1,
          currentImageCount: 0,
          currentVideoCount: 0,
          onUploadComplete,
          onError,
        }),
      )
      const file = createFile('a.jpg', 1024, 'image/jpeg')
      await act(async () => {
        await result.current.uploadFile(file)
      })
      // ※「画像を圧縮中...」「''」「'アップロードに失敗しました'」の3回呼ばれる
      expect(onError).toHaveBeenLastCalledWith('アップロードに失敗しました')
      expect(onUploadComplete).not.toHaveBeenCalled()
    } finally {
      globalThis.XMLHttpRequest = originalXhr
    }
  })
})
