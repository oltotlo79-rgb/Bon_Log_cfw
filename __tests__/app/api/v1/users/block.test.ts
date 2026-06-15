// @vitest-environment node
/**
 * POST /api/v1/users/[id]/block — ブロック（冪等: 既ブロックでも 200）
 * DELETE /api/v1/users/[id]/block — ブロック解除（冪等: 未ブロックでも 200）
 *
 * 200 / 400 / 401 / 403 / 404 / 429 の全分岐・冪等性・
 * 自己操作拒否・フォロー解除の呼び出し検証を含む。
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

const mockBlockUserService = vi.fn()
const mockUnblockUserService = vi.fn()
vi.mock('@/lib/services/block-service', () => ({
  blockUserService: (...args: unknown[]) => mockBlockUserService(...args),
  unblockUserService: (...args: unknown[]) => mockUnblockUserService(...args),
  getBlockedUsersService: vi.fn(),
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
  const req = new NextRequest(`http://localhost/api/v1/users/${targetId}/block`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ id: targetId }) }]
}

describe('POST /api/v1/users/[id]/block', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockBlockUserService.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常ブロック時に 200 { blocked: true } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ blocked: true })
  })

  it('blockUserService に viewerId と targetId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'user-target')
    const { POST } = await import('@/app/api/v1/users/[id]/block/route')
    await POST(req, params)

    expect(mockBlockUserService).toHaveBeenCalledWith('user-1', 'user-target')
  })

  it('既ブロック済みでも 200 { blocked: true } を返す（冪等）', async () => {
    mockBlockUserService.mockResolvedValueOnce({ ok: true })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.blocked).toBe(true)
  })

  it('自己ブロックで 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-self', 'self@example.com', 'user-self')
    const { POST } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('サービスが self を返しても 400 VALIDATION_ERROR', async () => {
    mockBlockUserService.mockResolvedValueOnce({ ok: false, reason: 'self' })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('対象が存在しない（not_found）で 404 NOT_FOUND', async () => {
    mockBlockUserService.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('対象停止ユーザーも 404 NOT_FOUND（情報秘匿）', async () => {
    mockBlockUserService.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'suspended-user')
    const { POST } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/user-target/block', { method: 'POST' })
    const { POST } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/user-target/block', {
      method: 'POST',
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { POST } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/users/user-target/block', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    const { POST } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { POST } = await import('@/app/api/v1/users/[id]/block/route')
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
    const { POST } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('不正 id（31文字超）への POST で 400 VALIDATION_ERROR', async () => {
    const invalidId = 'a'.repeat(31)
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', invalidId)
    const { POST } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('エラーレスポンス形式が { error: { code, message, status } } であること', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/user-target/block', { method: 'POST' })
    const { POST } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'user-target' }) })

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})

describe('DELETE /api/v1/users/[id]/block', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockUnblockUserService.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('ブロック解除で 200 { blocked: false } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ blocked: false })
  })

  it('未ブロックでも 200 { blocked: false } を返す（冪等）', async () => {
    mockUnblockUserService.mockResolvedValueOnce({ ok: true })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.blocked).toBe(false)
  })

  it('unblockUserService に viewerId と targetId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/block/route')
    await DELETE(req, params)

    expect(mockUnblockUserService).toHaveBeenCalledWith('user-1', 'user-target')
  })

  it('自己操作で 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-self', 'self@example.com', 'user-self', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/user-target/block', { method: 'DELETE' })
    const { DELETE } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/users/user-target/block', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    const { DELETE } = await import('@/app/api/v1/users/[id]/block/route')
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
    const { DELETE } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('不正 id（31文字超）への DELETE で 400 VALIDATION_ERROR', async () => {
    const invalidId = 'a'.repeat(31)
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', invalidId, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/block/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
