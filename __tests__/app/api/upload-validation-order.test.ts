/**
 * /api/upload と /api/upload/_shared/profile-image-upload の処理順序回帰テスト (P0)。
 *
 * 期待: auth 通過後、不正 file (未指定 / 形式違い / サイズ超過) が来たら
 * `checkUserRateLimit` / `checkDailyLimit` は 1 度も呼ばれない。
 * valid file の場合のみ rate-limit と daily-limit が消費される。
 */
// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuth = vi.fn()
const mockCheckUserRateLimit = vi.fn().mockResolvedValue({ success: true })
const mockCheckDailyLimit = vi.fn().mockResolvedValue({ allowed: true, count: 0, limit: 50 })
const mockUploadFile = vi.fn().mockResolvedValue({ success: true, url: 'https://r2.example/x.png' })
const mockUserFindUnique = vi.fn().mockResolvedValue({ avatarUrl: null, headerUrl: null })
const mockUserUpdate = vi.fn().mockResolvedValue({})
const mockDeleteFile = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  checkDailyLimit: (...args: unknown[]) => mockCheckDailyLimit(...args),
}))
vi.mock('@/lib/storage', () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
  deleteFile: (...args: unknown[]) => mockDeleteFile(...args),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// 実 JPEG マジックバイト (FF D8 FF E0 + JFIF)
const VALID_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])

function makeRequest(formData?: FormData) {
  const fd = formData ?? new FormData()
  return new Request('http://localhost/api/upload', { method: 'POST', body: fd })
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
    mockCheckDailyLimit.mockResolvedValue({ allowed: true, count: 0, limit: 50 })
  })

  it('file 未指定で rate-limit / daily-limit が呼ばれない', async () => {
    const { POST } = await import('@/app/api/upload/route')
    const res = await POST(makeRequest() as never)
    expect(res.status).toBe(400)
    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
    expect(mockCheckDailyLimit).not.toHaveBeenCalled()
  })

  it('不正 MIME (text/plain) で rate-limit / daily-limit が呼ばれない', async () => {
    const fd = new FormData()
    fd.append('file', new File(['hello'], 'a.txt', { type: 'text/plain' }))
    const { POST } = await import('@/app/api/upload/route')
    const res = await POST(makeRequest(fd) as never)
    expect(res.status).toBe(400)
    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
    expect(mockCheckDailyLimit).not.toHaveBeenCalled()
  })

  it('valid JPEG で auth → file 検証 → rate-limit → daily-limit の順で呼ばれる', async () => {
    const order: string[] = []
    mockCheckUserRateLimit.mockImplementation(() => {
      order.push('rate-limit')
      return Promise.resolve({ success: true })
    })
    mockCheckDailyLimit.mockImplementation(() => {
      order.push('daily-limit')
      return Promise.resolve({ allowed: true, count: 0, limit: 50 })
    })
    mockUploadFile.mockImplementation(() => {
      order.push('upload')
      return Promise.resolve({ success: true, url: 'https://example/x.png' })
    })

    const fd = new FormData()
    fd.append('file', new File([VALID_JPEG], 'a.jpg', { type: 'image/jpeg' }))
    const { POST } = await import('@/app/api/upload/route')
    const res = await POST(makeRequest(fd) as never)
    expect(res.status).toBe(200)
    expect(order).toEqual(['rate-limit', 'daily-limit', 'upload'])
  })

  it('rate-limit 超過時は upload が呼ばれない', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })

    const fd = new FormData()
    fd.append('file', new File([VALID_JPEG], 'a.jpg', { type: 'image/jpeg' }))
    const { POST } = await import('@/app/api/upload/route')
    const res = await POST(makeRequest(fd) as never)
    expect(res.status).toBe(429)
    expect(mockUploadFile).not.toHaveBeenCalled()
  })

  it('daily limit は failOpen:false で呼ばれる (R2 課金保護)', async () => {
    const fd = new FormData()
    fd.append('file', new File([VALID_JPEG], 'a.jpg', { type: 'image/jpeg' }))
    const { POST } = await import('@/app/api/upload/route')
    await POST(makeRequest(fd) as never)
    expect(mockCheckDailyLimit).toHaveBeenCalledWith('user-1', 'upload', { failOpen: false })
  })
})

describe('handleProfileImageUpload (avatar)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
    mockCheckDailyLimit.mockResolvedValue({ allowed: true, count: 0, limit: 50 })
    mockUserFindUnique.mockResolvedValue({ avatarUrl: null, headerUrl: null })
  })

  it('file 未指定で rate-limit / daily-limit が呼ばれない', async () => {
    const { handleProfileImageUpload } = await import(
      '@/app/api/upload/_shared/profile-image-upload'
    )
    const req = new Request('http://localhost/api/upload/avatar', {
      method: 'POST',
      body: new FormData(),
    })
    const res = await handleProfileImageUpload(req as never, 'avatar')
    expect(res.status).toBe(400)
    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
    expect(mockCheckDailyLimit).not.toHaveBeenCalled()
  })

  it('画像でない MIME で rate-limit が呼ばれない', async () => {
    const fd = new FormData()
    fd.append('file', new File(['x'], 'x.txt', { type: 'text/plain' }))
    const req = new Request('http://localhost/api/upload/avatar', {
      method: 'POST',
      body: fd,
    })
    const { handleProfileImageUpload } = await import(
      '@/app/api/upload/_shared/profile-image-upload'
    )
    const res = await handleProfileImageUpload(req as never, 'avatar')
    expect(res.status).toBe(400)
    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
    expect(mockCheckDailyLimit).not.toHaveBeenCalled()
  })

  it('valid JPEG で rate-limit / daily-limit が呼ばれて upload に進む', async () => {
    const fd = new FormData()
    fd.append('file', new File([VALID_JPEG], 'a.jpg', { type: 'image/jpeg' }))
    const req = new Request('http://localhost/api/upload/avatar', {
      method: 'POST',
      body: fd,
    })
    const { handleProfileImageUpload } = await import(
      '@/app/api/upload/_shared/profile-image-upload'
    )
    const res = await handleProfileImageUpload(req as never, 'avatar')
    expect(res.status).toBe(200)
    expect(mockCheckUserRateLimit).toHaveBeenCalledWith('user-1', 'upload')
    expect(mockCheckDailyLimit).toHaveBeenCalledWith('user-1', 'upload', { failOpen: false })
    expect(mockUploadFile).toHaveBeenCalled()
  })
})
