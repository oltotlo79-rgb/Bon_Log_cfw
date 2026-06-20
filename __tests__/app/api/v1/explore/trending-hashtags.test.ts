// @vitest-environment node
/**
 * GET /api/v1/explore/trending-hashtags — トレンドハッシュタグ一覧
 *
 * 200 / 401 / 429 の全分岐・ゲスト可・limit パラメータ検証。
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

const mockFetchTrendingHashtags = vi.fn()
vi.mock('@/lib/services/explore-service', () => ({
  fetchTrendingHashtags: (...args: unknown[]) => mockFetchTrendingHashtags(...args),
}))

const mockHashtags = [
  { id: 'h1', name: '盆栽', count: 100 },
  { id: 'h2', name: '松', count: 80 },
  { id: 'h3', name: '黒松', count: 60 },
]

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  searchParams = '',
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const url = `http://localhost/api/v1/explore/trending-hashtags${searchParams ? `?${searchParams}` : ''}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/explore/trending-hashtags', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchTrendingHashtags.mockResolvedValue(mockHashtags)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 { items } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/explore/trending-hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(3)
  })

  it('items に { id, name, count } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/explore/trending-hashtags/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      count: expect.any(Number),
    })
  })

  it('ゲストユーザーも 200 を返す（認証任意）', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/explore/trending-hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
  })

  it('limit クエリパラメータが fetchTrendingHashtags に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'limit=5')
    const { GET } = await import('@/app/api/v1/explore/trending-hashtags/route')
    await GET(req)

    expect(mockFetchTrendingHashtags).toHaveBeenCalledWith(5)
  })

  it('limit なしのとき デフォルト limit が渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/explore/trending-hashtags/route')
    await GET(req)

    expect(mockFetchTrendingHashtags).toHaveBeenCalledWith(expect.any(Number))
  })

  it('空配列の場合は items: [] を返す', async () => {
    mockFetchTrendingHashtags.mockResolvedValueOnce([])
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/explore/trending-hashtags/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items).toHaveLength(0)
  })

  it('limit=0 は 400 VALIDATION_ERROR（最小値 1 以上が必要）', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'limit=0')
    const { GET } = await import('@/app/api/v1/explore/trending-hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('limit=101 は 400 VALIDATION_ERROR（上限 100 を超える）', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'limit=101')
    const { GET } = await import('@/app/api/v1/explore/trending-hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/explore/trending-hashtags')
    const { GET } = await import('@/app/api/v1/explore/trending-hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/explore/trending-hashtags', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/explore/trending-hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/explore/trending-hashtags', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/explore/trending-hashtags/route')
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
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/explore/trending-hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } } であること', async () => {
    const req = new NextRequest('http://localhost/api/v1/explore/trending-hashtags')
    const { GET } = await import('@/app/api/v1/explore/trending-hashtags/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
