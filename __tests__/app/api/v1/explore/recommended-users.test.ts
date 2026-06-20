// @vitest-environment node
/**
 * GET /api/v1/explore/recommended-users — おすすめユーザー一覧
 *
 * 200 / 401 / 429 の全分岐・ゲスト空配列・フォロー状態・isPublic 付与を検証する。
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

const mockFetchRecommendedUsers = vi.fn()
vi.mock('@/lib/services/explore-service', () => ({
  fetchRecommendedUsers: (...args: unknown[]) => mockFetchRecommendedUsers(...args),
}))

const mockResolveFollowStates = vi.fn()
const mockResolveIsPublicMap = vi.fn()
vi.mock('@/lib/api/v1/follow-state-resolver', () => ({
  resolveFollowStates: (...args: unknown[]) => mockResolveFollowStates(...args),
  resolveIsPublicMap: (...args: unknown[]) => mockResolveIsPublicMap(...args),
}))

const mockRecommendedUsers = [
  { id: 'u1', nickname: 'ユーザー1', avatarUrl: '/a.jpg', bio: '盆栽好き', followersCount: 100 },
  { id: 'u2', nickname: 'ユーザー2', avatarUrl: null, bio: null, followersCount: 50 },
]

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  searchParams = '',
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const url = `http://localhost/api/v1/explore/recommended-users${searchParams ? `?${searchParams}` : ''}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/explore/recommended-users', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchRecommendedUsers.mockResolvedValue(mockRecommendedUsers)
    mockResolveFollowStates.mockResolvedValue(new Map([
      ['u1', { following: false, requested: false }],
      ['u2', { following: true, requested: false }],
    ]))
    mockResolveIsPublicMap.mockResolvedValue(new Map([
      ['u1', true],
      ['u2', false],
    ]))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 { items } を返す', async () => {
    // ゲスト判定: user findUnique が 2 回呼ばれる（requst auth + ゲスト判定）
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: false, email: 'user@example.com' })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
  })

  it('items に { id, nickname, avatarUrl, bio, followersCount, following, requested, isPublic } が含まれる', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: false, email: 'user@example.com' })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items[0]).toMatchObject({
      id: expect.any(String),
      nickname: expect.any(String),
      followersCount: expect.any(Number),
      following: expect.any(Boolean),
      requested: expect.any(Boolean),
      isPublic: expect.any(Boolean),
    })
  })

  it('フォロー状態（following/requested）が viewer のフォロー関係から付与される', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: false, email: 'user@example.com' })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    const res = await GET(req)

    const body = await res.json()
    const u2 = body.items.find((i: { id: string }) => i.id === 'u2')
    expect(u2?.following).toBe(true)
    expect(u2?.requested).toBe(false)
  })

  it('isPublic が resolveIsPublicMap の結果から付与される', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: false, email: 'user@example.com' })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    const res = await GET(req)

    const body = await res.json()
    const u1 = body.items.find((i: { id: string }) => i.id === 'u1')
    const u2 = body.items.find((i: { id: string }) => i.id === 'u2')
    expect(u1?.isPublic).toBe(true)
    expect(u2?.isPublic).toBe(false)
  })

  it('ゲストユーザーは空配列を返す（フォロー状態が計算できないため）', async () => {
    // ゲスト: rejectGuest なし → 通過するが空配列
    mockUserFindUnique.mockResolvedValueOnce({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(0)
  })

  it('ゲストのとき fetchRecommendedUsers を呼ばない', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    await GET(req)

    expect(mockFetchRecommendedUsers).not.toHaveBeenCalled()
  })

  it('users が空のとき items: [] を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: false, email: 'user@example.com' })
    mockFetchRecommendedUsers.mockResolvedValueOnce([])
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(0)
  })

  it('limit クエリパラメータが fetchRecommendedUsers に渡される', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: false, email: 'user@example.com' })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'limit=5')
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    await GET(req)

    expect(mockFetchRecommendedUsers).toHaveBeenCalledWith('user-1', 5)
  })

  it('limit=0 は 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'limit=0')
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('limit=101 は 400 VALIDATION_ERROR（上限 100 を超える）', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'limit=101')
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/explore/recommended-users')
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/explore/recommended-users', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/explore/recommended-users', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
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
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } } であること', async () => {
    const req = new NextRequest('http://localhost/api/v1/explore/recommended-users')
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  it('N+1 防止: resolveFollowStates と resolveIsPublicMap が各 1 回呼ばれる', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: false, email: 'user@example.com' })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    await GET(req)

    expect(mockResolveFollowStates).toHaveBeenCalledTimes(1)
    expect(mockResolveIsPublicMap).toHaveBeenCalledTimes(1)
  })

  it('resolveFollowStates に viewer userId と全ターゲット ID が渡される', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: false, email: 'user@example.com' })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/explore/recommended-users/route')
    await GET(req)

    const [viewerId, targetIds] = mockResolveFollowStates.mock.calls[0] as [string, string[]]
    expect(viewerId).toBe('user-1')
    expect(targetIds).toContain('u1')
    expect(targetIds).toContain('u2')
  })
})
