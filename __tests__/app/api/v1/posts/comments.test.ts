// @vitest-environment node
/**
 * GET /api/v1/posts/[id]/comments のユニットテスト
 *
 * 200 カーソルページング / 401 / 429 の全分岐を検証する。
 * isBlocked / isMuted フィールドの付与も検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)

const mockUserFindUnique = vi.fn()
const mockBlockFindMany = vi.fn()
const mockMuteFindMany = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    block: {
      findMany: (...args: unknown[]) => mockBlockFindMany(...args),
    },
    mute: {
      findMany: (...args: unknown[]) => mockMuteFindMany(...args),
    },
    follow: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    followRequest: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

const mockFetchComments = vi.fn()
vi.mock('@/lib/services/comment-read-service', () => ({
  fetchComments: (...args: unknown[]) => mockFetchComments(...args),
}))

async function makeAuthenticatedRequest(
  userId: string,
  postId = 'post-abc',
  searchParams?: Record<string, string>,
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const url = new URL(`http://localhost/api/v1/posts/${postId}/comments`)
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v)
    }
  }
  const req = new NextRequest(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ id: postId }) }]
}

const COMMENTER_ID = 'commenter-user-1'

const mockCommentsResult = {
  comments: [
    { id: 'comment-1', content: 'nice post', userId: COMMENTER_ID, user: { id: COMMENTER_ID, nickname: 'Commenter', avatarUrl: null } },
  ],
  nextCursor: undefined,
}

describe('GET /api/v1/posts/[id]/comments', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', isSuspended: false, email: 'u@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchComments.mockResolvedValue(mockCommentsResult)
    mockBlockFindMany.mockResolvedValue([])
    mockMuteFindMany.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンで 200 と { items, nextCursor } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.nextCursor).toBeNull()
  })

  it('nextCursor がある場合レスポンスに含まれる', async () => {
    mockFetchComments.mockResolvedValueOnce({
      comments: [{ id: 'c1' }, { id: 'c2' }],
      nextCursor: 'c2',
    })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nextCursor).toBe('c2')
    expect(body.items).toHaveLength(2)
  })

  it('cursor と limit クエリパラメータが fetchComments に渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'post-xyz', {
      cursor: 'cursor-abc',
      limit: '5',
    })
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    await GET(req, params)

    expect(mockFetchComments).toHaveBeenCalledWith('post-xyz', 'user-1', 'cursor-abc', 5)
  })

  it('limit が MAX_PAGE_LIMIT(100) を超えると 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'post-abc', { limit: '200' })
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/posts/post-abc/comments')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, { params: Promise.resolve({ id: 'post-abc' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/posts/post-abc/comments', {
      headers: { authorization: 'Bearer bad.token' },
    })
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, { params: Promise.resolve({ id: 'post-abc' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: true, email: 'u@example.com' })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, params)

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
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})

describe('GET /api/v1/posts/[id]/comments — isBlocked/isMuted フィールド', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', isSuspended: false, email: 'u@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockBlockFindMany.mockResolvedValue([])
    mockMuteFindMany.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('未ブロック・未ミュート時は items[].user に isBlocked:false / isMuted:false が付く', async () => {
    mockFetchComments.mockResolvedValueOnce({
      comments: [{ id: 'c1', content: 'comment', userId: COMMENTER_ID, user: { id: COMMENTER_ID, nickname: 'C', avatarUrl: null } }],
      nextCursor: undefined,
    })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0].user.isBlocked).toBe(false)
    expect(body.items[0].user.isMuted).toBe(false)
  })

  it('コメント投稿者 id が block テーブルにある場合 user.isBlocked:true', async () => {
    mockFetchComments.mockResolvedValueOnce({
      comments: [{ id: 'c1', content: 'comment', userId: COMMENTER_ID, user: { id: COMMENTER_ID, nickname: 'C', avatarUrl: null } }],
      nextCursor: undefined,
    })
    mockBlockFindMany.mockResolvedValueOnce([{ blockedId: COMMENTER_ID }])
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0].user.isBlocked).toBe(true)
    expect(body.items[0].user.isMuted).toBe(false)
  })

  it('コメント投稿者 id が mute テーブルにある場合 user.isMuted:true', async () => {
    mockFetchComments.mockResolvedValueOnce({
      comments: [{ id: 'c1', content: 'comment', userId: COMMENTER_ID, user: { id: COMMENTER_ID, nickname: 'C', avatarUrl: null } }],
      nextCursor: undefined,
    })
    mockMuteFindMany.mockResolvedValueOnce([{ mutedId: COMMENTER_ID }])
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0].user.isBlocked).toBe(false)
    expect(body.items[0].user.isMuted).toBe(true)
  })

  it('複数コメント時に block.findMany / mute.findMany がそれぞれ 1 回だけ呼ばれる（N+1 防止）', async () => {
    const COMMENTER_ID_2 = 'commenter-user-2'
    mockFetchComments.mockResolvedValueOnce({
      comments: [
        { id: 'c1', content: 'c1', userId: COMMENTER_ID, user: { id: COMMENTER_ID, nickname: 'A', avatarUrl: null } },
        { id: 'c2', content: 'c2', userId: COMMENTER_ID_2, user: { id: COMMENTER_ID_2, nickname: 'B', avatarUrl: null } },
        { id: 'c3', content: 'c3', userId: COMMENTER_ID, user: { id: COMMENTER_ID, nickname: 'A', avatarUrl: null } },
      ],
      nextCursor: undefined,
    })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    await GET(req, params)

    expect(mockBlockFindMany).toHaveBeenCalledTimes(1)
    expect(mockMuteFindMany).toHaveBeenCalledTimes(1)
  })

  it('DB エラー時は fail-open で items[].user.isBlocked:false / isMuted:false になる', async () => {
    mockFetchComments.mockResolvedValueOnce({
      comments: [{ id: 'c1', content: 'comment', userId: COMMENTER_ID, user: { id: COMMENTER_ID, nickname: 'C', avatarUrl: null } }],
      nextCursor: undefined,
    })
    mockBlockFindMany.mockRejectedValueOnce(new Error('DB connection error'))
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/comments/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0].user.isBlocked).toBe(false)
    expect(body.items[0].user.isMuted).toBe(false)
  })
})
