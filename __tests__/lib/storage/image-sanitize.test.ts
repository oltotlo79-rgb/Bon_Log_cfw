// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// sharp は外部 native ライブラリ。control flow のみ検証するため stub する。
// 実際の EXIF / IPTC / XMP / ICC 剥離挙動は sharp 側の責務。
const mockRotate = vi.fn()
const mockToBuffer = vi.fn()
vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    rotate: () => {
      mockRotate()
      return { toBuffer: () => mockToBuffer() }
    },
  })),
}))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: mockLoggerError, warn: vi.fn(), log: vi.fn(), debug: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('stripImageMetadata', () => {
  it('non-image content-type は原本をそのまま返す (sharp を呼ばない)', async () => {
    const sharp = (await import('sharp')).default
    const { stripImageMetadata } = await import('@/lib/storage/image-sanitize')
    const input = Buffer.from('not an image')
    const result = await stripImageMetadata(input, 'application/pdf')
    expect(result).toBe(input)
    expect(sharp).not.toHaveBeenCalled()
  })

  it('SVG は raster しないため原本をそのまま返す (XSS は別 sanitizer の責務)', async () => {
    const sharp = (await import('sharp')).default
    const { stripImageMetadata } = await import('@/lib/storage/image-sanitize')
    const input = Buffer.from('<svg/>')
    const result = await stripImageMetadata(input, 'image/svg+xml')
    expect(result).toBe(input)
    expect(sharp).not.toHaveBeenCalled()
  })

  it('画像 MIME は sharp().rotate().toBuffer() で再エンコードした buffer を返す', async () => {
    const sharp = (await import('sharp')).default
    const input = Buffer.from([0xff, 0xd8, 0xff]) // JPEG-like marker
    const stripped = Buffer.from([0xde, 0xad, 0xbe, 0xef])
    mockToBuffer.mockResolvedValueOnce(stripped)

    const { stripImageMetadata } = await import('@/lib/storage/image-sanitize')
    const result = await stripImageMetadata(input, 'image/jpeg')

    expect(sharp).toHaveBeenCalledWith(input)
    // rotate() は EXIF orientation を物理画素に焼き込む必須ステップ
    expect(mockRotate).toHaveBeenCalledTimes(1)
    expect(mockToBuffer).toHaveBeenCalledTimes(1)
    expect(result).toBe(stripped)
  })

  it.each([
    ['image/png'],
    ['image/jpeg'],
    ['image/webp'],
    ['image/heic'],
  ])('%s も sharp ルートを通る', async (mime) => {
    const sharp = (await import('sharp')).default
    mockToBuffer.mockResolvedValueOnce(Buffer.from('ok'))
    const { stripImageMetadata } = await import('@/lib/storage/image-sanitize')
    await stripImageMetadata(Buffer.from('x'), mime)
    expect(sharp).toHaveBeenCalled()
  })

  it('sharp が例外を投げた場合は原本を返してログに残す (best-effort 方針)', async () => {
    const input = Buffer.from('broken')
    mockToBuffer.mockRejectedValueOnce(new Error('sharp boom'))

    const { stripImageMetadata } = await import('@/lib/storage/image-sanitize')
    const result = await stripImageMetadata(input, 'image/png')

    expect(result).toBe(input)
    expect(mockLoggerError).toHaveBeenCalledWith(
      'stripImageMetadata failed',
      expect.objectContaining({ error: 'sharp boom', contentType: 'image/png' }),
    )
  })

  it('non-Error 例外でも logger に文字列化して渡す', async () => {
    const input = Buffer.from('x')
    mockToBuffer.mockRejectedValueOnce('string error')
    const { stripImageMetadata } = await import('@/lib/storage/image-sanitize')
    const result = await stripImageMetadata(input, 'image/png')
    expect(result).toBe(input)
    expect(mockLoggerError).toHaveBeenCalledWith(
      'stripImageMetadata failed',
      expect.objectContaining({ error: 'string error' }),
    )
  })

  it('image/ で始まらない content-type は厳密に除外される', async () => {
    const sharp = (await import('sharp')).default
    const { stripImageMetadata } = await import('@/lib/storage/image-sanitize')
    // 紛らわしい mime (text/ で始まる) も sharp を呼ばない
    await stripImageMetadata(Buffer.from('x'), 'text/image-related')
    await stripImageMetadata(Buffer.from('x'), 'video/mp4')
    await stripImageMetadata(Buffer.from('x'), '')
    expect(sharp).not.toHaveBeenCalled()
  })
})
