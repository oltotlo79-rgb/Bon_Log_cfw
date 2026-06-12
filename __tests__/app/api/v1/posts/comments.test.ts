// @vitest-environment node
/**
 * GET /api/v1/posts/[id]/comments のユニットテスト
 *
 * 200 カーソルページング / 401 / 429 の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)

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

const mockFetchComments = vi.fn()
vi.mock('@/lib/services/comment-read-service', () => ({
  fetchComments: (...args: unknown[]) => mockFetchComments(...args),
}))

async function makeAuthenticatedRequest(
  userId: string,
  postId = 'post-abc',
  searchParams?: Record<string, string>,
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const url = new URL(`http://localhost/api/v1/posts/${postId}/comments`)
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v)
    }
  }
  const req = new NextRequest(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ id: postId }) }]
}

const mockCommentsResult = {
  comments: [
    { id: 'comment-1', content: 'nice post', userId: 'user-2' },
  ],
  nextCursor: undefined,
}

describe('GET /api/v1/posts/[id]/comments', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', isSuspended: false, email: 'u@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchComments.mockResolvedValue(mockCommentsResult)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンで 200 と { items, nextCursor } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.nextCursor).toBeNull()
  })

  it('nextCursor がある場合レスポンスに含まれる', async () => {
    mockFetchComments.mockResolvedValueOnce({
      comments: [{ id: 'c1' }, { id: 'c2' }],
      nextCursor: 'c2',
    })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nextCursor).toBe('c2')
    expect(body.items).toHaveLength(2)
  })

  it('cursor と limit クエリパラメータが fetchComments に渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'post-xyz', {
      cursor: 'cursor-abc',
      limit: '5',
    })
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    await GET(req, params)

    expect(mockFetchComments).toHaveBeenCalledWith('post-xyz', 'user-1', 'cursor-abc', 5)
  })

  it('limit が MAX_PAGE_LIMIT(100) を超えると 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'post-abc', { limit: '200' })
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/posts/post-abc/comments')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, { params: Promise.resolve({ id: 'post-abc' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/posts/post-abc/comments', {
      headers: { authorization: 'Bearer bad.token' },
    })
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, { params: Promise.resolve({ id: 'post-abc' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: true, email: 'u@example.com' })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, params)

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
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
