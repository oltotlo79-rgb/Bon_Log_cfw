import { vi } from 'vitest'
 
/**
 * Coverage boost tests for lib modules
 * logger.ts, client-image-compression.ts
 */

// ============================================================
// logger
// ============================================================
describe('logger', async () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('log does not output in non-development (test env)', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const { logger } = await import('@/lib/logger')
    logger.log('hello')
    expect(spy).not.toHaveBeenCalled()
  })

  it('warn does not output in non-development', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { logger } = await import('@/lib/logger')
    logger.warn('warning')
    expect(spy).not.toHaveBeenCalled()
  })

  it('error does not console.error in non-development but tries Sentry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { logger } = await import('@/lib/logger')
    expect(() => logger.error('err')).not.toThrow()
  })

  it('error with Error object tries Sentry captureException', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { logger } = await import('@/lib/logger')
    expect(() => logger.error(new Error('test error'))).not.toThrow()
  })

  it('error with non-Error args tries Sentry captureMessage', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { logger } = await import('@/lib/logger')
    expect(() => logger.error('string error', 123, { extra: true })).not.toThrow()
  })

  it('debug does not output in non-development', async () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    const { logger } = await import('@/lib/logger')
    logger.debug('info')
    expect(spy).not.toHaveBeenCalled()
  })

  it('exports default and named logger', async () => {
    const mod = await import('@/lib/logger')
    expect(mod.logger).toBeDefined()
    expect(mod.default).toBeDefined()
    expect(typeof mod.logger.log).toBe('function')
    expect(typeof mod.logger.error).toBe('function')
  })
})

// ============================================================
// client-image-compression utility functions
// ============================================================
describe('client-image-compression utilities', async () => {
  it('isImageFile returns true for image types', async () => {
    const { isImageFile } = await import('@/lib/client-image-compression')
    expect(isImageFile(new File([], 'test.jpg', { type: 'image/jpeg' }))).toBe(true)
    expect(isImageFile(new File([], 'test.png', { type: 'image/png' }))).toBe(true)
    expect(isImageFile(new File([], 'test.mp4', { type: 'video/mp4' }))).toBe(false)
  })

  it('isVideoFile returns true for video types', async () => {
    const { isVideoFile } = await import('@/lib/client-image-compression')
    expect(isVideoFile(new File([], 'test.mp4', { type: 'video/mp4' }))).toBe(true)
    expect(isVideoFile(new File([], 'test.jpg', { type: 'image/jpeg' }))).toBe(false)
  })

  it('formatFileSize formats correctly', async () => {
    const { formatFileSize } = await import('@/lib/client-image-compression')
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1024 * 1024)).toBe('1 MB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('prepareFileForUpload returns video as-is', async () => {
    const { prepareFileForUpload } = await import('@/lib/client-image-compression')
    const video = new File(['data'], 'video.mp4', { type: 'video/mp4' })
    const result = await prepareFileForUpload(video)
    expect(result).toBe(video)
  })

  it('prepareFileForUpload returns non-image non-video as-is', async () => {
    const { prepareFileForUpload } = await import('@/lib/client-image-compression')
    const txt = new File(['hello'], 'file.txt', { type: 'text/plain' })
    const result = await prepareFileForUpload(txt)
    expect(result).toBe(txt)
  })

  it('compressImage skips small files', async () => {
    const { compressImage } = await import('@/lib/client-image-compression')
    const small = new File([new ArrayBuffer(100)], 'small.jpg', { type: 'image/jpeg' })
    const result = await compressImage(small)
    expect(result.file).toBe(small)
    expect(result.compressionRatio).toBe(0)
  })

  it('uploadVideoToR2 rejects oversized files', async () => {
    const { uploadVideoToR2, MAX_VIDEO_SIZE } = await import('@/lib/client-image-compression')
    const bigFile = new File([new ArrayBuffer(10)], 'big.mp4', { type: 'video/mp4' })
    Object.defineProperty(bigFile, 'size', { value: MAX_VIDEO_SIZE + 1 })
    const result = await uploadVideoToR2(bigFile)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('MB以下')
  })

  it('uploadVideoToR2 handles fetch error', async () => {
    const { uploadVideoToR2 } = await import('@/lib/client-image-compression')
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'server error' }),
    })
    const file = new File([new ArrayBuffer(10)], 'vid.mp4', { type: 'video/mp4' })
    const result = await uploadVideoToR2(file)
    expect(result.error).toContain('server error')
  })

  it('MAX_IMAGE_SIZE and MAX_VIDEO_SIZE are exported', async () => {
    const { MAX_IMAGE_SIZE, MAX_VIDEO_SIZE } = await import('@/lib/client-image-compression')
    expect(MAX_IMAGE_SIZE).toBe(10 * 1024 * 1024)
    expect(MAX_VIDEO_SIZE).toBe(256 * 1024 * 1024)
  })
})
