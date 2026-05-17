import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn(),
  isVideoFile: vi.fn().mockReturnValue(false),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: vi.fn(),
}))

import { uploadFileViaXhr } from '@/components/post/hooks/useMediaUpload'

type XhrHandler = (...args: unknown[]) => void

let lastXhr: {
  status: number
  responseText: string
  upload: { addEventListener: ReturnType<typeof vi.fn> }
  addEventListener: ReturnType<typeof vi.fn>
  open: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  _handlers: Record<string, XhrHandler>
  _uploadHandlers: Record<string, XhrHandler>
}

class MockXHR {
  status = 200
  responseText = '{"url":"/uploaded.jpg","type":"image"}'
  _handlers: Record<string, XhrHandler> = {}
  _uploadHandlers: Record<string, XhrHandler> = {}
  upload = {
    addEventListener: vi.fn((event: string, handler: XhrHandler) => {
      this._uploadHandlers[event] = handler
    }),
  }
  addEventListener = vi.fn((event: string, handler: XhrHandler) => {
    this._handlers[event] = handler
  })
  open = vi.fn()
  send = vi.fn()

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastXhr = this
  }
}

const OriginalXHR = globalThis.XMLHttpRequest

beforeEach(() => {
  globalThis.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest
})

afterEach(() => {
  globalThis.XMLHttpRequest = OriginalXHR
})

describe('uploadFileViaXhr', () => {
  const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

  it('正常アップロードでレスポンスを返す', async () => {
    const promise = uploadFileViaXhr(testFile)
    lastXhr._handlers.load()
    const result = await promise
    expect(result).toEqual({ url: '/uploaded.jpg', type: 'image' })
    expect(lastXhr.open).toHaveBeenCalledWith('POST', '/api/upload')
    expect(lastXhr.send).toHaveBeenCalled()
  })

  it('onProgress コールバックが呼ばれる', async () => {
    const onProgress = vi.fn()
    const promise = uploadFileViaXhr(testFile, { onProgress })

    expect(lastXhr.upload.addEventListener).toHaveBeenCalledWith('progress', expect.any(Function))
    lastXhr._uploadHandlers.progress({ lengthComputable: true, loaded: 50, total: 100 })
    expect(onProgress).toHaveBeenCalledWith(50)

    lastXhr._handlers.load()
    await promise
  })

  it('lengthComputable=false の場合 onProgress は呼ばれない', async () => {
    const onProgress = vi.fn()
    const promise = uploadFileViaXhr(testFile, { onProgress })

    lastXhr._uploadHandlers.progress({ lengthComputable: false, loaded: 50, total: 100 })
    expect(onProgress).not.toHaveBeenCalled()

    lastXhr._handlers.load()
    await promise
  })

  it('HTTPエラーの場合エラーを返す', async () => {
    const promise = uploadFileViaXhr(testFile)
    lastXhr.status = 500
    lastXhr._handlers.load()
    const result = await promise
    expect(result).toEqual({ error: 'アップロードに失敗しました' })
  })

  it('レスポンスのJSON解析失敗時にエラーを返す', async () => {
    const promise = uploadFileViaXhr(testFile)
    lastXhr.responseText = 'invalid json'
    lastXhr._handlers.load()
    const result = await promise
    expect(result).toEqual({ error: 'アップロードに失敗しました' })
  })

  it('ネットワークエラー時にエラーを返す', async () => {
    const promise = uploadFileViaXhr(testFile)
    lastXhr._handlers.error()
    const result = await promise
    expect(result).toEqual({ error: 'アップロードに失敗しました' })
  })

  it('onProgress なしでも動作する', async () => {
    const promise = uploadFileViaXhr(testFile)
    expect(lastXhr.upload.addEventListener).not.toHaveBeenCalled()
    lastXhr._handlers.load()
    const result = await promise
    expect(result).toEqual({ url: '/uploaded.jpg', type: 'image' })
  })
})
