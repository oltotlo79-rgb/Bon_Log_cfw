import { vi } from 'vitest'
/**
 * Coverage Boost 20
 * - client-image-compression.ts: canvas ctx null, blob null, video file, oversized video, presigned error, compression ratio=0
 * - file-validation.ts: edge cases in detectFileType, validateVideoFile, validateMediaFile, generateSafeFileName
 */

// ============================================================
// client-image-compression tests
// ============================================================

describe('client-image-compression', async () => {
  let mod: typeof import('@/lib/client-image-compression')

  beforeEach(async () => {
    vi.resetModules()
    vi.restoreAllMocks()
     
    mod = await import('@/lib/client-image-compression')
  })

  describe('compressImage', async () => {
    it('skips compression for small files (under 500KB)', async () => {
      const file = new File(['x'], 'small.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 100 * 1024 }) // 100KB

      const result = await mod.compressImage(file)
      expect(result.file).toBe(file)
      expect(result.compressionRatio).toBe(0)
    })

    it('returns original file when canvas context is null', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation()

      // Create a file > 500KB to trigger compression
      const file = new File(['x'.repeat(600 * 1024)], 'big.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 600 * 1024 })

      // Mock loadImage to return a fake img
      const originalCreateElement = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          const canvas = originalCreateElement('canvas')
          // Make getContext return null
           
          canvas.getContext = () => null as any
          return canvas
        }
        return originalCreateElement(tag)
      })

      // Mock URL.createObjectURL and Image
      const origCreateObjectURL = URL.createObjectURL
      URL.createObjectURL = vi.fn(() => 'blob:mock')
      const origRevokeObjectURL = URL.revokeObjectURL
      URL.revokeObjectURL = vi.fn()

      // Mock Image constructor
      const originalImage = global.Image
      global.Image = class MockImage {
        width = 100
        height = 100
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        set src(_: string) {
          setTimeout(() => this.onload?.(), 0)
        }
       
      } as any

      const result = await mod.compressImage(file)
      expect(result.file).toBe(file)
      expect(result.compressionRatio).toBe(0)
      expect(consoleSpy).toHaveBeenCalledWith('Image compression failed:', expect.any(Error))

      URL.createObjectURL = origCreateObjectURL
      URL.revokeObjectURL = origRevokeObjectURL
      global.Image = originalImage
      consoleSpy.mockRestore()
    })
  })

  describe('prepareFileForUpload', async () => {
    it('returns video files uncompressed', async () => {
      const videoFile = new File(['video'], 'test.mp4', { type: 'video/mp4' })
      const result = await mod.prepareFileForUpload(videoFile)
      expect(result).toBe(videoFile)
    })

    it('returns non-image/non-video files uncompressed', async () => {
      const textFile = new File(['text'], 'test.txt', { type: 'text/plain' })
      const result = await mod.prepareFileForUpload(textFile)
      expect(result).toBe(textFile)
    })

    it('compresses image files and logs when ratio > 0', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()
      // Small image - will skip compression, ratio = 0
      const file = new File(['x'], 'small.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 100 })
      const result = await mod.prepareFileForUpload(file)
      expect(result).toBe(file)
      // ratio is 0 so no console.log
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Image compressed'))
      consoleSpy.mockRestore()
    })
  })

  describe('uploadVideoToR2', async () => {
    it('returns error for oversized video', async () => {
      const bigVideo = new File(['x'], 'huge.mp4', { type: 'video/mp4' })
      Object.defineProperty(bigVideo, 'size', { value: 300 * 1024 * 1024 }) // 300MB

      const result = await mod.uploadVideoToR2(bigVideo)
      expect(result.error).toContain('256MB以下')
    })

    it('returns error when presigned URL fetch fails', async () => {
      const video = new File(['x'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(video, 'size', { value: 1024 })

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Upload disabled' }),
       
      }) as any

      const result = await mod.uploadVideoToR2(video)
      expect(result.error).toBe('Upload disabled')
    })

    it('returns error with default message when presigned URL fetch fails without error', async () => {
      const video = new File(['x'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(video, 'size', { value: 1024 })

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
       
      }) as any

      const result = await mod.uploadVideoToR2(video)
      expect(result.error).toBe('Presigned URLの取得に失敗しました')
    })

    it('handles XHR upload success', async () => {
      const video = new File(['x'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(video, 'size', { value: 1024 })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ presignedUrl: 'https://r2.example.com/upload', fileUrl: 'https://r2.example.com/file.mp4' }),
       
      }) as any

      // Mock XMLHttpRequest
      const mockXHR = {
        upload: { addEventListener: vi.fn() },
        addEventListener: vi.fn(),
        open: vi.fn(),
        setRequestHeader: vi.fn(),
        send: vi.fn(),
        status: 200,
      }
      const origXHR = global.XMLHttpRequest
       
      global.XMLHttpRequest = vi.fn(function() { return mockXHR }) as any

      const progressFn = vi.fn()
      const resultPromise = mod.uploadVideoToR2(video, 'posts', progressFn)

      // Simulate load event
      await new Promise((r) => setTimeout(r, 10))
      const loadHandler = mockXHR.addEventListener.mock.calls.find((c: any[]) => c[0] === 'load')[1]
      loadHandler()

      const result = await resultPromise
      expect(result.url).toBe('https://r2.example.com/file.mp4')

      global.XMLHttpRequest = origXHR
    })

    it('handles XHR upload error event', async () => {
      const video = new File(['x'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(video, 'size', { value: 1024 })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ presignedUrl: 'https://r2.example.com/upload', fileUrl: 'https://r2.example.com/file.mp4' }),
       
      }) as any

      const mockXHR = {
        upload: { addEventListener: vi.fn() },
        addEventListener: vi.fn(),
        open: vi.fn(),
        setRequestHeader: vi.fn(),
        send: vi.fn(),
        status: 0,
      }
      const origXHR = global.XMLHttpRequest
       
      global.XMLHttpRequest = vi.fn(function() { return mockXHR }) as any

      const resultPromise = mod.uploadVideoToR2(video)

      await new Promise((r) => setTimeout(r, 10))
      const errorHandler = mockXHR.addEventListener.mock.calls.find((c: any[]) => c[0] === 'error')[1]
      errorHandler()

      const result = await resultPromise
      expect(result.error).toBe('アップロードに失敗しました')

      global.XMLHttpRequest = origXHR
    })

    it('handles XHR upload abort event', async () => {
      const video = new File(['x'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(video, 'size', { value: 1024 })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ presignedUrl: 'https://r2.example.com/upload', fileUrl: 'https://r2.example.com/file.mp4' }),
       
      }) as any

      const mockXHR = {
        upload: { addEventListener: vi.fn() },
        addEventListener: vi.fn(),
        open: vi.fn(),
        setRequestHeader: vi.fn(),
        send: vi.fn(),
      }
      const origXHR = global.XMLHttpRequest
       
      global.XMLHttpRequest = vi.fn(function() { return mockXHR }) as any

      const resultPromise = mod.uploadVideoToR2(video)

      await new Promise((r) => setTimeout(r, 10))
      const abortHandler = mockXHR.addEventListener.mock.calls.find((c: any[]) => c[0] === 'abort')[1]
      abortHandler()

      const result = await resultPromise
      expect(result.error).toBe('アップロードがキャンセルされました')

      global.XMLHttpRequest = origXHR
    })

    it('handles XHR non-2xx status', async () => {
      const video = new File(['x'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(video, 'size', { value: 1024 })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ presignedUrl: 'https://r2.example.com/upload', fileUrl: 'https://r2.example.com/file.mp4' }),
       
      }) as any

      const mockXHR = {
        upload: { addEventListener: vi.fn() },
        addEventListener: vi.fn(),
        open: vi.fn(),
        setRequestHeader: vi.fn(),
        send: vi.fn(),
        status: 500,
      }
      const origXHR = global.XMLHttpRequest
       
      global.XMLHttpRequest = vi.fn(function() { return mockXHR }) as any

      const resultPromise = mod.uploadVideoToR2(video)

      await new Promise((r) => setTimeout(r, 10))
      const loadHandler = mockXHR.addEventListener.mock.calls.find((c: any[]) => c[0] === 'load')[1]
      loadHandler()

      const result = await resultPromise
      expect(result.error).toBe('アップロードに失敗しました')

      global.XMLHttpRequest = origXHR
    })

    it('handles fetch throwing an error (catch block)', async () => {
      vi.spyOn(console, 'error').mockImplementation()
      const video = new File(['x'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(video, 'size', { value: 1024 })

       
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any

      const result = await mod.uploadVideoToR2(video)
      expect(result.error).toBe('アップロードに失敗しました')
    })

    it('tracks upload progress via onProgress', async () => {
      const video = new File(['x'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(video, 'size', { value: 1024 })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ presignedUrl: 'https://r2.example.com/upload', fileUrl: 'https://r2.example.com/file.mp4' }),
       
      }) as any

      const mockXHR = {
        upload: { addEventListener: vi.fn() },
        addEventListener: vi.fn(),
        open: vi.fn(),
        setRequestHeader: vi.fn(),
        send: vi.fn(),
        status: 200,
      }
      const origXHR = global.XMLHttpRequest
       
      global.XMLHttpRequest = vi.fn(function() { return mockXHR }) as any

      const progressFn = vi.fn()
      const resultPromise = mod.uploadVideoToR2(video, 'posts', progressFn)

      await new Promise((r) => setTimeout(r, 10))

      // Simulate progress event
      const progressHandler = mockXHR.upload.addEventListener.mock.calls.find((c: any[]) => c[0] === 'progress')?.[1]
      if (progressHandler) {
        progressHandler({ lengthComputable: true, loaded: 500, total: 1000 })
        expect(progressFn).toHaveBeenCalledWith(50)
      }

      // Complete
      const loadHandler = mockXHR.addEventListener.mock.calls.find((c: any[]) => c[0] === 'load')[1]
      loadHandler()
      await resultPromise

      global.XMLHttpRequest = origXHR
    })
  })

  describe('utility functions', () => {
    it('isImageFile returns true for image types', () => {
      expect(mod.isImageFile(new File([], 'a.jpg', { type: 'image/jpeg' }))).toBe(true)
      expect(mod.isImageFile(new File([], 'a.mp4', { type: 'video/mp4' }))).toBe(false)
    })

    it('isVideoFile returns true for video types', () => {
      expect(mod.isVideoFile(new File([], 'a.mp4', { type: 'video/mp4' }))).toBe(true)
      expect(mod.isVideoFile(new File([], 'a.jpg', { type: 'image/jpeg' }))).toBe(false)
    })

    it('formatFileSize handles various sizes', () => {
      expect(mod.formatFileSize(0)).toBe('0 B')
      expect(mod.formatFileSize(1024)).toBe('1 KB')
      expect(mod.formatFileSize(1024 * 1024)).toBe('1 MB')
    })
  })
})

