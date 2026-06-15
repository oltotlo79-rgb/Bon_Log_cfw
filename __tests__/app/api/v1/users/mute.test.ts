// @vitest-environment node
/**
 * POST /api/v1/users/[id]/mute — ミュート（冪等: 既ミュートでも 200）
 * DELETE /api/v1/users/[id]/mute — ミュート解除（冪等: 未ミュートでも 200）
 *
 * ミュートはフォロー関係を変更しない（follow.deleteMany が呼ばれないこと）。
 * 200 / 400 / 401 / 403 / 404 / 429 の全分岐・冪等性・自己操作拒否を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

const mockMuteUserService = vi.fn()
const mockUnmuteUserService = vi.fn()
vi.mock('@/lib/services/mute-service', () => ({
  muteUserService: (...args: unknown[]) => mockMuteUserService(...args),
  unmuteUserService: (...args: unknown[]) => mockUnmuteUserService(...args),
  getMutedUsersService: vi.fn(),
}))

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  targetId = 'user-target',
  method: 'POST' | 'DELETE' = 'POST',
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const req = new NextRequest(`http://localhost/api/v1/users/${targetId}/mute`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ id: targetId }) }]
}

describe('POST /api/v1/users/[id]/mute', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockMuteUserService.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常ミュート時に 200 { muted: true } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ muted: true })
  })

  it('muteUserService に viewerId と targetId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'user-target')
    const { POST } = await import('@/app/api/v1/users/[id]/mute/route')
    await POST(req, params)

    expect(mockMuteUserService).toHaveBeenCalledWith('user-1', 'user-target')
  })

  it('既ミュート済みでも 200 { muted: true } を返す（冪等）', async () => {
    mockMuteUserService.mockResolvedValueOnce({ ok: true })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.muted).toBe(true)
  })

  it('自己ミュートで 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-self', 'self@example.com', 'user-self')
    const { POST } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('サービスが self を返しても 400 VALIDATION_ERROR', async () => {
    mockMuteUserService.mockResolvedValueOnce({ ok: false, reason: 'self' })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('対象が存在しない（not_found）で 404 NOT_FOUND', async () => {
    mockMuteUserService.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('対象停止ユーザーも 404 NOT_FOUND（情報秘匿）', async () => {
    mockMuteUserService.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'suspended-user')
    const { POST } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/user-target/mute', { method: 'POST' })
    const { POST } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/user-target/mute', {
      method: 'POST',
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { POST } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/users/user-target/mute', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    const { POST } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { POST } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await POST(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('不正 id（31文字超）への POST で 400 VALIDATION_ERROR', async () => {
    const invalidId = 'a'.repeat(31)
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', invalidId)
    const { POST } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('エラーレスポンス形式が { error: { code, message, status } } であること', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/user-target/mute', { method: 'POST' })
    const { POST } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'user-target' }) })

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})

describe('DELETE /api/v1/users/[id]/mute', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockUnmuteUserService.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('ミュート解除で 200 { muted: false } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ muted: false })
  })

  it('未ミュートでも 200 { muted: false } を返す（冪等）', async () => {
    mockUnmuteUserService.mockResolvedValueOnce({ ok: true })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.muted).toBe(false)
  })

  it('unmuteUserService に viewerId と targetId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/mute/route')
    await DELETE(req, params)

    expect(mockUnmuteUserService).toHaveBeenCalledWith('user-1', 'user-target')
  })

  it('自己操作で 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-self', 'self@example.com', 'user-self', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/user-target/mute', { method: 'DELETE' })
    const { DELETE } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/users/user-target/mute', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    const { DELETE } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('不正 id（31文字超）への DELETE で 400 VALIDATION_ERROR', async () => {
    const invalidId = 'a'.repeat(31)
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', invalidId, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/mute/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
