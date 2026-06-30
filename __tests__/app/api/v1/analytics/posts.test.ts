// @vitest-environment node
/**
 * GET /api/v1/analytics/posts のユニットテスト
 *
 * 200（成功）/ 400（days バリデーション）/ 401 / 403（ゲスト・非プレミアム）/
 * 429（レート制限）の全分岐を検証する。
 * Date の ISO 文字列シリアライズ・topPosts/posts 配列構造を確認する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const USER_ID = 'user-posts-analytics'

const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

const mockIsPremiumUser = vi.fn()
vi.mock('@/lib/premium', () => ({
  isPremiumUser: (...args: unknown[]) => mockIsPremiumUser(...args),
}))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

const mockFetchPostAnalytics = vi.fn()
vi.mock('@/lib/services/analytics-service', () => ({
  fetchPostAnalytics: (...args: unknown[]) => mockFetchPostAnalytics(...args),
  fetchLikeAnalytics: vi.fn(),
  fetchQuoteAnalytics: vi.fn(),
  fetchKeywordAnalytics: vi.fn(),
  fetchEngagementTrend: vi.fn(),
  fetchGenrePerformance: vi.fn(),
  fetchFollowerGrowth: vi.fn(),
  fetchPeriodComparison: vi.fn(),
  fetchDetailedAnalytics: vi.fn(),
  fetchBasicStats: vi.fn(),
}))

async function makeBearerRequest(userId: string, searchParams = ''): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const url = `http://localhost/api/v1/analytics/posts${searchParams ? `?${searchParams}` : ''}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

const MOCK_POSTS_ANALYTICS = {
  totalPosts: 8,
  totalLikes: 45,
  totalComments: 12,
  avgEngagement: 7.1,
  topPosts: [
    {
      id: 'post-top-1',
      content: '黒松の管理',
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      likeCount: 20,
      commentCount: 5,
    },
  ],
  posts: [
    {
      id: 'post-1',
      content: '盆栽日記',
      createdAt: new Date('2026-06-15T08:00:00.000Z'),
      likeCount: 5,
      commentCount: 2,
    },
  ],
}

describe('GET /api/v1/analytics/posts', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    mockIsPremiumUser.mockResolvedValue(true)
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 9, resetTime: Date.now() + 60000 })
    mockFetchPostAnalytics.mockResolvedValue(MOCK_POSTS_ANALYTICS)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('プレミアムユーザーが days=30 で 200 を返す', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('days 省略時はデフォルト 30 で fetchPostAnalytics が呼ばれる', async () => {
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    await GET(req)

    expect(mockFetchPostAnalytics).toHaveBeenCalledWith(USER_ID, 30)
  })

  it('days=7 で fetchPostAnalytics が 7 で呼ばれる', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=7')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    await GET(req)

    expect(mockFetchPostAnalytics).toHaveBeenCalledWith(USER_ID, 7)
  })

  it('days=90 で fetchPostAnalytics が 90 で呼ばれる', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=90')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    await GET(req)

    expect(mockFetchPostAnalytics).toHaveBeenCalledWith(USER_ID, 90)
  })

  it('レスポンスに totalPosts/totalLikes/totalComments/avgEngagement が含まれる', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    const body = await res.json()
    expect(typeof body.totalPosts).toBe('number')
    expect(typeof body.totalLikes).toBe('number')
    expect(typeof body.totalComments).toBe('number')
    expect(typeof body.avgEngagement).toBe('number')
  })

  it('topPosts 配列が返される', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    const body = await res.json()
    expect(Array.isArray(body.topPosts)).toBe(true)
  })

  it('posts 配列が返される', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    const body = await res.json()
    expect(Array.isArray(body.posts)).toBe(true)
  })

  it('topPosts[].createdAt が ISO 文字列にシリアライズされる', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    const body = await res.json()
    const post = body.topPosts[0]
    expect(typeof post.createdAt).toBe('string')
    expect(post.createdAt).toContain('T')
    expect(post.createdAt).toBe('2026-06-01T10:00:00.000Z')
  })

  it('posts[].createdAt が ISO 文字列にシリアライズされる', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    const body = await res.json()
    const post = body.posts[0]
    expect(typeof post.createdAt).toBe('string')
    expect(post.createdAt).toContain('T')
  })

  it('topPosts アイテムに id/content/likeCount/commentCount が含まれる', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    const body = await res.json()
    const post = body.topPosts[0]
    expect(post).toMatchObject({
      id: expect.any(String),
      likeCount: expect.any(Number),
      commentCount: expect.any(Number),
    })
  })

  it('fetchPostAnalytics が 1 回だけ呼ばれる', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    await GET(req)

    expect(mockFetchPostAnalytics).toHaveBeenCalledOnce()
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/analytics/posts', { method: 'GET' })
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/analytics/posts', {
      method: 'GET',
      headers: { authorization: 'Bearer invalid.token.here' },
    })
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-id')
    const req = new NextRequest('http://localhost/api/v1/analytics/posts', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: USER_ID, isSuspended: true, email: 'user@example.com' })
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('非プレミアムユーザーで 403 PREMIUM_REQUIRED', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(false)
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('PREMIUM_REQUIRED')
  })

  it('非プレミアム時は fetchPostAnalytics が呼ばれない', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(false)
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    await GET(req)

    expect(mockFetchPostAnalytics).not.toHaveBeenCalled()
  })

  it('days=1（不正値）で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=1')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('days=100（不正値）で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=100')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('days=abc（文字列）で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=abc')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な days でレート制限を消費しない（Zod エラー優先）', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=999')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('レート制限超過時は fetchPostAnalytics が呼ばれない', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    await GET(req)

    expect(mockFetchPostAnalytics).not.toHaveBeenCalled()
  })

  it('エラーレスポンスは { error: { code, message, status } } 形式', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(false)
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/posts/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
