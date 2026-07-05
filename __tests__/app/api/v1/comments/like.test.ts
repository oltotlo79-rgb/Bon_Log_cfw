// @vitest-environment node
/**
 * POST /api/v1/comments/[id]/like — いいね付与（冪等）
 * DELETE /api/v1/comments/[id]/like — いいね解除（冪等）
 *
 * 200 / 404 / 401 / 403 / 429 の全分岐と冪等性を検証する。
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

const mockAddCommentLike = vi.fn()
const mockRemoveCommentLike = vi.fn()
vi.mock('@/lib/services/like-service', () => ({
  addCommentLike: (...args: unknown[]) => mockAddCommentLike(...args),
  removeCommentLike: (...args: unknown[]) => mockRemoveCommentLike(...args),
}))

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  commentId = 'comment-abc',
  method: 'POST' | 'DELETE' = 'POST',
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const req = new NextRequest(`http://localhost/api/v1/comments/${commentId}/like`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ id: commentId }) }]
}

describe('POST /api/v1/comments/[id]/like', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 })
    mockAddCommentLike.mockResolvedValue({ found: true, liked: true, likeCount: 5 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンと存在するコメントで 200 と { liked: true, likeCount } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.liked).toBe(true)
    expect(typeof body.likeCount).toBe('number')
  })

  it('addCommentLike に commentId と userId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'comment-xyz')
    const { POST } = await import('@/app/api/v1/comments/[id]/like/route')
    await POST(req, params)

    expect(mockAddCommentLike).toHaveBeenCalledWith('comment-xyz', 'user-1')
  })

  it('既にいいね済みでも 200 liked:true を返す（冪等）', async () => {
    mockAddCommentLike.mockResolvedValueOnce({ found: true, liked: true, likeCount: 10 })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.liked).toBe(true)
    expect(body.likeCount).toBe(10)
  })

  it('不存在コメント (found: false) で 404 NOT_FOUND', async () => {
    mockAddCommentLike.mockResolvedValueOnce({ found: false })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('非表示/削除済み/閲覧不可コメントでも found:false を返すため 404（情報非開示）', async () => {
    mockAddCommentLike.mockResolvedValueOnce({ found: false })
    const [req, params] = await makeAuthenticatedRequest('other-user', 'other@example.com')
    const { POST } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/comments/comment-abc/like', { method: 'POST' })
    const { POST } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'comment-abc' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/comments/comment-abc/like', {
      method: 'POST',
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { POST } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'comment-abc' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/comments/comment-abc/like', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    const { POST } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'comment-abc' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { POST } = await import('@/app/api/v1/comments/[id]/like/route')
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
    const { POST } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('likeCount が数値として返される', async () => {
    mockAddCommentLike.mockResolvedValueOnce({ found: true, liked: true, likeCount: 42 })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await POST(req, params)

    const body = await res.json()
    expect(body.likeCount).toBe(42)
  })

  it('不正 id（31文字超）への POST で 400 VALIDATION_ERROR', async () => {
    const invalidId = 'a'.repeat(31)
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', invalidId)
    const { POST } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('DELETE /api/v1/comments/[id]/like', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 })
    mockRemoveCommentLike.mockResolvedValue({ found: true, liked: false, likeCount: 4 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンと存在するコメントで 200 と { liked: false, likeCount } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'comment-abc', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.liked).toBe(false)
    expect(typeof body.likeCount).toBe('number')
  })

  it('removeCommentLike に commentId と userId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'comment-xyz', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/comments/[id]/like/route')
    await DELETE(req, params)

    expect(mockRemoveCommentLike).toHaveBeenCalledWith('comment-xyz', 'user-1')
  })

  it('いいねしていない場合でも 200 liked:false を返す（冪等）', async () => {
    mockRemoveCommentLike.mockResolvedValueOnce({ found: true, liked: false, likeCount: 3 })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'comment-abc', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.liked).toBe(false)
    expect(body.likeCount).toBe(3)
  })

  it('不存在コメント (found: false) で 404 NOT_FOUND', async () => {
    mockRemoveCommentLike.mockResolvedValueOnce({ found: false })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'comment-abc', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/comments/comment-abc/like', { method: 'DELETE' })
    const { DELETE } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: 'comment-abc' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, 'comment-abc', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/comments/comment-abc/like', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    const { DELETE } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: 'comment-abc' }) })

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
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'comment-abc', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('likeCount が操作後の値を返す', async () => {
    mockRemoveCommentLike.mockResolvedValueOnce({ found: true, liked: false, likeCount: 0 })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'comment-abc', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await DELETE(req, params)

    const body = await res.json()
    expect(body.likeCount).toBe(0)
  })

  it('不正 id（31文字超）への DELETE で 400 VALIDATION_ERROR', async () => {
    const invalidId = 'a'.repeat(31)
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', invalidId, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/comments/[id]/like/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
