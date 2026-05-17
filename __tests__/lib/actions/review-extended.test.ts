import { vi } from 'vitest'
/**
 * Extended review tests - uploadReviewImage uncovered branches
 */
 export {};

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockUploadFile = vi.fn()
vi.mock('@/lib/storage', () => ({ uploadFile: (...args: unknown[]) => mockUploadFile(...args) }))

vi.mock('@/lib/file-validation', () => ({
  validateImageFile: vi.fn().mockReturnValue({ valid: true, detectedType: 'image/jpeg' }),
  generateSafeFileName: vi.fn((name: string) => name),
}))

const mockPrisma: Record<string, Record<string, unknown>> = {
  shopReview: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
  bonsaiShop: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { limit: 20, window: 60 } },
}))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue('127.0.0.1') }) }))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
})

describe('uploadReviewImage', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { uploadReviewImage } = await import('@/lib/actions/review')
    const fd = new FormData()
    const result = await uploadReviewImage(fd)
    expect(result.error).toContain('認証')
  })

  it('rejects no file', async () => {
    const { uploadReviewImage } = await import('@/lib/actions/review')
    const fd = new FormData()
    const result = await uploadReviewImage(fd)
    expect(result.error).toBeDefined()
  })

  it('rejects large file', async () => {
    const { uploadReviewImage } = await import('@/lib/actions/review')
    const file = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 })
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadReviewImage(fd)
    expect(result.error).toBeDefined()
  })

  it('rejects invalid MIME', async () => {
    const { uploadReviewImage } = await import('@/lib/actions/review')
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadReviewImage(fd)
    expect(result.error).toBeDefined()
  })

  it('uploads successfully', async () => {
    mockUploadFile.mockResolvedValue({ success: true, url: '/review.jpg' })
    const { uploadReviewImage } = await import('@/lib/actions/review')
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(4))
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadReviewImage(fd)
    expect(result.success).toBe(true)
    expect(result.data?.url).toBe('/review.jpg')
  })

  it('handles upload failure and returns generic message (no internal error leak)', async () => {
    mockUploadFile.mockResolvedValue({ success: false, error: 'Storage error' })
    const { uploadReviewImage } = await import('@/lib/actions/review')
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(4))
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadReviewImage(fd)
    expect(result.error).toBeDefined()
    expect(result.error).toBe('アップロードに失敗しました')
  })

  it('handles upload returning null url', async () => {
    mockUploadFile.mockResolvedValue({ success: true, url: null })
    const { uploadReviewImage } = await import('@/lib/actions/review')
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(4))
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadReviewImage(fd)
    expect(result.error).toBeDefined()
  })

  it('handles exception during upload gracefully', async () => {
    mockUploadFile.mockRejectedValueOnce(new Error('crash'))
    const { uploadReviewImage } = await import('@/lib/actions/review')
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(4))
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadReviewImage(fd)
    expect(result.error).toBe('アップロードに失敗しました')
  })
})
