// @vitest-environment node
/**
 * GET /api/v1/users/[id]/comments のユニットテスト
 *
 * 200 / 401 / 403 / 404 / 429 の全分岐、カーソルページネーション、
 * Bearer 認証（ゲスト可）、limit のバリデーションを検証する。
 * サービス層（fetchUserComments）のドメインロジックは
 * __tests__/lib/services/user-comments-service.test.ts で別途検証する。
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

const mockFetchUserComments = vi.fn()
vi.mock('@/lib/services/user-comments-service', () => ({
  fetchUserComments: (...args: unknown[]) => mockFetchUserComments(...args),
}))

const TARGET_USER_ID = 'user-target'
const VIEWER_ID = 'viewer-1'

const mockCommentItem = {
  id: 'comment-1',
  content: 'テストコメント',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  post: { id: 'post-1', content: 'テスト投稿' },
}

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  targetId = TARGET_USER_ID,
  query = '',
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const req = new NextRequest(
    `http://localhost/api/v1/users/${targetId}/comments${query ? `?${query}` : ''}`,
    { headers: { authorization: `Bearer ${token}` } },
  )
  return [req, { params: Promise.resolve({ id: targetId }) }]
}

describe('GET /api/v1/users/[id]/comments', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchUserComments.mockResolvedValue({ ok: true, items: [mockCommentItem], nextCursor: undefined })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンと公開アカウントで 200 とコメント一覧を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(1)
  })

  it('items の各要素が { id, content, createdAt, post } の形状で createdAt が ISO 文字列', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      id: 'comment-1',
      content: 'テストコメント',
      createdAt: '2025-01-01T00:00:00.000Z',
      post: { id: 'post-1', content: 'テスト投稿' },
    })
  })

  it('nextCursor が null のとき null を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.nextCursor).toBeNull()
  })

  it('nextCursor が存在するとき文字列で返す（カーソルページネーション）', async () => {
    mockFetchUserComments.mockResolvedValueOnce({ ok: true, items: [mockCommentItem], nextCursor: 'comment-1' })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.nextCursor).toBe('comment-1')
  })

  it('ゲストユーザーでも公開アカウントのコメントを 200 で取得できる（rejectGuest なし）', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
  })

  it('非公開アカウントかつ未フォローで fetchUserComments が private_account を返す → 403', async () => {
    mockFetchUserComments.mockResolvedValueOnce({ ok: false, reason: 'private_account' })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('対象ユーザーが見つからない場合 → 404 NOT_FOUND', async () => {
    mockFetchUserComments.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('fetchUserComments に targetUserId と viewerId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', 'user-other')
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    await GET(req, params)

    expect(mockFetchUserComments).toHaveBeenCalledWith('user-other', VIEWER_ID, undefined, undefined)
  })

  it('cursor クエリパラメータが fetchUserComments に渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', TARGET_USER_ID, 'cursor=comment-abc')
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    await GET(req, params)

    expect(mockFetchUserComments).toHaveBeenCalledWith(TARGET_USER_ID, VIEWER_ID, 'comment-abc', undefined)
  })

  it('limit クエリパラメータが fetchUserComments に渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', TARGET_USER_ID, 'limit=5')
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    await GET(req, params)

    expect(mockFetchUserComments).toHaveBeenCalledWith(TARGET_USER_ID, VIEWER_ID, undefined, 5)
  })

  it('不正な limit（文字列 "abc"）で 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', TARGET_USER_ID, 'limit=abc')
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('limit が上限を超える場合 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', TARGET_USER_ID, 'limit=99999')
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/comments`)
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    const res = await GET(req, { params: Promise.resolve({ id: TARGET_USER_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/comments`, {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    const res = await GET(req, { params: Promise.resolve({ id: TARGET_USER_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/comments`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    const res = await GET(req, { params: Promise.resolve({ id: TARGET_USER_ID }) })

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
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('レート制限は timeline カテゴリで実施される', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    await GET(req, params)

    expect(mockCheckUserRateLimit).toHaveBeenCalledWith(VIEWER_ID, 'timeline')
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/comments`)
    const { GET } = await import('@/app/api/v1/users/[id]/comments/route')
    const res = await GET(req, { params: Promise.resolve({ id: TARGET_USER_ID }) })

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
