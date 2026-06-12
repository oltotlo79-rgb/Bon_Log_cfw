// @vitest-environment node
/**
 * GET /api/v1/search/users のユニットテスト
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

const mockFetchSearchUsers = vi.fn()
vi.mock('@/lib/services/search-service', () => ({
  fetchSearchPosts: vi.fn(),
  fetchSearchUsers: (...args: unknown[]) => mockFetchSearchUsers(...args),
}))

async function makeAuthenticatedRequest(
  userId: string,
  searchParams?: Record<string, string>,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const url = new URL('http://localhost/api/v1/search/users')
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v)
    }
  }
  return new NextRequest(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/search/users', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', isSuspended: false, email: 'u@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 19, resetTime: Date.now() + 60000 })
    mockFetchSearchUsers.mockResolvedValue({ users: [], nextCursor: undefined })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンと q パラメータで 200 と { items, nextCursor } を返す', async () => {
    mockFetchSearchUsers.mockResolvedValueOnce({
      users: [{ id: 'u1', nickname: '太郎' }],
      nextCursor: undefined,
    })
    const req = await makeAuthenticatedRequest('user-1', { q: '太郎' })
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.nextCursor).toBeNull()
  })

  it('q なしで 200 と結果を返す（空クエリは有効）', async () => {
    const req = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
  })

  it('nextCursor がある場合レスポンスに含まれる', async () => {
    mockFetchSearchUsers.mockResolvedValueOnce({
      users: [{ id: 'u1' }, { id: 'u2' }],
      nextCursor: 'u2',
    })
    const req = await makeAuthenticatedRequest('user-1', { q: '花子' })
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nextCursor).toBe('u2')
    expect(body.items).toHaveLength(2)
  })

  it('q が MAX_SEARCH_QUERY_LENGTH(100) を超えると 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', { q: 'x'.repeat(101) })
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('q がちょうど 100 文字のとき 200 を返す（境界値）', async () => {
    const req = await makeAuthenticatedRequest('user-1', { q: 'b'.repeat(100) })
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('fetchSearchUsers に q, userId, cursor, limit が渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', { q: '花子', cursor: 'c456', limit: '3' })
    const { GET } = await import('@/app/api/v1/search/users/route')
    await GET(req)

    expect(mockFetchSearchUsers).toHaveBeenCalledWith('花子', 'user-1', 'c456', 3)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/search/users?q=test')
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/search/users?q=test', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: true, email: 'u@example.com' })
    const req = await makeAuthenticatedRequest('user-1', { q: '太郎' })
    const { GET } = await import('@/app/api/v1/search/users/route')
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
    const req = await makeAuthenticatedRequest('user-1', { q: '太郎' })
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
