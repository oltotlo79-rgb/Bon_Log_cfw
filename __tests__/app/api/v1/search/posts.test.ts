// @vitest-environment node
/**
 * GET /api/v1/search/posts のユニットテスト
 *
 * 200 / q の Zod 検証 / 401 / 429 の全分岐を検証する。
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

const mockFetchSearchPosts = vi.fn()
vi.mock('@/lib/services/search-service', () => ({
  fetchSearchPosts: (...args: unknown[]) => mockFetchSearchPosts(...args),
  fetchSearchUsers: vi.fn(),
}))

async function makeAuthenticatedRequest(
  userId: string,
  searchParams?: Record<string, string>,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const url = new URL('http://localhost/api/v1/search/posts')
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v)
    }
  }
  return new NextRequest(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/search/posts', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', isSuspended: false, email: 'u@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 19, resetTime: Date.now() + 60000 })
    mockFetchSearchPosts.mockResolvedValue({ posts: [], nextCursor: undefined })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンと q パラメータで 200 と { items, nextCursor } を返す', async () => {
    mockFetchSearchPosts.mockResolvedValueOnce({
      posts: [{ id: 'post-1', content: '松' }],
      nextCursor: undefined,
    })
    const req = await makeAuthenticatedRequest('user-1', { q: '松' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.nextCursor).toBeNull()
  })

  it('q なしで 200 と空の items を返す（空クエリは有効）', async () => {
    const req = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
  })

  it('nextCursor がある場合レスポンスに含まれる', async () => {
    mockFetchSearchPosts.mockResolvedValueOnce({
      posts: [{ id: 'p1' }, { id: 'p2' }],
      nextCursor: 'p2',
    })
    const req = await makeAuthenticatedRequest('user-1', { q: '盆栽' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nextCursor).toBe('p2')
  })

  it('q が MAX_SEARCH_QUERY_LENGTH(100) を超えると 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', { q: 'a'.repeat(101) })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('q がちょうど 100 文字のとき 200 を返す（境界値）', async () => {
    const req = await makeAuthenticatedRequest('user-1', { q: 'a'.repeat(100) })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('limit が MAX_PAGE_LIMIT(100) を超えると 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', { q: '松', limit: '101' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('fetchSearchPosts に q, userId, cursor, limit が渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', { q: '黒松', cursor: 'c123', limit: '5' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    expect(mockFetchSearchPosts).toHaveBeenCalledWith(
      '黒松',
      'user-1',
      undefined,
      'c123',
      5,
    )
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/search/posts?q=test')
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/search/posts?q=test', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: true, email: 'u@example.com' })
    const req = await makeAuthenticatedRequest('user-1', { q: '松' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

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
    const req = await makeAuthenticatedRequest('user-1', { q: '松' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
