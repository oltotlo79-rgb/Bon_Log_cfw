// @vitest-environment node
/**
 * GET /api/v1/users/[id]/posts のユニットテスト
 *
 * 200 / 401 / 403 / 404 / 429 の全分岐、カーソルページネーション、
 * block/mute 状態付与、公開/非公開アカウントの可視性制御を検証する。
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

const mockFetchUserPosts = vi.fn()
vi.mock('@/lib/services/user-posts-service', () => ({
  fetchUserPosts: (...args: unknown[]) => mockFetchUserPosts(...args),
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
  content: 'テスト投稿',
  userId: TARGET_USER_ID,
  createdAt: new Date().toISOString(),
  likeCount: 0,
  commentCount: 0,
  user: { id: TARGET_USER_ID, nickname: '盆栽太郎', avatarUrl: null },
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
    `http://localhost/api/v1/users/${targetId}/posts${query ? `?${query}` : ''}`,
    { headers: { authorization: `Bearer ${token}` } },
  )
  return [req, { params: Promise.resolve({ id: targetId }) }]
}

describe('GET /api/v1/users/[id]/posts', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchUserPosts.mockResolvedValue({ ok: true, posts: [mockPost], nextCursor: undefined })
    mockAttachMentionedUsers.mockResolvedValue([{ ...mockPost, mentionedUsers: [] }])
    mockResolveBlockMuteStates.mockResolvedValue(new Map())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンと公開アカウントで 200 と投稿一覧を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(1)
  })

  it('items[].bonsaiId がレスポンスに含まれる（post-include の formatPostForClient が spread する）', async () => {
    const postWithBonsai = { ...mockPost, bonsaiId: 'bonsai-1' }
    mockFetchUserPosts.mockResolvedValueOnce({ ok: true, posts: [postWithBonsai], nextCursor: undefined })
    mockAttachMentionedUsers.mockResolvedValueOnce([{ ...postWithBonsai, mentionedUsers: [] }])
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0]?.bonsaiId).toBe('bonsai-1')
  })

  it('nextCursor が null のとき null を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.nextCursor).toBeNull()
  })

  it('nextCursor が存在するとき文字列で返す（カーソルページネーション）', async () => {
    mockFetchUserPosts.mockResolvedValueOnce({ ok: true, posts: [mockPost], nextCursor: 'post-1' })
    mockAttachMentionedUsers.mockResolvedValueOnce([{ ...mockPost, mentionedUsers: [] }])
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.nextCursor).toBe('post-1')
  })

  it('ゲストユーザーでも公開アカウントの投稿を 200 で取得できる（rejectGuest なし）', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
  })

  it('非公開アカウントかつ未フォローで fetchUserPosts が private_account を返す → 403', async () => {
    mockFetchUserPosts.mockResolvedValueOnce({ ok: false, reason: 'private_account' })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    const res = await GET(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('対象ユーザーが見つからない場合 → 404 NOT_FOUND', async () => {
    mockFetchUserPosts.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    const res = await GET(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('fetchUserPosts に targetUserId と viewerId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', 'user-other')
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    await GET(req, params)

    expect(mockFetchUserPosts).toHaveBeenCalledWith('user-other', VIEWER_ID, undefined, undefined)
  })

  it('cursor クエリパラメータが fetchUserPosts に渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', TARGET_USER_ID, 'cursor=post-abc')
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    await GET(req, params)

    expect(mockFetchUserPosts).toHaveBeenCalledWith(TARGET_USER_ID, VIEWER_ID, 'post-abc', undefined)
  })

  it('limit クエリパラメータが fetchUserPosts に渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', TARGET_USER_ID, 'limit=5')
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    await GET(req, params)

    expect(mockFetchUserPosts).toHaveBeenCalledWith(TARGET_USER_ID, VIEWER_ID, undefined, 5)
  })

  it('不正な limit（文字列 "abc"）で 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com', TARGET_USER_ID, 'limit=abc')
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    const res = await GET(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/posts`)
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    const res = await GET(req, { params: Promise.resolve({ id: TARGET_USER_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/posts`, {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    const res = await GET(req, { params: Promise.resolve({ id: TARGET_USER_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/posts`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
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
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('resolveBlockMuteStates がヒットすると user に isBlocked/isMuted が付与される', async () => {
    const blockMuteMap = new Map([[TARGET_USER_ID, { isBlocked: true, isMuted: false }]])
    mockResolveBlockMuteStates.mockResolvedValueOnce(blockMuteMap)
    const [req, params] = await makeAuthenticatedRequest(VIEWER_ID, 'viewer@example.com')
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    const post = body.items[0]
    expect(post.user.isBlocked).toBe(true)
    expect(post.user.isMuted).toBe(false)
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    const req = new NextRequest(`http://localhost/api/v1/users/${TARGET_USER_ID}/posts`)
    const { GET } = await import('@/app/api/v1/users/[id]/posts/route')
    const res = await GET(req, { params: Promise.resolve({ id: TARGET_USER_ID }) })

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
