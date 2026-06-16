// @vitest-environment node
/**
 * POST /api/v1/posts/[id]/comments のユニットテスト
 *
 * 201 + 作成コメント / 400 / 401 / 403 ゲスト / 404 不可視投稿 / 429 の全分岐を検証する。
 * 通知（notifyCommentParticipants）はサービス層でモック済み。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const VALID_POST_ID = 'cjld2cyuq0000t3rmniod1foy'
const COMMENT_ID = 'comment001234567890123456'

// ──────────────────────────────────────────────────
// Mock: prisma
// ──────────────────────────────────────────────────
const mockUserFindUnique = vi.fn()
const mockCommentFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    comment: {
      findUnique: (...args: unknown[]) => mockCommentFindUnique(...args),
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
// Mock: comment-read-service（GET 用）
// ──────────────────────────────────────────────────
vi.mock('@/lib/services/comment-read-service', () => ({
  fetchComments: vi.fn().mockResolvedValue({ comments: [], nextCursor: undefined }),
}))

// ──────────────────────────────────────────────────
// Mock: comment-write-service
// ──────────────────────────────────────────────────
const mockCreateCommentV1 = vi.fn()
vi.mock('@/lib/services/comment-write-service', () => ({
  createCommentV1Schema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>
      if (typeof d !== 'object' || d === null) return { success: false, error: {} }
      return {
        success: true,
        data: {
          content: d['content'] ?? '',
          parentId: d['parentId'] ?? null,
          mediaUrls: d['mediaUrls'] ?? [],
          mediaTypes: d['mediaTypes'] ?? [],
        },
      }
    },
  },
  createCommentV1: (...args: unknown[]) => mockCreateCommentV1(...args),
}))

// ──────────────────────────────────────────────────
// Mock: mention-resolver / follow-state-resolver
// ──────────────────────────────────────────────────
vi.mock('@/lib/api/v1/mention-resolver', () => ({
  attachMentionedUsers: vi.fn().mockResolvedValue([]),
  attachMentionedUsersToOne: vi.fn(),
}))

vi.mock('@/lib/api/v1/follow-state-resolver', () => ({
  resolveBlockMuteStates: vi.fn().mockResolvedValue(new Map()),
  resolveBlockMuteStateForOne: vi.fn().mockResolvedValue({ isBlocked: false, isMuted: false }),
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
const COMMENTER_ID = 'user-commenter'

const mockCreatedComment = {
  id: COMMENT_ID,
  postId: VALID_POST_ID,
  userId: COMMENTER_ID,
  content: 'テストコメント',
  createdAt: new Date().toISOString(),
  deletedAt: null,
  parentId: null,
  isHidden: false,
  media: [],
  user: { id: COMMENTER_ID, nickname: 'Commenter', avatarUrl: null },
  _count: { likes: 0, replies: 0 },
}

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  postId: string,
  body: unknown,
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const req = new NextRequest(`http://localhost/api/v1/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return [req, { params: Promise.resolve({ id: postId }) }]
}

const validBody = {
  content: 'テストコメント',
  mediaUrls: [],
  mediaTypes: [],
}

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────
describe('POST /api/v1/posts/[id]/comments', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: COMMENTER_ID, isSuspended: false, email: 'commenter@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockCreateCommentV1.mockResolvedValue({ ok: true, commentId: COMMENT_ID })
    mockCommentFindUnique.mockResolvedValue(mockCreatedComment)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 201 + 作成コメントを返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(
      COMMENTER_ID, 'commenter@example.com', VALID_POST_ID, validBody,
    )
    const { POST } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await POST(req, params)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(COMMENT_ID)
  })

  it('不可視投稿（createCommentV1 が 404）→ 404 NOT_FOUND', async () => {
    mockCreateCommentV1.mockResolvedValue({ ok: false, error: '投稿が見つかりません', status: 404 })
    const [req, params] = await makeAuthenticatedRequest(
      COMMENTER_ID, 'commenter@example.com', VALID_POST_ID, validBody,
    )
    const { POST } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('バリデーションエラー（createCommentV1 が 400）→ 400 VALIDATION_ERROR', async () => {
    mockCreateCommentV1.mockResolvedValue({ ok: false, error: 'コメントが長すぎます', status: 400 })
    const [req, params] = await makeAuthenticatedRequest(
      COMMENTER_ID, 'commenter@example.com', VALID_POST_ID, { content: 'a'.repeat(600), mediaUrls: [], mediaTypes: [] },
    )
    const { POST } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('1日コメント上限（createCommentV1 が 429）→ 429 RATE_LIMITED', async () => {
    mockCreateCommentV1.mockResolvedValue({ ok: false, error: '1日のコメント上限に達しました', status: 429 })
    const [req, params] = await makeAuthenticatedRequest(
      COMMENTER_ID, 'commenter@example.com', VALID_POST_ID, validBody,
    )
    const { POST } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/posts/${VALID_POST_ID}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const { POST } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_POST_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(`http://localhost/api/v1/posts/${VALID_POST_ID}/comments`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const { POST } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_POST_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウント → 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: COMMENTER_ID, isSuspended: true, email: 'commenter@example.com' })
    const [req, params] = await makeAuthenticatedRequest(
      COMMENTER_ID, 'commenter@example.com', VALID_POST_ID, validBody,
    )
    const { POST } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await POST(req, params)

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
      COMMENTER_ID, 'commenter@example.com', VALID_POST_ID, validBody,
    )
    const { POST } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('JSON パース失敗 → 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(COMMENTER_ID)
    const req = new NextRequest(`http://localhost/api/v1/posts/${VALID_POST_ID}/comments`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'invalid-json{',
    })
    const { POST } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_POST_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('createCommentV1 の呼び出しに正しい postId / userId / input が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(
      COMMENTER_ID, 'commenter@example.com', VALID_POST_ID, validBody,
    )
    const { POST } = await import('@/app/api/v1/posts/[id]/comments/route')
    await POST(req, params)

    expect(mockCreateCommentV1).toHaveBeenCalledWith(
      VALID_POST_ID,
      expect.objectContaining({ content: 'テストコメント', mediaUrls: [], mediaTypes: [] }),
      COMMENTER_ID,
    )
  })

  it('コメント作成後の findUnique が null → 500 INTERNAL_ERROR', async () => {
    mockCommentFindUnique.mockResolvedValue(null)
    const [req, params] = await makeAuthenticatedRequest(
      COMMENTER_ID, 'commenter@example.com', VALID_POST_ID, validBody,
    )
    const { POST } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await POST(req, params)

    expect(res.status).toBe(500)
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    mockCreateCommentV1.mockResolvedValue({ ok: false, error: 'エラー', status: 400 })
    const [req, params] = await makeAuthenticatedRequest(
      COMMENTER_ID, 'commenter@example.com', VALID_POST_ID, validBody,
    )
    const { POST } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await POST(req, params)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
