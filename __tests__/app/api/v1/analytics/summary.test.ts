// @vitest-environment node
/**
 * GET /api/v1/analytics/summary のユニットテスト
 *
 * 200（成功）/ 400（バリデーション）/ 401 / 403（ゲスト・非プレミアム）/
 * 429（レート制限）の全分岐を検証する。
 * プレミアム判定・days バリデーション・レスポンス構造を重点的に確認する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const USER_ID = 'user-analytics'

// ──────────────────────────────────────────────────
// Mock: prisma（requireBearerUser が user テーブルを参照する）
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
// Mock: premium チェック
// ──────────────────────────────────────────────────
const mockIsPremiumUser = vi.fn()
vi.mock('@/lib/premium', () => ({
  isPremiumUser: (...args: unknown[]) => mockIsPremiumUser(...args),
}))

// ──────────────────────────────────────────────────
// Mock: rate-limit
// ──────────────────────────────────────────────────
const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

// ──────────────────────────────────────────────────
// Mock: analytics-read-service
// ──────────────────────────────────────────────────
const mockFetchAnalyticsSummary = vi.fn()
vi.mock('@/lib/services/analytics-read-service', () => ({
  fetchAnalyticsSummary: (...args: unknown[]) => mockFetchAnalyticsSummary(...args),
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
async function makeBearerRequest(
  userId: string,
  searchParams = '',
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const url = `http://localhost/api/v1/analytics/summary${searchParams ? `?${searchParams}` : ''}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

const MOCK_SUMMARY = {
  period: {
    days: 30,
    start: '2026-05-23',
    end: '2026-06-22',
  },
  posts: {
    total: 5,
    totalLikes: 30,
    totalComments: 10,
    avgEngagement: 8.0,
    topPosts: [
      {
        id: 'post-1',
        content: '盆栽日記',
        createdAt: '2026-06-01T10:00:00.000Z',
        likeCount: 20,
        commentCount: 5,
      },
    ],
  },
  followers: {
    current: 100,
    newInPeriod: 10,
    growth: [
      { date: '2026-06-01', newFollowers: 3, totalFollowers: 91 },
    ],
  },
  engagementTrend: [
    { date: '2026-06-01', posts: 2, likes: 15, comments: 3, engagement: 18 },
  ],
}

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────
describe('GET /api/v1/analytics/summary', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()

    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    mockIsPremiumUser.mockResolvedValue(true)
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 9, resetTime: Date.now() + 60000 })
    mockFetchAnalyticsSummary.mockResolvedValue(MOCK_SUMMARY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ── 正常系 ──

  it('プレミアムユーザーが days=30 で 200 と summary を返す', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.period).toBeDefined()
    expect(body.posts).toBeDefined()
    expect(body.followers).toBeDefined()
    expect(body.engagementTrend).toBeDefined()
  })

  it('days=7 で 200 を返す', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=7')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockFetchAnalyticsSummary).toHaveBeenCalledWith(USER_ID, 7)
  })

  it('days=90 で 200 を返す', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=90')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockFetchAnalyticsSummary).toHaveBeenCalledWith(USER_ID, 90)
  })

  it('days 省略時はデフォルト 30 で fetchAnalyticsSummary が呼ばれる', async () => {
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockFetchAnalyticsSummary).toHaveBeenCalledWith(USER_ID, 30)
  })

  it('レスポンスが period/posts/followers/engagementTrend を持つ', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.period.days).toBe(30)
    expect(typeof body.period.start).toBe('string')
    expect(typeof body.period.end).toBe('string')
    expect(typeof body.posts.total).toBe('number')
    expect(typeof body.posts.totalLikes).toBe('number')
    expect(typeof body.posts.totalComments).toBe('number')
    expect(typeof body.posts.avgEngagement).toBe('number')
    expect(Array.isArray(body.posts.topPosts)).toBe(true)
    expect(typeof body.followers.current).toBe('number')
    expect(typeof body.followers.newInPeriod).toBe('number')
    expect(Array.isArray(body.followers.growth)).toBe(true)
    expect(Array.isArray(body.engagementTrend)).toBe(true)
  })

  it('topPosts の createdAt が ISO 文字列', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    const body = await res.json()
    const topPost = body.posts.topPosts[0]
    expect(typeof topPost.createdAt).toBe('string')
    expect(topPost.createdAt).toContain('T')
  })

  it('fetchAnalyticsSummary が 1 回だけ呼ばれる', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    await GET(req)

    expect(mockFetchAnalyticsSummary).toHaveBeenCalledOnce()
  })

  // ── 認証エラー ──

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/analytics/summary?days=30', {
      method: 'GET',
    })
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/analytics/summary?days=30', {
      method: 'GET',
      headers: { authorization: 'Bearer invalid.token.here' },
    })
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: USER_ID, isSuspended: true, email: 'user@example.com' })
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  // ── ゲスト拒否 ──

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-id')
    const req = new NextRequest('http://localhost/api/v1/analytics/summary?days=30', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  // ── プレミアム判定 ──

  it('非プレミアムユーザーで 403 PREMIUM_REQUIRED', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(false)
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('PREMIUM_REQUIRED')
  })

  it('プレミアムユーザーは PREMIUM_REQUIRED にならない', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(true)
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockFetchAnalyticsSummary).toHaveBeenCalledOnce()
  })

  it('非プレミアム時は fetchAnalyticsSummary が呼ばれない', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(false)
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    await GET(req)

    expect(mockFetchAnalyticsSummary).not.toHaveBeenCalled()
  })

  // ── days バリデーション ──

  it('days=1（不正値）で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=1')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('days=100（不正値）で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=100')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('days=abc（文字列）で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=abc')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('days=0 で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=0')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('days=-7 で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=-7')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  // ── レート制限 ──

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('レート制限超過時は fetchAnalyticsSummary が呼ばれない', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    await GET(req)

    expect(mockFetchAnalyticsSummary).not.toHaveBeenCalled()
  })

  // ── エラーレスポンス形式 ──

  it('エラーレスポンスは { error: { code, message, status } } 形式', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(false)
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  it('エラーレスポンスの status フィールドが HTTP ステータスコードと一致する', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(false)
    const req = await makeBearerRequest(USER_ID, 'days=30')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error.status).toBe(403)
    expect(res.status).toBe(403)
  })

  // ── レート制限の順序検証（Zod 通過後にレート制限） ──

  it('不正な days でレート制限を消費しない（Zod エラー優先）', async () => {
    const req = await makeBearerRequest(USER_ID, 'days=999')
    const { GET } = await import('@/app/api/v1/analytics/summary/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    // Zod でエラーになるため checkUserRateLimit は呼ばれない
    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })
})
