// @vitest-environment node
/**
 * GET /api/v1/users/[id]/likes のユニットテスト
 *
 * fetchLikedPosts 経由の可視性（not_found/private_account 分岐）、
 * mentionedUsers/Block-Mute の付加、カーソル伝播、全エラー分岐を検証する。
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

const mockFetchLikedPosts = vi.fn()
vi.mock('@/lib/services/user-likes-service', () => ({
  fetchLikedPosts: (...args: unknown[]) => mockFetchLikedPosts(...args),
}))

const mockAttachMentionedUsers = vi.fn()
vi.mock('@/lib/api/v1/mention-resolver', () => ({
  attachMentionedUsers: (...args: unknown[]) => mockAttachMentionedUsers(...args),
}))

const mockResolveBlockMuteStates = vi.fn()
vi.mock('@/lib/api/v1/follow-state-resolver', () => ({
  resolveBlockMuteStates: (...args: unknown[]) => mockResolveBlockMuteStates(...args),
}))

const TARGET_USER_ID = 'user-target'
const VIEWER_ID = 'viewer-1'

const mockPost = {
  id: 'post-1',
  content: 'いいねした投稿',
  userId: TARGET_USER_ID,
  createdAt: new Date().toISOString(),
  likeCount: 3,
  commentCount: 0,
  user: { id: 'author-1', nickname: '投稿者', avatarUrl: null },
  genres: [],
  media: [],
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
    `http://localhost/api/v1/users/${targetId}/likes${query ? `?${query}` : ''}`,
    { headers: { authorization: `Bearer ${token}` } },
  )
  return [req, { params: Promise.resolve({ id: targetId }) }]
}

describe('GET /api/v1/users/[id]/likes', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 })
    mockFetchLikedPosts.mockResolvedValue({ ok: true, posts: [mockPost], nextCursor: undefined })
    mockAttachMentionedUsers.mockImplementation(async (posts: unknown[]) =>
      posts.map((p) => ({ ...(p as object), mentionedUsers: [] })),
    )
    mockResolveBlockMuteStates.mockResolvedValue(new Map())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンと公開アカウントで 200 といいねした投稿一覧を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(1)
  })

  it('nextCursor が null のとき null を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.nextCursor).toBeNull()
  })

  it('nextCursor が存在するとき文字列で返す（カーソル境界）', async () => {
    mockFetchLikedPosts.mockResolvedValueOnce({ ok: true, posts: [mockPost], nextCursor: 'like-99' })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.nextCursor).toBe('like-99')
  })

  it('ゲストユーザーでも公開アカウントのいいね一覧を 200 で取得できる（rejectGuest なし）', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
  })

  it('自分自身の非公開いいね一覧を自分で見る場合は 200', async () => {
    mockFetchLikedPosts.mockResolvedValueOnce({ ok: true, posts: [mockPost], nextCursor: undefined })
    const [req, params] = await makeAuthenticatedRequest(TARGET_USER_ID, 'self@example.com', TARGET_USER_ID)
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
  })

  it('他人から見た非公開アカウントで private_account → 403', async () => {
    mockFetchLikedPosts.mockResolvedValueOnce({ ok: false, reason: 'private_account' })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    const res = await GET(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('対象ユーザーが見つからない場合 → 404 NOT_FOUND', async () => {
    mockFetchLikedPosts.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    const res = await GET(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('fetchLikedPosts に targetUserId と viewerId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', 'user-other')
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    await GET(req, params)

    expect(mockFetchLikedPosts).toHaveBeenCalledWith('user-other', VIEWER_ID, undefined, undefined)
  })

  it('cursor / limit クエリパラメータが fetchLikedPosts に渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(
      VIEWER_ID,
      'viewer@example.com',
      TARGET_USER_ID,
      'cursor=like-abc&limit=5',
    )
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    await GET(req, params)

    expect(mockFetchLikedPosts).toHaveBeenCalledWith(TARGET_USER_ID, VIEWER_ID, 'like-abc', 5)
  })

  it('不正な limit（文字列 "abc"）で 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', TARGET_USER_ID, 'limit=abc')
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    const res = await GET(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/likes`)
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    const res = await GET(req, { params: Promise.resolve({ id: TARGET_USER_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/likes`, {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    const res = await GET(req, { params: Promise.resolve({ id: TARGET_USER_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/likes`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
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
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('resolveBlockMuteStates がヒットすると post.user に isBlocked/isMuted が付与される', async () => {
    const blockMuteMap = new Map([['author-1', { isBlocked: true, isMuted: false }]])
    mockResolveBlockMuteStates.mockResolvedValueOnce(blockMuteMap)
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    const post = body.items[0]
    expect(post.user.isBlocked).toBe(true)
    expect(post.user.isMuted).toBe(false)
  })

  it('mentionedUsers が投稿ごとに付加される', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.items[0]).toHaveProperty('mentionedUsers')
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/likes`)
    const { GET } = await import('@/app/api/v1/users/[id]/likes/route')
    const res = await GET(req, { params: Promise.resolve({ id: TARGET_USER_ID }) })

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
