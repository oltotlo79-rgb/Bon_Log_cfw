// @vitest-environment node
/**
 * POST /api/v1/posts/[id]/repost — リポスト追加（冪等）
 * DELETE /api/v1/posts/[id]/repost — リポスト解除（冪等）
 *
 * 200 / 400 / 401 / 403 / 404 / 429 の全分岐と冪等性、
 * 自己リポスト禁止、ゲスト拒否を検証する。
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

const mockAddRepost = vi.fn()
const mockRemoveRepost = vi.fn()
vi.mock('@/lib/services/repost-service', () => ({
  addRepost: (...args: unknown[]) => mockAddRepost(...args),
  removeRepost: (...args: unknown[]) => mockRemoveRepost(...args),
}))

const VALID_POST_ID = 'cjld2cjxh0000qzrmn831i7rn'
const USER_ID = 'cjld2user0000qzrmn831i7rn'

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  postId = VALID_POST_ID,
  method: 'POST' | 'DELETE' = 'POST',
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const req = new NextRequest(`http://localhost/api/v1/posts/${postId}/repost`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ id: postId }) }]
}

describe('POST /api/v1/posts/[id]/repost', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 })
    mockAddRepost.mockResolvedValue({ ok: true, reposted: true, repostCount: 3 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 と { reposted: true, repostCount } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reposted).toBe(true)
    expect(typeof body.repostCount).toBe('number')
  })

  it('addRepost に postId と userId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com', VALID_POST_ID)
    const { POST } = await import('@/app/api/v1/posts/[id]/repost/route')
    await POST(req, params)

    expect(mockAddRepost).toHaveBeenCalledWith(VALID_POST_ID, USER_ID)
  })

  it('既にリポスト済みでも 200 reposted:true を返す（冪等）', async () => {
    mockAddRepost.mockResolvedValueOnce({ ok: true, reposted: true, repostCount: 5 })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reposted).toBe(true)
    expect(body.repostCount).toBe(5)
  })

  it('自己リポスト → 400 VALIDATION_ERROR', async () => {
    mockAddRepost.mockResolvedValueOnce({ ok: false, error: '自己リポストはできません', status: 400 })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('投稿が存在しない → 404 NOT_FOUND', async () => {
    mockAddRepost.mockResolvedValueOnce({ ok: false, error: '投稿が見つかりません', status: 404 })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('日次上限超過 → 429（status 429 from service）', async () => {
    mockAddRepost.mockResolvedValueOnce({ ok: false, error: '1日の投稿上限に達しました', status: 429 })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/posts/${VALID_POST_ID}/repost`, { method: 'POST' })
    const { POST } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_POST_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { POST } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await POST(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest(`http://localhost/api/v1/posts/${VALID_POST_ID}/repost`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    const { POST } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_POST_ID }) })

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
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('不正 id（31文字超）で 400 VALIDATION_ERROR', async () => {
    const invalidId = 'a'.repeat(31)
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com', invalidId)
    const { POST } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('repostCount が数値として返される', async () => {
    mockAddRepost.mockResolvedValueOnce({ ok: true, reposted: true, repostCount: 42 })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await POST(req, params)

    const body = await res.json()
    expect(body.repostCount).toBe(42)
  })
})

describe('DELETE /api/v1/posts/[id]/repost', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 })
    mockRemoveRepost.mockResolvedValue({ ok: true, reposted: false, repostCount: 2 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 と { reposted: false, repostCount } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com', VALID_POST_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reposted).toBe(false)
    expect(typeof body.repostCount).toBe('number')
  })

  it('removeRepost に postId と userId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com', VALID_POST_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/posts/[id]/repost/route')
    await DELETE(req, params)

    expect(mockRemoveRepost).toHaveBeenCalledWith(VALID_POST_ID, USER_ID)
  })

  it('リポストしていない場合でも 200 reposted:false（冪等）', async () => {
    mockRemoveRepost.mockResolvedValueOnce({ ok: true, reposted: false, repostCount: 0 })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com', VALID_POST_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reposted).toBe(false)
  })

  it('投稿が存在しない → 404 NOT_FOUND', async () => {
    mockRemoveRepost.mockResolvedValueOnce({ ok: false, error: '投稿が見つかりません', status: 404 })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com', VALID_POST_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/posts/${VALID_POST_ID}/repost`, { method: 'DELETE' })
    const { DELETE } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: VALID_POST_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, VALID_POST_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await DELETE(req, params)

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
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com', VALID_POST_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('不正 id（31文字超）で 400 VALIDATION_ERROR', async () => {
    const invalidId = 'a'.repeat(31)
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com', invalidId, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/posts/[id]/repost/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
