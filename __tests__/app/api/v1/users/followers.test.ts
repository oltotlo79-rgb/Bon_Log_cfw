// @vitest-environment node
/**
 * GET /api/v1/users/[id]/followers のユニットテスト
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

const mockFetchUserFollowers = vi.fn()
vi.mock('@/lib/services/user-connections-service', () => ({
  fetchUserFollowers: (...args: unknown[]) => mockFetchUserFollowers(...args),
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
const FOLLOWER_ID = 'follower-1'

const mockConnectionItem = {
  id: FOLLOWER_ID,
  nickname: 'フォロワー1',
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
    `http://localhost/api/v1/users/${targetId}/followers${query ? `?${query}` : ''}`,
    { headers: { authorization: `Bearer ${token}` } },
  )
  return [req, { params: Promise.resolve({ id: targetId }) }]
}

describe('GET /api/v1/users/[id]/followers', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 })
    mockFetchUserFollowers.mockResolvedValue({ ok: true, items: [mockConnectionItem], nextCursor: undefined })
    mockResolveFollowStates.mockResolvedValue(new Map([[FOLLOWER_ID, { following: false, requested: false }]]))
    mockResolveIsFollowedByStates.mockResolvedValue(new Map([[FOLLOWER_ID, true]]))
    mockResolveIsPublicMap.mockResolvedValue(new Map([[FOLLOWER_ID, true]]))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンと公開アカウントで 200 と { items, nextCursor } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(1)
  })

  it('items[].isFollowedBy が resolveIsFollowedByStates の結果から付与される', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.items[0].isFollowedBy).toBe(true)
  })

  it('items[].following/requested が resolveFollowStates の結果から付与される', async () => {
    mockResolveFollowStates.mockResolvedValueOnce(
      new Map([[FOLLOWER_ID, { following: true, requested: false }]]),
    )
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.items[0].following).toBe(true)
    expect(body.items[0].requested).toBe(false)
  })

  it('items[].isPublic が resolveIsPublicMap の結果から付与される', async () => {
    mockResolveIsPublicMap.mockResolvedValueOnce(new Map([[FOLLOWER_ID, false]]))
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.items[0].isPublic).toBe(false)
  })

  it('items が空のとき state 解決 API を呼ばずに { items: [], nextCursor: null } を返す', async () => {
    mockFetchUserFollowers.mockResolvedValueOnce({ ok: true, items: [], nextCursor: undefined })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
    expect(body.nextCursor).toBeNull()
    expect(mockResolveFollowStates).not.toHaveBeenCalled()
  })

  it('nextCursor が存在するとき文字列で返す', async () => {
    mockFetchUserFollowers.mockResolvedValueOnce({
      ok: true,
      items: [mockConnectionItem],
      nextCursor: FOLLOWER_ID,
    })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.nextCursor).toBe(FOLLOWER_ID)
  })

  it('ゲストユーザーでも公開アカウントのフォロワー一覧を 200 で取得できる', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
  })

  it('非公開アカウントかつ未フォローで reason: private_account → 403', async () => {
    mockFetchUserFollowers.mockResolvedValueOnce({ ok: false, reason: 'private_account' })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    const res = await GET(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('対象ユーザーが見つからない場合 reason: not_found → 404', async () => {
    mockFetchUserFollowers.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    const res = await GET(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('fetchUserFollowers に targetUserId, viewerId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', 'user-other')
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    await GET(req, params)

    expect(mockFetchUserFollowers).toHaveBeenCalledWith('user-other', VIEWER_ID, undefined, undefined)
  })

  it('cursor / limit クエリパラメータが fetchUserFollowers に渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(
      VIEWER_ID,
      'viewer@example.com',
      TARGET_USER_ID,
      'cursor=follower-abc&limit=5',
    )
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    await GET(req, params)

    expect(mockFetchUserFollowers).toHaveBeenCalledWith(TARGET_USER_ID, VIEWER_ID, 'follower-abc', 5)
  })

  it('不正な limit（文字列 "abc"）で 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', TARGET_USER_ID, 'limit=abc')
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    const res = await GET(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/followers`)
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    const res = await GET(req, { params: Promise.resolve({ id: TARGET_USER_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/followers`, {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    const res = await GET(req, { params: Promise.resolve({ id: TARGET_USER_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/followers`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
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
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('複数 items の following/requested/isFollowedBy/isPublic が id ごとに個別解決される', async () => {
    const item2 = { ...mockConnectionItem, id: 'follower-2', nickname: 'フォロワー2' }
    mockFetchUserFollowers.mockResolvedValueOnce({
      ok: true,
      items: [mockConnectionItem, item2],
      nextCursor: undefined,
    })
    mockResolveFollowStates.mockResolvedValueOnce(
      new Map([
        [FOLLOWER_ID, { following: true, requested: false }],
        ['follower-2', { following: false, requested: true }],
      ]),
    )
    mockResolveIsFollowedByStates.mockResolvedValueOnce(
      new Map([
        [FOLLOWER_ID, true],
        ['follower-2', false],
      ]),
    )
    mockResolveIsPublicMap.mockResolvedValueOnce(
      new Map([
        [FOLLOWER_ID, true],
        ['follower-2', false],
      ]),
    )

    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/followers/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({ following: true, requested: false, isFollowedBy: true, isPublic: true })
    expect(body.items[1]).toMatchObject({ following: false, requested: true, isFollowedBy: false, isPublic: false })
  })
})
