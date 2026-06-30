// @vitest-environment node
/**
 * GET /api/v1/analytics/quotes のユニットテスト
 *
 * quotes は days パラメータなし（全期間集計）。
 * 200 / 401 / 403（ゲスト・非プレミアム）/ 429 を検証する。
 * quotes[].createdAt の ISO 文字列シリアライズを確認する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const USER_ID = 'user-quotes-analytics'

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

const mockFetchQuoteAnalytics = vi.fn()
vi.mock('@/lib/services/analytics-service', () => ({
  fetchPostAnalytics: vi.fn(),
  fetchLikeAnalytics: vi.fn(),
  fetchQuoteAnalytics: (...args: unknown[]) => mockFetchQuoteAnalytics(...args),
  fetchKeywordAnalytics: vi.fn(),
  fetchEngagementTrend: vi.fn(),
  fetchGenrePerformance: vi.fn(),
  fetchFollowerGrowth: vi.fn(),
  fetchPeriodComparison: vi.fn(),
}))

async function makeBearerRequest(userId: string): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  return new NextRequest('http://localhost/api/v1/analytics/quotes', {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

const MOCK_QUOTE_ANALYTICS = {
  totalQuotes: 5,
  totalReposts: 3,
  quotes: [
    {
      id: 'quote-1',
      content: '黒松の引用',
      user: { id: 'other-user', nickname: 'testuser' },
      originalPostId: 'orig-post-1',
      originalContent: '元の投稿',
      likeCount: 4,
      commentCount: 1,
      createdAt: new Date('2026-05-10T12:00:00.000Z'),
    },
  ],
}

describe('GET /api/v1/analytics/quotes', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    mockIsPremiumUser.mockResolvedValue(true)
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 9, resetTime: Date.now() + 60000 })
    mockFetchQuoteAnalytics.mockResolvedValue(MOCK_QUOTE_ANALYTICS)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('プレミアムユーザーで 200 を返す', async () => {
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/analytics/quotes/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('fetchQuoteAnalytics が userId のみで呼ばれる（days なし）', async () => {
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/analytics/quotes/route')
    await GET(req)

    expect(mockFetchQuoteAnalytics).toHaveBeenCalledWith(USER_ID)
    expect(mockFetchQuoteAnalytics).toHaveBeenCalledOnce()
  })

  it('レスポンスに totalQuotes/totalReposts/quotes が含まれる', async () => {
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/analytics/quotes/route')
    const res = await GET(req)
    const body = await res.json()

    expect(typeof body.totalQuotes).toBe('number')
    expect(typeof body.totalReposts).toBe('number')
    expect(Array.isArray(body.quotes)).toBe(true)
  })

  it('quotes[].createdAt が ISO 文字列にシリアライズされる', async () => {
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/analytics/quotes/route')
    const res = await GET(req)
    const body = await res.json()
    const quote = body.quotes[0]

    expect(typeof quote.createdAt).toBe('string')
    expect(quote.createdAt).toContain('T')
    expect(quote.createdAt).toBe('2026-05-10T12:00:00.000Z')
  })

  it('quotes アイテムに id/content/user/originalPostId/likeCount/commentCount が含まれる', async () => {
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/analytics/quotes/route')
    const res = await GET(req)
    const body = await res.json()
    const quote = body.quotes[0]

    expect(quote).toMatchObject({
      id: expect.any(String),
      content: expect.any(String),
      user: expect.any(Object),
      originalPostId: expect.any(String),
      likeCount: expect.any(Number),
      commentCount: expect.any(Number),
    })
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/analytics/quotes', { method: 'GET' })
    const { GET } = await import('@/app/api/v1/analytics/quotes/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/analytics/quotes', {
      method: 'GET',
      headers: { authorization: 'Bearer invalid.token.here' },
    })
    const { GET } = await import('@/app/api/v1/analytics/quotes/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-id')
    const req = new NextRequest('http://localhost/api/v1/analytics/quotes', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/analytics/quotes/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: USER_ID, isSuspended: true, email: 'user@example.com' })
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/analytics/quotes/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('非プレミアムユーザーで 403 PREMIUM_REQUIRED', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(false)
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/analytics/quotes/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('PREMIUM_REQUIRED')
  })

  it('非プレミアム時は fetchQuoteAnalytics が呼ばれない', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(false)
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/analytics/quotes/route')
    await GET(req)

    expect(mockFetchQuoteAnalytics).not.toHaveBeenCalled()
  })

  it('days パラメータを渡しても無視される（Zod なし）', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(USER_ID)
    const req = new NextRequest('http://localhost/api/v1/analytics/quotes?days=30', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/analytics/quotes/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockFetchQuoteAnalytics).toHaveBeenCalledWith(USER_ID)
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/analytics/quotes/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('レート制限超過時は fetchQuoteAnalytics が呼ばれない', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/analytics/quotes/route')
    await GET(req)

    expect(mockFetchQuoteAnalytics).not.toHaveBeenCalled()
  })
})
