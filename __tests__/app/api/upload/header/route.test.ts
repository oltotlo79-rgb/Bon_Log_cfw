// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockUploadFile = vi.fn()
const mockDeleteFile = vi.fn()
vi.mock('@/lib/storage', () => ({ uploadFile: mockUploadFile, deleteFile: mockDeleteFile }))

const mockPrisma = {
  user: { findUnique: vi.fn(), update: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn), cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn) }))
vi.mock('@/lib/file-validation', () => ({
  validateImageFile: vi.fn().mockReturnValue({ valid: true, detectedType: 'image/jpeg' }),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 }),
  checkDailyLimit: vi.fn().mockResolvedValue({ allowed: true, count: 1, limit: 50 }),
}))
vi.mock('@/lib/constants/storage', () => ({
  STORAGE_FOLDER_AVATARS: 'avatars',
  STORAGE_FOLDER_HEADERS: 'headers',
}))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

function createHeaderReq(type = 'image/jpeg', size = 1000, name = 'header.jpg') {
  const file = new File([Buffer.alloc(size)], name, { type })
  const fd = new FormData()
  fd.append('file', file)
  return new Request('http://localhost/api/upload/header', { method: 'POST', body: fd })
}

describe('Upload Header API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.user.findUnique.mockResolvedValue({ avatarUrl: null, headerUrl: null })
    mockPrisma.user.update.mockResolvedValue({})
  })

  it('delegates to handleProfileImageUpload with "header" type (returns upload result)', async () => {
    mockUploadFile.mockResolvedValue({ success: true, url: 'https://example.com/header.jpg' })
    const { POST } = await import('@/app/api/upload/header/route')
    const res = await POST(createHeaderReq() as unknown as NextRequest)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.url).toBe('https://example.com/header.jpg')
  })

  it('returns error from the shared handler', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/upload/header/route')
    const res = await POST(createHeaderReq() as unknown as NextRequest)
    expect(res.status).toBe(401)
  })

  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/upload/header/route')
    const res = await POST(createHeaderReq() as unknown as NextRequest)
    expect(res.status).toBe(401)
  })

  it('returns 400 if no file', async () => {
    const fd = new FormData()
    const req = new Request('http://localhost/api/upload/header', { method: 'POST', body: fd })
    const { POST } = await import('@/app/api/upload/header/route')
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(400)
  })

  it('returns 400 for oversized file', async () => {
    const { POST } = await import('@/app/api/upload/header/route')
    const res = await POST(createHeaderReq('image/jpeg', 5 * 1024 * 1024) as unknown as NextRequest)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid type', async () => {
    const { POST } = await import('@/app/api/upload/header/route')
    const res = await POST(createHeaderReq('image/gif', 1000, 'h.gif') as unknown as NextRequest)
    expect(res.status).toBe(400)
  })

  it('returns 500 if upload fails', async () => {
    mockUploadFile.mockResolvedValue({ success: false, error: 'fail' })
    const { POST } = await import('@/app/api/upload/header/route')
    const res = await POST(createHeaderReq() as unknown as NextRequest)
    expect(res.status).toBe(500)
  })

  it('uploads successfully', async () => {
    mockUploadFile.mockResolvedValue({ success: true, url: 'https://cdn/header.jpg' })
    const { POST } = await import('@/app/api/upload/header/route')
    const res = await POST(createHeaderReq() as unknown as NextRequest)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.url).toBe('https://cdn/header.jpg')
  })

  it('deletes old header on success', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ avatarUrl: null, headerUrl: 'https://cdn/old.jpg' })
    mockUploadFile.mockResolvedValue({ success: true, url: 'https://cdn/new.jpg' })
    mockDeleteFile.mockResolvedValue(undefined)
    const { POST } = await import('@/app/api/upload/header/route')
    await POST(createHeaderReq() as unknown as NextRequest)
    expect(mockDeleteFile).toHaveBeenCalledWith('https://cdn/old.jpg')
  })

  it('does not delete placeholder header', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ avatarUrl: null, headerUrl: '/placeholder.png' })
    mockUploadFile.mockResolvedValue({ success: true, url: 'https://cdn/new.jpg' })
    const { POST } = await import('@/app/api/upload/header/route')
    await POST(createHeaderReq() as unknown as NextRequest)
    expect(mockDeleteFile).not.toHaveBeenCalled()
  })

  it('succeeds even if old file deletion fails', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ avatarUrl: null, headerUrl: 'https://cdn/old.jpg' })
    mockUploadFile.mockResolvedValue({ success: true, url: 'https://cdn/new.jpg' })
    mockDeleteFile.mockRejectedValue(new Error('delete failed'))
    const { POST } = await import('@/app/api/upload/header/route')
    const res = await POST(createHeaderReq() as unknown as NextRequest)
    expect(res.status).toBe(200)
  })

  it('returns 429 with daily upload limit message on daily limit exceeded', async () => {
    const { checkDailyLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkDailyLimit).mockResolvedValueOnce({ allowed: false, count: 50, limit: 50 })
    const { POST } = await import('@/app/api/upload/header/route')
    const res = await POST(createHeaderReq() as unknown as NextRequest)
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toContain('1日のアップロード上限')
    expect(data.error).toContain('50')
  })

  it('returns 429 on rate limit', async () => {
    const { checkUserRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkUserRateLimit).mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() })
    const { POST } = await import('@/app/api/upload/header/route')
    const res = await POST(createHeaderReq() as unknown as NextRequest)
    expect(res.status).toBe(429)
  })

  it('returns 500 with ERR_UPLOAD_SERVER_ERROR on unexpected exception', async () => {
    mockPrisma.user.findUnique.mockRejectedValueOnce(new Error('DB error'))
    mockUploadFile.mockResolvedValue({ success: true, url: 'https://cdn/h.jpg' })
    const { POST } = await import('@/app/api/upload/header/route')
    const res = await POST(createHeaderReq() as unknown as NextRequest)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('アップロード中にエラーが発生しました')
  })

  it('on success calls revalidatePath for /users/:id and /settings/profile', async () => {
    mockUploadFile.mockResolvedValue({ success: true, url: 'https://cdn/header.jpg' })
    const { revalidatePath } = await import('next/cache')
    const { POST } = await import('@/app/api/upload/header/route')
    await POST(createHeaderReq() as unknown as NextRequest)
    expect(revalidatePath).toHaveBeenCalledWith('/users/u1')
    expect(revalidatePath).toHaveBeenCalledWith('/settings/profile')
  })
})