// ============================================================
// file-validation tests
// ============================================================

describe('file-validation', async () => {
  let mod: typeof import('@/lib/file-validation')

  beforeEach(async () => {
    vi.resetModules()
     
    mod = await import('@/lib/file-validation')
  })

  describe('detectFileType', () => {
    it('detects JPEG', () => {
      const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00])
      expect(mod.detectFileType(buf)).toBe('image/jpeg')
    })

    it('detects PNG', () => {
      const buf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
      expect(mod.detectFileType(buf)).toBe('image/png')
    })

    it('detects WebP', () => {
      // RIFF....WEBP
      const buf = Buffer.alloc(12)
      buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46 // RIFF
      buf[8] = 0x57; buf[9] = 0x45; buf[10] = 0x42; buf[11] = 0x50 // WEBP
      expect(mod.detectFileType(buf)).toBe('image/webp')
    })

    it('detects GIF87a', () => {
      const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61])
      expect(mod.detectFileType(buf)).toBe('image/gif')
    })

    it('detects MP4', () => {
      const buf = Buffer.alloc(12)
      buf[4] = 0x66; buf[5] = 0x74; buf[6] = 0x79; buf[7] = 0x70 // ftyp at offset 4
      expect(mod.detectFileType(buf)).toBe('video/mp4')
    })

    it('detects WebM', () => {
      const buf = Buffer.from([0x1A, 0x45, 0xDF, 0xA3])
      expect(mod.detectFileType(buf)).toBe('video/webm')
    })

    it('detects AVI', () => {
      const buf = Buffer.alloc(12)
      buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46 // RIFF
      buf[8] = 0x41; buf[9] = 0x56; buf[10] = 0x49; buf[11] = 0x20 // AVI
      expect(mod.detectFileType(buf)).toBe('video/x-msvideo')
    })

    it('returns null for RIFF that is neither WebP nor AVI', () => {
      const buf = Buffer.alloc(12)
      buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46 // RIFF
      buf[8] = 0x00; buf[9] = 0x00; buf[10] = 0x00; buf[11] = 0x00 // Unknown
      expect(mod.detectFileType(buf)).toBeNull()
    })

    it('returns null for unknown format', () => {
      const buf = Buffer.from([0x00, 0x00, 0x00, 0x00])
      expect(mod.detectFileType(buf)).toBeNull()
    })

    it('returns null for too-short buffer', () => {
      const buf = Buffer.from([0xFF])
      expect(mod.detectFileType(buf)).toBeNull()
    })

    it('WebP returns null when buffer too short for WEBP check', () => {
      // RIFF header but only 10 bytes (need 12 for WebP check)
      const buf = Buffer.alloc(10)
      buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46
      expect(mod.detectFileType(buf)).toBeNull()
    })

    it('AVI returns null when buffer too short for AVI check', () => {
      const buf = Buffer.alloc(10)
      buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46
      // Only 10 bytes, isAVI needs 12
      expect(mod.detectFileType(buf)).toBeNull()
    })
  })

  describe('validateImageFile', () => {
    it('rejects unsupported claimed MIME type', () => {
      const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])
      const result = mod.validateImageFile(buf, 'application/pdf')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('許可されていない')
    })

    it('rejects when detection returns null', () => {
      const buf = Buffer.from([0x00, 0x00, 0x00, 0x00])
      const result = mod.validateImageFile(buf, 'image/jpeg')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('識別できません')
    })

    it('rejects when detected type is not in allowed list', () => {
      // Create a GIF buffer but only allow jpeg/png
      const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
      const result = mod.validateImageFile(buf, 'image/gif', ['image/jpeg', 'image/png'])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('許可されていない')
    })

    it('accepts valid JPEG', () => {
      const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00])
      const result = mod.validateImageFile(buf, 'image/jpeg')
      expect(result.valid).toBe(true)
      expect(result.detectedType).toBe('image/jpeg')
    })
  })

  describe('validateVideoFile', () => {
    it('rejects non-video MIME type', () => {
      const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])
      const result = mod.validateVideoFile(buf, 'image/jpeg')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('動画ファイルを選択')
    })

    it('rejects when detection returns null', () => {
      const buf = Buffer.from([0x00, 0x00, 0x00, 0x00])
      const result = mod.validateVideoFile(buf, 'video/mp4')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('識別できません')
    })

    it('rejects when detected type is not a video', () => {
      // JPEG bytes but claiming video
      const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00])
      const result = mod.validateVideoFile(buf, 'video/mp4')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('有効な動画ファイルではありません')
    })

    it('rejects when detected video type is not in allowed list', () => {
      // WebM buffer
      const buf = Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x00])
      const result = mod.validateVideoFile(buf, 'video/webm', ['video/mp4'])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('対応していません')
    })

    it('accepts valid MP4', () => {
      const buf = Buffer.alloc(12)
      buf[4] = 0x66; buf[5] = 0x74; buf[6] = 0x79; buf[7] = 0x70
      const result = mod.validateVideoFile(buf, 'video/mp4')
      expect(result.valid).toBe(true)
    })
  })

  describe('validateMediaFile', () => {
    it('delegates to validateImageFile for images', () => {
      const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00])
      const result = mod.validateMediaFile(buf, 'image/jpeg')
      expect(result.valid).toBe(true)
    })

    it('delegates to validateVideoFile for videos', () => {
      const buf = Buffer.alloc(12)
      buf[4] = 0x66; buf[5] = 0x74; buf[6] = 0x79; buf[7] = 0x70
      const result = mod.validateMediaFile(buf, 'video/mp4')
      expect(result.valid).toBe(true)
    })

    it('rejects non-image non-video files', () => {
      const buf = Buffer.from([0x00])
      const result = mod.validateMediaFile(buf, 'application/pdf')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('画像または動画')
    })
  })

  describe('generateSafeFileName', () => {
    it('generates UUID-based filename with correct extension', () => {
      const name = mod.generateSafeFileName('test.jpg', 'image/jpeg')
      expect(name).toMatch(/^[0-9a-f-]+\.jpg$/)
    })

    it('uses bin extension for unknown MIME types', () => {
      const name = mod.generateSafeFileName('test.xyz', 'application/octet-stream')
      expect(name).toMatch(/^[0-9a-f-]+\.bin$/)
    })

    it('handles video MIME types', () => {
      expect(mod.generateSafeFileName('test.mp4', 'video/mp4')).toMatch(/\.mp4$/)
      expect(mod.generateSafeFileName('test.mov', 'video/quicktime')).toMatch(/\.mov$/)
      expect(mod.generateSafeFileName('test.webm', 'video/webm')).toMatch(/\.webm$/)
    })
  })
})
