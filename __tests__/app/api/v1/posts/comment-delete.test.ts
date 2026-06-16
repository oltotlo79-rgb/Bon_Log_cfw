// @vitest-environment node
/**
 * DELETE /api/v1/posts/[id]/comments/[commentId] のユニットテスト
 *
 * コメント所有者 or 投稿所有者のみ削除可能。
 * 両方違う → 403。不存在 → 404。401 / 429 も検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const VALID_POST_ID = 'cjld2cyuq0000t3rmniod1foy'
const VALID_COMMENT_ID = 'comment001234567890123456'

// ──────────────────────────────────────────────────
// Mock: prisma
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
// Mock: rate-limit
// ──────────────────────────────────────────────────
const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

// ──────────────────────────────────────────────────
// Mock: comment-write-service
// ──────────────────────────────────────────────────
const mockDeleteCommentV1 = vi.fn()
vi.mock('@/lib/services/comment-write-service', () => ({
  deleteCommentV1: (...args: unknown[]) => mockDeleteCommentV1(...args),
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
const COMMENT_OWNER_ID = 'user-commenter'
const POST_OWNER_ID = 'user-post-owner'
const OTHER_ID = 'user-other'

type RouteContext = { params: Promise<{ id: string; commentId: string }> }

async function makeAuthenticatedRequest(
  userId: string,
  postId: string,
  commentId: string,
): Promise<[NextRequest, RouteContext]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const req = new NextRequest(
    `http://localhost/api/v1/posts/${postId}/comments/${commentId}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    },
  )
  return [
    req,
    { params: Promise.resolve({ id: postId, commentId }) },
  ]
}

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────
describe('DELETE /api/v1/posts/[id]/comments/[commentId]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: COMMENT_OWNER_ID, isSuspended: false, email: 'commenter@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 9, resetTime: Date.now() + 60000 })
    mockDeleteCommentV1.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: コメント所有者が削除 → 200 { success: true }', async () => {
    const [req, params] = await makeAuthenticatedRequest(
      COMMENT_OWNER_ID, VALID_POST_ID, VALID_COMMENT_ID,
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/comments/[commentId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('正常系: 投稿所有者がコメント削除できる', async () => {
    mockUserFindUnique.mockResolvedValue({ id: POST_OWNER_ID, isSuspended: false, email: 'post-owner@example.com' })
    const [req, params] = await makeAuthenticatedRequest(
      POST_OWNER_ID, VALID_POST_ID, VALID_COMMENT_ID,
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/comments/[commentId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    expect(mockDeleteCommentV1).toHaveBeenCalledWith(VALID_COMMENT_ID, POST_OWNER_ID)
  })

  it('コメント所有者でも投稿所有者でもない → 403（deleteCommentV1 が 403）', async () => {
    mockUserFindUnique.mockResolvedValue({ id: OTHER_ID, isSuspended: false, email: 'other@example.com' })
    mockDeleteCommentV1.mockResolvedValue({ ok: false, error: '権限がありません', status: 403 })
    const [req, params] = await makeAuthenticatedRequest(
      OTHER_ID, VALID_POST_ID, VALID_COMMENT_ID,
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/comments/[commentId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(403)
  })

  it('存在しないコメント → 404 NOT_FOUND', async () => {
    mockDeleteCommentV1.mockResolvedValue({ ok: false, error: 'コメントが見つかりません', status: 404 })
    const [req, params] = await makeAuthenticatedRequest(
      COMMENT_OWNER_ID, VALID_POST_ID, VALID_COMMENT_ID,
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/comments/[commentId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(
      `http://localhost/api/v1/posts/${VALID_POST_ID}/comments/${VALID_COMMENT_ID}`,
      { method: 'DELETE' },
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/comments/[commentId]/route')
    const res = await DELETE(req, {
      params: Promise.resolve({ id: VALID_POST_ID, commentId: VALID_COMMENT_ID }),
    })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(
      `http://localhost/api/v1/posts/${VALID_POST_ID}/comments/${VALID_COMMENT_ID}`,
      { method: 'DELETE', headers: { authorization: `Bearer ${token}` } },
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/comments/[commentId]/route')
    const res = await DELETE(req, {
      params: Promise.resolve({ id: VALID_POST_ID, commentId: VALID_COMMENT_ID }),
    })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウント → 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: COMMENT_OWNER_ID, isSuspended: true, email: 'commenter@example.com' })
    const [req, params] = await makeAuthenticatedRequest(
      COMMENT_OWNER_ID, VALID_POST_ID, VALID_COMMENT_ID,
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/comments/[commentId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const [req, params] = await makeAuthenticatedRequest(
      COMMENT_OWNER_ID, VALID_POST_ID, VALID_COMMENT_ID,
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/comments/[commentId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('不正な commentId 形式（空文字）→ 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest(
      COMMENT_OWNER_ID, VALID_POST_ID, '',
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/comments/[commentId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(400)
  })

  it('deleteCommentV1 に正しい commentId と userId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(
      COMMENT_OWNER_ID, VALID_POST_ID, VALID_COMMENT_ID,
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/comments/[commentId]/route')
    await DELETE(req, params)

    expect(mockDeleteCommentV1).toHaveBeenCalledWith(VALID_COMMENT_ID, COMMENT_OWNER_ID)
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    mockDeleteCommentV1.mockResolvedValue({ ok: false, error: '削除失敗', status: 404 })
    const [req, params] = await makeAuthenticatedRequest(
      COMMENT_OWNER_ID, VALID_POST_ID, VALID_COMMENT_ID,
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/comments/[commentId]/route')
    const res = await DELETE(req, params)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
