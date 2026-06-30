// @vitest-environment node
/**
 * GET /api/v1/analytics/keywords のユニットテスト
 *
 * 200 / 400（days バリデーション）/ 401 / 403（ゲスト・非プレミアム）/ 429 の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const USER_ID = 'user-keywords-analytics'

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

const mockFetchKeywordAnalytics = vi.fn()
vi.mock('@/lib/services/analytics-service', () => ({
  fetchPostAnalytics: vi.fn(),
  fetchLikeAnalytics: vi.fn(),
  fetchQuoteAnalytics: vi.fn(),
  fetchKeywordAnalytics: (...args: unknown[]) => mockFetchKeywordAnalytics(...args),
  fetchEngagementTrend: vi.fn(),
  fetchGenrePerformance: vi.fn(),
  fetchFollowerGrowth: vi.fn(),
  fetchPeriodComparison: vi.fn(),
}))

async function makeBearerRequest(userId: string, searchParams = ''): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const url = `http://localhost/api/v1/analytics/keywords${searchParams ? `?${searchParams}` : ''}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

const MOCK_KEYWORD_ANALYTICS = {
  topKeywords: [
    { keyword: '黒松', count: 12, avgLikes: 5.5 },
    { keyword: '盆栽', count: 8, avgLikes: 3.2 },
  ],
}

describe('GET /api/v1/analytics/keywords', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    mockIsPremiumUser.mockResolvedValue(true)
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 9, resetTime: Date.now() + 60000 })
    mockFetchKeywordAnalytics.mockResolvedValue(MOCK_KEYWORD_ANALYTICS)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('プレミアムユーザーが days=30 で 200 を返す', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('days 省略時はデフォルト 30 で fetchKeywordAnalytics が呼ばれる', async () => {
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    await GET(req)

    expect(mockFetchKeywordAnalytics).toHaveBeenCalledWith(USER_ID, 30)
  })

  it('days=7 で fetchKeywordAnalytics が 7 で呼ばれる', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=7')
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    await GET(req)

    expect(mockFetchKeywordAnalytics).toHaveBeenCalledWith(USER_ID, 7)
  })

  it('days=90 で fetchKeywordAnalytics が 90 で呼ばれる', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=90')
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    await GET(req)

    expect(mockFetchKeywordAnalytics).toHaveBeenCalledWith(USER_ID, 90)
  })

  it('fetchKeywordAnalytics が 1 回だけ呼ばれる', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    await GET(req)

    expect(mockFetchKeywordAnalytics).toHaveBeenCalledOnce()
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/analytics/keywords', { method: 'GET' })
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/analytics/keywords', {
      method: 'GET',
      headers: { authorization: 'Bearer invalid.token.here' },
    })
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-id')
    const req = new NextRequest('http://localhost/api/v1/analytics/keywords', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: USER_ID, isSuspended: true, email: 'user@example.com' })
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('非プレミアムユーザーで 403 PREMIUM_REQUIRED', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(false)
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('PREMIUM_REQUIRED')
  })

  it('非プレミアム時は fetchKeywordAnalytics が呼ばれない', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(false)
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    await GET(req)

    expect(mockFetchKeywordAnalytics).not.toHaveBeenCalled()
  })

  it('days=1（不正値）で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=1')
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('days=abc（文字列）で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=abc')
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な days でレート制限を消費しない（Zod エラー優先）', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=999')
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('レート制限超過時は fetchKeywordAnalytics が呼ばれない', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/keywords/route')
    await GET(req)

    expect(mockFetchKeywordAnalytics).not.toHaveBeenCalled()
  })
})
