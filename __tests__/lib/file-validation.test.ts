// @vitest-environment node

import {
  detectFileType,
  validateImageFile,
  validateVideoFile,
  validateMediaFile,
  generateSafeFileName,
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
} from '@/lib/file-validation'

describe('file-validation', () => {
  // ============================================================
  // detectFileType
  // ============================================================

  describe('detectFileType', () => {
    it('JPEGファイルを検出できる（JFIF）', () => {
      const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])
      expect(detectFileType(buffer)).toBe('image/jpeg')
    })

    it('JPEGファイルを検出できる（EXIF）', () => {
      const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x10])
      expect(detectFileType(buffer)).toBe('image/jpeg')
    })

    it('PNGファイルを検出できる', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
      expect(detectFileType(buffer)).toBe('image/png')
    })

    it('WebPファイルを検出できる', () => {
      // RIFF....WEBP
      const buffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // size
        0x57, 0x45, 0x42, 0x50, // WEBP
      ])
      expect(detectFileType(buffer)).toBe('image/webp')
    })

    it('GIF87aを検出できる', () => {
      const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61])
      expect(detectFileType(buffer)).toBe('image/gif')
    })

    it('GIF89aを検出できる', () => {
      const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
      expect(detectFileType(buffer)).toBe('image/gif')
    })

    it('MP4ファイルを検出できる', () => {
      // ....ftyp
      const buffer = Buffer.from([
        0x00, 0x00, 0x00, 0x00, // size
        0x66, 0x74, 0x79, 0x70, // ftyp
      ])
      expect(detectFileType(buffer)).toBe('video/mp4')
    })

    it('WebMファイルを検出できる', () => {
      const buffer = Buffer.from([0x1A, 0x45, 0xDF, 0xA3])
      expect(detectFileType(buffer)).toBe('video/webm')
    })

    it('AVIファイルを検出できる', () => {
      // RIFF....AVI
      const buffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // size
        0x41, 0x56, 0x49, 0x20, // AVI
      ])
      expect(detectFileType(buffer)).toBe('video/x-msvideo')
    })

    it('不明なファイル形式はnullを返す', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03])
      expect(detectFileType(buffer)).toBeNull()
    })

    it('空のバッファはnullを返す', () => {
      const buffer = Buffer.from([])
      expect(detectFileType(buffer)).toBeNull()
    })

    it('短すぎるバッファはnullを返す', () => {
      const buffer = Buffer.from([0xFF, 0xD8])
      expect(detectFileType(buffer)).toBeNull()
    })
  })

  // ============================================================
  // validateImageFile
  // ============================================================

  describe('validateImageFile', () => {
    it('有効なJPEGファイルを検証できる', () => {
      const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])
      const result = validateImageFile(buffer, 'image/jpeg')
      expect(result.valid).toBe(true)
      expect(result.detectedType).toBe('image/jpeg')
    })

    it('有効なPNGファイルを検証できる', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
      const result = validateImageFile(buffer, 'image/png')
      expect(result.valid).toBe(true)
      expect(result.detectedType).toBe('image/png')
    })

    it('許可されていないMIMEタイプは拒否される', () => {
      const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
      const result = validateImageFile(buffer, 'image/gif') // GIFはデフォルトで許可されていない
      expect(result.valid).toBe(false)
      expect(result.error).toContain('許可されていないファイル形式')
    })

    it('カスタム許可タイプでGIFを許可できる', () => {
      const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
      const result = validateImageFile(buffer, 'image/gif', ['image/gif'])
      expect(result.valid).toBe(true)
      expect(result.detectedType).toBe('image/gif')
    })

    it('MIMEタイプ偽装を検出できる（JPEGと偽ったPNG）', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) // PNG
      const result = validateImageFile(buffer, 'image/jpeg', ['image/jpeg'])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('許可されていません')
    })

    it('不明なファイル形式はエラーを返す', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03])
      const result = validateImageFile(buffer, 'image/jpeg')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('ファイル形式を識別できません')
    })
  })

  // ============================================================
  // validateVideoFile
  // ============================================================

  describe('validateVideoFile', () => {
    it('有効なMP4ファイルを検証できる', () => {
      const buffer = Buffer.from([
        0x00, 0x00, 0x00, 0x00,
        0x66, 0x74, 0x79, 0x70,
      ])
      const result = validateVideoFile(buffer, 'video/mp4')
      expect(result.valid).toBe(true)
      expect(result.detectedType).toBe('video/mp4')
    })

    it('有効なWebMファイルを検証できる', () => {
      const buffer = Buffer.from([0x1A, 0x45, 0xDF, 0xA3])
      const result = validateVideoFile(buffer, 'video/webm')
      expect(result.valid).toBe(true)
      expect(result.detectedType).toBe('video/webm')
    })

    it('非動画MIMEタイプは拒否される', () => {
      const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])
      const result = validateVideoFile(buffer, 'image/jpeg')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('動画ファイルを選択')
    })

    it('許可されていない動画形式は拒否される', () => {
      const buffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46,
        0x00, 0x00, 0x00, 0x00,
        0x41, 0x56, 0x49, 0x20,
      ])
      const result = validateVideoFile(buffer, 'video/x-msvideo') // AVIはデフォルトで許可されていない
      expect(result.valid).toBe(false)
      expect(result.error).toContain('対応していません')
    })

    it('不明なファイル形式はエラーを返す', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03])
      const result = validateVideoFile(buffer, 'video/mp4')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('ファイル形式を識別できません')
    })
  })

  // ============================================================
  // validateMediaFile
  // ============================================================

  describe('validateMediaFile', () => {
    it('画像ファイルを適切に検証する', () => {
      const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])
      const result = validateMediaFile(buffer, 'image/jpeg')
      expect(result.valid).toBe(true)
    })

    it('動画ファイルを適切に検証する', () => {
      const buffer = Buffer.from([0x1A, 0x45, 0xDF, 0xA3])
      const result = validateMediaFile(buffer, 'video/webm')
      expect(result.valid).toBe(true)
    })

    it('画像でも動画でもないファイルはエラー', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03])
      const result = validateMediaFile(buffer, 'application/pdf')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('画像または動画ファイル')
    })
  })

  // ============================================================
  // generateSafeFileName
  // ============================================================

  describe('generateSafeFileName', () => {
    it('JPEGファイルに.jpg拡張子を付与する', () => {
      const result = generateSafeFileName('test.jpeg', 'image/jpeg')
      expect(result).toMatch(/^[a-f0-9-]+\.jpg$/)
    })

    it('PNGファイルに.png拡張子を付与する', () => {
      const result = generateSafeFileName('test.png', 'image/png')
      expect(result).toMatch(/^[a-f0-9-]+\.png$/)
    })

    it('WebPファイルに.webp拡張子を付与する', () => {
      const result = generateSafeFileName('test.webp', 'image/webp')
      expect(result).toMatch(/^[a-f0-9-]+\.webp$/)
    })

    it('MP4ファイルに.mp4拡張子を付与する', () => {
      const result = generateSafeFileName('test.mp4', 'video/mp4')
      expect(result).toMatch(/^[a-f0-9-]+\.mp4$/)
    })

    it('MOVファイルに.mov拡張子を付与する', () => {
      const result = generateSafeFileName('test.mov', 'video/quicktime')
      expect(result).toMatch(/^[a-f0-9-]+\.mov$/)
    })

    it('不明なMIMEタイプには.bin拡張子を付与する', () => {
      const result = generateSafeFileName('test.unknown', 'application/octet-stream')
      expect(result).toMatch(/^[a-f0-9-]+\.bin$/)
    })

    it('パストラバーサル攻撃を防止する', () => {
      const result = generateSafeFileName('../../etc/passwd.jpg', 'image/jpeg')
      expect(result).not.toContain('..')
      expect(result).not.toContain('/')
      expect(result).toMatch(/^[a-f0-9-]+\.jpg$/)
    })

    it('毎回異なるファイル名を生成する', () => {
      const result1 = generateSafeFileName('test.jpg', 'image/jpeg')
      const result2 = generateSafeFileName('test.jpg', 'image/jpeg')
      expect(result1).not.toBe(result2)
    })
  })

  // ============================================================
  // Constants
  // ============================================================

  describe('Constants', () => {
    it('IMAGE_MIME_TYPESに正しいタイプが含まれる', () => {
      expect(IMAGE_MIME_TYPES.has('image/jpeg')).toBe(true)
      expect(IMAGE_MIME_TYPES.has('image/png')).toBe(true)
      expect(IMAGE_MIME_TYPES.has('image/webp')).toBe(true)
      expect(IMAGE_MIME_TYPES.has('image/gif')).toBe(true)
    })

    it('VIDEO_MIME_TYPESに正しいタイプが含まれる', () => {
      expect(VIDEO_MIME_TYPES.has('video/mp4')).toBe(true)
      expect(VIDEO_MIME_TYPES.has('video/quicktime')).toBe(true)
      expect(VIDEO_MIME_TYPES.has('video/webm')).toBe(true)
      expect(VIDEO_MIME_TYPES.has('video/x-msvideo')).toBe(true)
    })
  })
})
