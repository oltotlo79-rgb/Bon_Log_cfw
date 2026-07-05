// @vitest-environment node
/**
 * GET /api/v1/comments/[id]/replies のユニットテスト
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

const mockFetchReplies = vi.fn()
vi.mock('@/lib/services/comment-read-service', () => ({
  fetchReplies: (...args: unknown[]) => mockFetchReplies(...args),
}))

async function makeAuthenticatedRequest(
  userId: string,
  commentId = 'comment-abc',
  searchParams?: Record<string, string>,
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const url = new URL(`http://localhost/api/v1/comments/${commentId}/replies`)
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v)
    }
  }
  const req = new NextRequest(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ id: commentId }) }]
}

const REPLIER_ID = 'replier-user-1'

const mockRepliesResult = {
  comments: [
    { id: 'reply-1', content: 'nice reply', userId: REPLIER_ID, user: { id: REPLIER_ID, nickname: 'Replier', avatarUrl: null } },
  ],
  nextCursor: undefined,
}

describe('GET /api/v1/comments/[id]/replies', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', isSuspended: false, email: 'u@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchReplies.mockResolvedValue(mockRepliesResult)
    mockBlockFindMany.mockResolvedValue([])
    mockMuteFindMany.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンで 200 と { items, nextCursor } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/comments/[id]/replies/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.nextCursor).toBeNull()
  })

  it('親コメントが不存在/非表示/削除済み/閲覧不可の場合は空リストを返す', async () => {
    mockFetchReplies.mockResolvedValueOnce({ comments: [], nextCursor: undefined })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/comments/[id]/replies/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
    expect(body.nextCursor).toBeNull()
  })

  it('nextCursor がある場合レスポンスに含まれる', async () => {
    mockFetchReplies.mockResolvedValueOnce({
      comments: [{ id: 'r1' }, { id: 'r2' }],
      nextCursor: 'r2',
    })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/comments/[id]/replies/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nextCursor).toBe('r2')
    expect(body.items).toHaveLength(2)
  })

  it('cursor と limit クエリパラメータが fetchReplies に渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'comment-xyz', {
      cursor: 'cursor-abc',
      limit: '5',
    })
    const { GET } = await import('@/app/api/v1/comments/[id]/replies/route')
    await GET(req, params)

    expect(mockFetchReplies).toHaveBeenCalledWith('comment-xyz', 'user-1', 'cursor-abc', 5)
  })

  it('limit が MAX_PAGE_LIMIT(100) を超えると 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'comment-abc', { limit: '200' })
    const { GET } = await import('@/app/api/v1/comments/[id]/replies/route')
    const res = await GET(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/comments/comment-abc/replies')
    const { GET } = await import('@/app/api/v1/comments/[id]/replies/route')
    const res = await GET(req, { params: Promise.resolve({ id: 'comment-abc' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/comments/comment-abc/replies', {
      headers: { authorization: 'Bearer bad.token' },
    })
    const { GET } = await import('@/app/api/v1/comments/[id]/replies/route')
    const res = await GET(req, { params: Promise.resolve({ id: 'comment-abc' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: true, email: 'u@example.com' })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/comments/[id]/replies/route')
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
    const { GET } = await import('@/app/api/v1/comments/[id]/replies/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})

describe('GET /api/v1/comments/[id]/replies — isBlocked/isMuted フィールド', () => {
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
    mockFetchReplies.mockResolvedValueOnce({
      comments: [{ id: 'r1', content: 'reply', userId: REPLIER_ID, user: { id: REPLIER_ID, nickname: 'R', avatarUrl: null } }],
      nextCursor: undefined,
    })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/comments/[id]/replies/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0].user.isBlocked).toBe(false)
    expect(body.items[0].user.isMuted).toBe(false)
  })

  it('返信投稿者 id が block テーブルにある場合 user.isBlocked:true', async () => {
    mockFetchReplies.mockResolvedValueOnce({
      comments: [{ id: 'r1', content: 'reply', userId: REPLIER_ID, user: { id: REPLIER_ID, nickname: 'R', avatarUrl: null } }],
      nextCursor: undefined,
    })
    mockBlockFindMany.mockResolvedValueOnce([{ blockedId: REPLIER_ID }])
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/comments/[id]/replies/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0].user.isBlocked).toBe(true)
    expect(body.items[0].user.isMuted).toBe(false)
  })

  it('返信投稿者 id が mute テーブルにある場合 user.isMuted:true', async () => {
    mockFetchReplies.mockResolvedValueOnce({
      comments: [{ id: 'r1', content: 'reply', userId: REPLIER_ID, user: { id: REPLIER_ID, nickname: 'R', avatarUrl: null } }],
      nextCursor: undefined,
    })
    mockMuteFindMany.mockResolvedValueOnce([{ mutedId: REPLIER_ID }])
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/comments/[id]/replies/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0].user.isBlocked).toBe(false)
    expect(body.items[0].user.isMuted).toBe(true)
  })
})
