// @vitest-environment node
/**
 * GET  /api/v1/users/me/follow-requests
 * POST /api/v1/users/me/follow-requests/{id}/approve
 * POST /api/v1/users/me/follow-requests/{id}/reject
 *
 * Bearer 認証・ゲスト拒否・カーソルページネーション・承認/拒否の分岐・
 * 冪等性・所有権違反・レート制限を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

// ──────────────────────────────────────────────────
// モック: DB (requireBearerUser が user.findUnique を使う)
// ──────────────────────────────────────────────────
const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

// ──────────────────────────────────────────────────
// モック: rate-limit
// ──────────────────────────────────────────────────
const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

// ──────────────────────────────────────────────────
// モック: follow-service
// ──────────────────────────────────────────────────
const mockListReceivedFollowRequests = vi.fn()
const mockApproveFollowRequestCore = vi.fn()
const mockRejectFollowRequestCore = vi.fn()
vi.mock('@/lib/services/follow-service', () => ({
  listReceivedFollowRequests: (...args: unknown[]) => mockListReceivedFollowRequests(...args),
  approveFollowRequestCore: (...args: unknown[]) => mockApproveFollowRequestCore(...args),
  rejectFollowRequestCore: (...args: unknown[]) => mockRejectFollowRequestCore(...args),
}))

// ──────────────────────────────────────────────────
// モック: revalidatePath
// ──────────────────────────────────────────────────
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

// ──────────────────────────────────────────────────
// ヘルパー
// ──────────────────────────────────────────────────

async function makeAuthToken(userId: string, email: string): Promise<string> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  if (!token) throw new Error('Failed to sign access token')
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return token
}

function makeGetRequest(token: string, params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/v1/users/me/follow-requests')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  return new NextRequest(url.toString(), {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

function makePostRequest(token: string, url: string): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
}

const SAMPLE_REQUESTS = [
  {
    id: 'req-001',
    createdAt: new Date('2024-01-01'),
    requester: { id: 'user-a', nickname: 'ユーザーA', avatarUrl: null, bio: null },
  },
]

// ──────────────────────────────────────────────────
// GET /api/v1/users/me/follow-requests
// ──────────────────────────────────────────────────

describe('GET /api/v1/users/me/follow-requests', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60_000 })
    mockListReceivedFollowRequests.mockResolvedValue({
      requests: SAMPLE_REQUESTS,
      nextCursor: undefined,
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常: pending 一覧 200 + requests 配列', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makeGetRequest(token)
    const { GET } = await import('@/app/api/v1/users/me/follow-requests/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.requests)).toBe(true)
    expect(body.requests[0].id).toBe('req-001')
  })

  it('nextCursor が null（最後のページ）', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makeGetRequest(token)
    const { GET } = await import('@/app/api/v1/users/me/follow-requests/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.nextCursor).toBeNull()
  })

  it('nextCursor が文字列で返される（カーソルページネーション）', async () => {
    mockListReceivedFollowRequests.mockResolvedValueOnce({
      requests: SAMPLE_REQUESTS,
      nextCursor: 'cursor-abc',
    })
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makeGetRequest(token)
    const { GET } = await import('@/app/api/v1/users/me/follow-requests/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.nextCursor).toBe('cursor-abc')
  })

  it('createdAt が ISO 文字列で返される', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makeGetRequest(token)
    const { GET } = await import('@/app/api/v1/users/me/follow-requests/route')
    const res = await GET(req)

    const body = await res.json()
    expect(typeof body.requests[0].createdAt).toBe('string')
    expect(() => new Date(body.requests[0].createdAt)).not.toThrow()
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const token = await makeAuthToken('guest-id', GUEST_EMAIL)
    const req = makeGetRequest(token)
    const { GET } = await import('@/app/api/v1/users/me/follow-requests/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me/follow-requests', { method: 'GET' })
    const { GET } = await import('@/app/api/v1/users/me/follow-requests/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30_000,
    })
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makeGetRequest(token)
    const { GET } = await import('@/app/api/v1/users/me/follow-requests/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('不正な limit クエリパラメータで 400 VALIDATION_ERROR', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makeGetRequest(token, { limit: 'invalid' })
    const { GET } = await import('@/app/api/v1/users/me/follow-requests/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
  })
})

// ──────────────────────────────────────────────────
// POST /api/v1/users/me/follow-requests/{id}/approve
// ──────────────────────────────────────────────────

describe('POST /api/v1/users/me/follow-requests/{id}/approve', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60_000 })
    mockApproveFollowRequestCore.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常承認: 200 { success: true }', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePostRequest(token, 'http://localhost/api/v1/users/me/follow-requests/req-001/approve')
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/approve/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'req-001' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('approveFollowRequestCore に userId と requestId が渡される', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePostRequest(token, 'http://localhost/api/v1/users/me/follow-requests/req-001/approve')
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/approve/route')
    await POST(req, { params: Promise.resolve({ id: 'req-001' }) })

    expect(mockApproveFollowRequestCore).toHaveBeenCalledWith('user-me', 'req-001')
  })

  it('not_found → 404 NOT_FOUND', async () => {
    mockApproveFollowRequestCore.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePostRequest(token, 'http://localhost/api/v1/users/me/follow-requests/req-xxx/approve')
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/approve/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'req-xxx' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('forbidden → 404 NOT_FOUND（情報非開示）', async () => {
    mockApproveFollowRequestCore.mockResolvedValueOnce({ ok: false, reason: 'forbidden' })
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePostRequest(token, 'http://localhost/api/v1/users/me/follow-requests/req-yyy/approve')
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/approve/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'req-yyy' }) })

    expect(res.status).toBe(404)
  })

  it('already_processed → 冪等に 200', async () => {
    mockApproveFollowRequestCore.mockResolvedValueOnce({ ok: false, reason: 'already_processed' })
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePostRequest(token, 'http://localhost/api/v1/users/me/follow-requests/req-001/approve')
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/approve/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'req-001' }) })

    expect(res.status).toBe(200)
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const token = await makeAuthToken('guest-id', GUEST_EMAIL)
    const req = makePostRequest(token, 'http://localhost/api/v1/users/me/follow-requests/req-001/approve')
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/approve/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'req-001' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me/follow-requests/req-001/approve', { method: 'POST' })
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/approve/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'req-001' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30_000,
    })
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePostRequest(token, 'http://localhost/api/v1/users/me/follow-requests/req-001/approve')
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/approve/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'req-001' }) })

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})

// ──────────────────────────────────────────────────
// POST /api/v1/users/me/follow-requests/{id}/reject
// ──────────────────────────────────────────────────

describe('POST /api/v1/users/me/follow-requests/{id}/reject', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60_000 })
    mockRejectFollowRequestCore.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常拒否: 200 { success: true }', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePostRequest(token, 'http://localhost/api/v1/users/me/follow-requests/req-001/reject')
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/reject/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'req-001' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('rejectFollowRequestCore に userId と requestId が渡される', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePostRequest(token, 'http://localhost/api/v1/users/me/follow-requests/req-001/reject')
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/reject/route')
    await POST(req, { params: Promise.resolve({ id: 'req-001' }) })

    expect(mockRejectFollowRequestCore).toHaveBeenCalledWith('user-me', 'req-001')
  })

  it('not_found → 404 NOT_FOUND', async () => {
    mockRejectFollowRequestCore.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePostRequest(token, 'http://localhost/api/v1/users/me/follow-requests/req-xxx/reject')
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/reject/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'req-xxx' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('forbidden → 404 NOT_FOUND（情報非開示）', async () => {
    mockRejectFollowRequestCore.mockResolvedValueOnce({ ok: false, reason: 'forbidden' })
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePostRequest(token, 'http://localhost/api/v1/users/me/follow-requests/req-yyy/reject')
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/reject/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'req-yyy' }) })

    expect(res.status).toBe(404)
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const token = await makeAuthToken('guest-id', GUEST_EMAIL)
    const req = makePostRequest(token, 'http://localhost/api/v1/users/me/follow-requests/req-001/reject')
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/reject/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'req-001' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me/follow-requests/req-001/reject', { method: 'POST' })
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/reject/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'req-001' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30_000,
    })
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePostRequest(token, 'http://localhost/api/v1/users/me/follow-requests/req-001/reject')
    const { POST } = await import('@/app/api/v1/users/me/follow-requests/[id]/reject/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'req-001' }) })

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })
})
