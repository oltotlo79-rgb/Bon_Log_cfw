/**
 * client-image-compression - 未カバー分岐テスト
 *
 * 対象:
 * - line 134: blob が null のまま for ループを抜けた場合 (防御的チェック)
 * - line 197: calculateDimensions の else 分岐 (height >= width かつ両方 > maxSize)
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { compressImage } from '@/lib/client-image-compression'

describe('client-image-compression - 追加分岐カバレッジ', () => {
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
  })

  afterEach(() => {
    vi.restoreAllMocks()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    globalThis.Image = OriginalImage
  })

  describe('calculateDimensions - 正方形画像が maxSize を超える場合 (else 分岐)', () => {
    it('正方形画像（width === height > maxSize）で else 分岐に入る', async () => {
      // 正方形で maxSize (1920) を超える画像
      class SquareImage {
        width = 3000
        height = 3000
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
      globalThis.Image = SquareImage as unknown as typeof Image

      mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
        cb(new Blob(['compressed'], { type: 'image/jpeg' }))
      })

      const largeData = new Uint8Array(600 * 1024)
      const file = new File([largeData], 'square.jpg', { type: 'image/jpeg' })

      const result = await compressImage(file)

      // 正方形画像は else 分岐（height >= width）に入り、
      // width = Math.round((3000/3000) * 1920) = 1920, height = 1920
      expect(result.file).not.toBe(file)
      expect(result.originalSize).toBe(file.size)
      expect(mockDrawImage).toHaveBeenCalled()
    })

    it('縦長画像が maxSize を超える場合に else 分岐に入る', async () => {
      // height > width で両方とも maxSize(1920) を超える
      class TallImage {
        width = 2000
        height = 4000
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
      globalThis.Image = TallImage as unknown as typeof Image

      mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
        cb(new Blob(['compressed'], { type: 'image/jpeg' }))
      })

      const largeData = new Uint8Array(600 * 1024)
      const file = new File([largeData], 'tall.jpg', { type: 'image/jpeg' })

      const result = await compressImage(file)

      // height > width なので else 分岐に入る
      // width = Math.round((2000/4000) * 1920) = 960, height = 1920
      expect(result.file).not.toBe(file)
      expect(mockDrawImage).toHaveBeenCalled()
    })
  })

  describe('compressImage - blob が null のまま for ループを抜ける場合', () => {
    it('MAX_COMPRESSION_RETRIES 回すべて目標サイズを超え、最後の blob が使われる', async () => {
      // 毎回大きなBlobを返す（目標サイズを超え続ける）が、blobは null ではない
      mockToBlob.mockImplementation((cb: (blob: Blob | null) => void) => {
        // 2MBの大きなBlob（1MBの目標を超過）
        const largeBlob = new Blob([new Uint8Array(2 * 1024 * 1024)], { type: 'image/jpeg' })
        cb(largeBlob)
      })

      class MockImage {
        width = 2000
        height = 1000
        src = ''
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        constructor() {
          setTimeout(() => { this.onload?.() }, 0)
        }
      }
      globalThis.Image = MockImage as unknown as typeof Image

      const largeData = new Uint8Array(600 * 1024)
      const file = new File([largeData], 'retry-test.jpg', { type: 'image/jpeg' })

      const result = await compressImage(file, { maxSizeMB: 1 })

      // 3回リトライしてもサイズが大きいが、blob自体はnullではないので正常に返る
      expect(mockToBlob).toHaveBeenCalledTimes(3)
      expect(result.file).not.toBe(file) // 圧縮ファイルが返される（サイズ超過でも）
    })
  })
})
