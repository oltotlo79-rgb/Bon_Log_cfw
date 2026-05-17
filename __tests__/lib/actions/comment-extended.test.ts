import { vi } from 'vitest'
/**
 * Extended comment action tests - uploadCommentMedia, comment edge cases
 */
 
export {}

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, Record<string, unknown>> = {
  comment: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  post: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  block: { findFirst: vi.fn() },
  mute: { findFirst: vi.fn() },
  commentLike: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
  notification: { create: vi.fn() },
  commentThreadMute: { findUnique: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/logger', () => ({ default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }, logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/storage', () => ({ uploadFile: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))
vi.mock('@/lib/actions/notification', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/services/notification-core', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/file-validation', () => ({
  validateImageFile: vi.fn().mockReturnValue({ valid: true, detectedType: 'image/jpeg' }),
  generateSafeFileName: vi.fn((name: string) => name),
}))
vi.mock('@/lib/services/usage', () => ({ checkCommentLimit: vi.fn().mockResolvedValue({ allowed: true }) }))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
})

describe('uploadCommentMedia', async () => {
  it('rejects unauthenticated user', async () => {
    mockAuth.mockResolvedValue(null)
    const { uploadCommentMedia } = await import('@/lib/actions/comment')
    const formData = new FormData()
    const result = await uploadCommentMedia(formData)
    expect(result.error).toBeDefined()
  })

  it('rejects when no file provided', async () => {
    const { uploadCommentMedia } = await import('@/lib/actions/comment')
    const formData = new FormData()
    const result = await uploadCommentMedia(formData)
    expect(result.error).toBeDefined()
  })

  it('rejects image larger than 4MB', async () => {
    const { uploadCommentMedia } = await import('@/lib/actions/comment')
    const largeFile = new File([new ArrayBuffer(5 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })
    const formData = new FormData()
    formData.append('file', largeFile)
    const result = await uploadCommentMedia(formData)
    expect(result.error).toContain('4MB')
  })

  it('rejects video larger than 256MB', async () => {
    const { uploadCommentMedia } = await import('@/lib/actions/comment')
    // Create a file object with a large size
    const file = new File(['x'], 'video.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 257 * 1024 * 1024 })
    const formData = new FormData()
    formData.append('file', file)
    const result = await uploadCommentMedia(formData)
    expect(result.error).toContain('256MB')
  })

  it('uploads image successfully', async () => {
    const { uploadCommentMedia } = await import('@/lib/actions/comment')
    const storage = await import('@/lib/storage')
    ;(storage.uploadFile as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, url: '/img.jpg' })

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(4))
    const formData = new FormData()
    formData.append('file', file)
    const result = await uploadCommentMedia(formData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data?.url).toBe('/img.jpg')
      expect(result.data?.type).toBe('image')
    }
  })

  it('uploads video successfully', async () => {
    const { uploadCommentMedia } = await import('@/lib/actions/comment')
    const storage = await import('@/lib/storage')
    ;(storage.uploadFile as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, url: '/vid.mp4' })

    const file = new File(['data'], 'clip.mp4', { type: 'video/mp4' })
    file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(4))
    const formData = new FormData()
    formData.append('file', file)
    const result = await uploadCommentMedia(formData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data?.type).toBe('video')
    }
  })

  it('handles upload failure and returns generic message (no internal error leak)', async () => {
    const { uploadCommentMedia } = await import('@/lib/actions/comment')
    const storage = await import('@/lib/storage')
    ;(storage.uploadFile as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'Storage error' })

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(4))
    const formData = new FormData()
    formData.append('file', file)
    const result = await uploadCommentMedia(formData)
    expect(result.error).toBeDefined()
    expect(result.error).toBe('メディアのアップロードに失敗しました')
  })

  it('handles upload exception', async () => {
    const { uploadCommentMedia } = await import('@/lib/actions/comment')
    const storage = await import('@/lib/storage')
    ;(storage.uploadFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('crash'))

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(4))
    const formData = new FormData()
    formData.append('file', file)
    const result = await uploadCommentMedia(formData)
    expect(result.error).toBeDefined()
  })

  it('handles upload returning no url', async () => {
    const { uploadCommentMedia } = await import('@/lib/actions/comment')
    const storage = await import('@/lib/storage')
    ;(storage.uploadFile as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, url: null })

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(4))
    const formData = new FormData()
    formData.append('file', file)
    const result = await uploadCommentMedia(formData)
    expect(result.error).toBeDefined()
  })
})
