// @vitest-environment node
/**
 * GET /api/v1/users/[id]/following のユニットテスト
 *
 * requireBearerUser（ゲスト可・公開のみ）、reason に応じた 404/403、
 * UserConnectionsListResponse 形状（isFollowedBy 含む）、
 * カーソル/limit の伝播、全エラー分岐を検証する。
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

const mockFetchUserFollowing = vi.fn()
vi.mock('@/lib/services/user-connections-service', () => ({
  fetchUserFollowing: (...args: unknown[]) => mockFetchUserFollowing(...args),
}))

const mockResolveFollowStates = vi.fn()
const mockResolveIsFollowedByStates = vi.fn()
const mockResolveIsPublicMap = vi.fn()
vi.mock('@/lib/api/v1/follow-state-resolver', () => ({
  resolveFollowStates: (...args: unknown[]) => mockResolveFollowStates(...args),
  resolveIsFollowedByStates: (...args: unknown[]) => mockResolveIsFollowedByStates(...args),
  resolveIsPublicMap: (...args: unknown[]) => mockResolveIsPublicMap(...args),
}))

const TARGET_USER_ID = 'user-target'
const VIEWER_ID = 'viewer-1'
const FOLLOWING_ID = 'following-1'

const mockConnectionItem = {
  id: FOLLOWING_ID,
  nickname: 'フォロー中1',
  avatarUrl: null,
  bio: null,
  followersCount: 3,
  followingCount: 5,
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
    `http://localhost/api/v1/users/${targetId}/following${query ? `?${query}` : ''}`,
    { headers: { authorization: `Bearer ${token}` } },
  )
  return [req, { params: Promise.resolve({ id: targetId }) }]
}

describe('GET /api/v1/users/[id]/following', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 })
    mockFetchUserFollowing.mockResolvedValue({ ok: true, items: [mockConnectionItem], nextCursor: undefined })
    mockResolveFollowStates.mockResolvedValue(new Map([[FOLLOWING_ID, { following: true, requested: false }]]))
    mockResolveIsFollowedByStates.mockResolvedValue(new Map([[FOLLOWING_ID, false]]))
    mockResolveIsPublicMap.mockResolvedValue(new Map([[FOLLOWING_ID, true]]))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンと公開アカウントで 200 と { items, nextCursor } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(1)
  })

  it('items[].isFollowedBy が resolveIsFollowedByStates の結果から付与される（相互フォロー検証）', async () => {
    mockResolveIsFollowedByStates.mockResolvedValueOnce(new Map([[FOLLOWING_ID, true]]))
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.items[0].isFollowedBy).toBe(true)
  })

  it('following=true(自分がフォロー中) かつ isFollowedBy=false（相手はフォローバックしていない）の非対称ケース', async () => {
    mockResolveFollowStates.mockResolvedValueOnce(
      new Map([[FOLLOWING_ID, { following: true, requested: false }]]),
    )
    mockResolveIsFollowedByStates.mockResolvedValueOnce(new Map([[FOLLOWING_ID, false]]))
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.items[0].following).toBe(true)
    expect(body.items[0].isFollowedBy).toBe(false)
  })

  it('items[].isPublic が resolveIsPublicMap の結果から付与される', async () => {
    mockResolveIsPublicMap.mockResolvedValueOnce(new Map([[FOLLOWING_ID, false]]))
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.items[0].isPublic).toBe(false)
  })

  it('items が空のとき state 解決 API を呼ばずに { items: [], nextCursor: null } を返す', async () => {
    mockFetchUserFollowing.mockResolvedValueOnce({ ok: true, items: [], nextCursor: undefined })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
    expect(body.nextCursor).toBeNull()
    expect(mockResolveFollowStates).not.toHaveBeenCalled()
  })

  it('nextCursor が存在するとき文字列で返す', async () => {
    mockFetchUserFollowing.mockResolvedValueOnce({
      ok: true,
      items: [mockConnectionItem],
      nextCursor: FOLLOWING_ID,
    })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.nextCursor).toBe(FOLLOWING_ID)
  })

  it('ゲストユーザーでも公開アカウントのフォロー中一覧を 200 で取得できる', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
  })

  it('非公開アカウントかつ未フォローで reason: private_account → 403', async () => {
    mockFetchUserFollowing.mockResolvedValueOnce({ ok: false, reason: 'private_account' })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    const res = await GET(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('対象ユーザーが見つからない場合 reason: not_found → 404', async () => {
    mockFetchUserFollowing.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    const res = await GET(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('fetchUserFollowing に targetUserId, viewerId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', 'user-other')
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    await GET(req, params)

    expect(mockFetchUserFollowing).toHaveBeenCalledWith('user-other', VIEWER_ID, undefined, undefined)
  })

  it('cursor / limit クエリパラメータが fetchUserFollowing に渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(
      VIEWER_ID,
      'viewer@example.com',
      TARGET_USER_ID,
      'cursor=following-abc&limit=5',
    )
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    await GET(req, params)

    expect(mockFetchUserFollowing).toHaveBeenCalledWith(TARGET_USER_ID, VIEWER_ID, 'following-abc', 5)
  })

  it('不正な limit（文字列 "abc"）で 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', TARGET_USER_ID, 'limit=abc')
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    const res = await GET(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/following`)
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    const res = await GET(req, { params: Promise.resolve({ id: TARGET_USER_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/following`, {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    const res = await GET(req, { params: Promise.resolve({ id: TARGET_USER_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/following`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
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
    const { GET } = await import('@/app/api/v1/users/[id]/following/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
