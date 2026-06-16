// @vitest-environment node
/**
 * GET /api/v1/feed のユニットテスト
 *
 * 200 / 401 / 429 / カーソルページング / ゲスト判定 の全分岐を検証する。
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

const mockFetchTimeline = vi.fn()
vi.mock('@/lib/services/feed-service', () => ({
  fetchTimeline: (...args: unknown[]) => mockFetchTimeline(...args),
}))

async function makeAuthenticatedRequest(
  userId: string,
  searchParams?: Record<string, string>,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const url = new URL('http://localhost/api/v1/feed')
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v)
    }
  }
  return new NextRequest(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  })
}

const AUTHOR_ID = 'author-user-1'

const mockTimelineResult = {
  posts: [{ id: 'post-1', content: 'hello', user: { id: AUTHOR_ID, nickname: 'AuthorA', avatarUrl: null } }],
  nextCursor: undefined,
  isGuest: false,
}

describe('GET /api/v1/feed', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', isSuspended: false, email: 'u@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 })
    mockFetchTimeline.mockResolvedValue(mockTimelineResult)
    mockBlockFindMany.mockResolvedValue([])
    mockMuteFindMany.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンで 200 と { items, nextCursor, isGuest } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.nextCursor).toBeNull()
    expect(body.isGuest).toBe(false)
  })

  it('fetchTimeline に nextCursor がある場合レスポンスに含まれる', async () => {
    mockFetchTimeline.mockResolvedValueOnce({
      posts: [{ id: 'post-a' }, { id: 'post-b' }],
      nextCursor: 'post-b',
      isGuest: false,
    })
    const req = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nextCursor).toBe('post-b')
    expect(body.items).toHaveLength(2)
  })

  it('cursor クエリパラメータが fetchTimeline に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', { cursor: 'post-cursor-abc' })
    const { GET } = await import('@/app/api/v1/feed/route')
    await GET(req)

    expect(mockFetchTimeline).toHaveBeenCalledWith(
      'user-1',
      'post-cursor-abc',
      undefined,
    )
  })

  it('limit クエリパラメータが fetchTimeline に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', { limit: '10' })
    const { GET } = await import('@/app/api/v1/feed/route')
    await GET(req)

    expect(mockFetchTimeline).toHaveBeenCalledWith('user-1', undefined, 10)
  })

  it('limit が MAX_PAGE_LIMIT(100) を超えると 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', { limit: '101' })
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('limit が 0 のとき 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', { limit: '0' })
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('ゲストユーザーで isGuest:true を返す', async () => {
    mockFetchTimeline.mockResolvedValueOnce({
      posts: [],
      nextCursor: undefined,
      isGuest: true,
    })
    const req = await makeAuthenticatedRequest('guest-user-id')
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isGuest).toBe(true)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/feed')
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/feed', {
      headers: { authorization: 'Bearer bad.token.value' },
    })
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: true, email: 'u@example.com' })
    const req = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    })
    const req = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
    expect(body.error.status).toBe(429)
  })

  it('エラーレスポンス形式が { error: { code, message, status } } であること', async () => {
    const req = new NextRequest('http://localhost/api/v1/feed')
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})

describe('GET /api/v1/feed — isBlocked/isMuted フィールド', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', isSuspended: false, email: 'u@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 })
    mockBlockFindMany.mockResolvedValue([])
    mockMuteFindMany.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('未ブロック・未ミュート時は items[].user に isBlocked:false / isMuted:false が付く', async () => {
    mockFetchTimeline.mockResolvedValueOnce({
      posts: [{ id: 'p1', content: 'hi', user: { id: AUTHOR_ID, nickname: 'A', avatarUrl: null } }],
      nextCursor: undefined,
      isGuest: false,
    })
    const req = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0].user.isBlocked).toBe(false)
    expect(body.items[0].user.isMuted).toBe(false)
  })

  it('著者 id が block テーブルにある場合 user.isBlocked:true になる', async () => {
    mockFetchTimeline.mockResolvedValueOnce({
      posts: [{ id: 'p1', content: 'hi', user: { id: AUTHOR_ID, nickname: 'A', avatarUrl: null } }],
      nextCursor: undefined,
      isGuest: false,
    })
    mockBlockFindMany.mockResolvedValueOnce([{ blockedId: AUTHOR_ID }])
    const req = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0].user.isBlocked).toBe(true)
    expect(body.items[0].user.isMuted).toBe(false)
  })

  it('著者 id が mute テーブルにある場合 user.isMuted:true になる', async () => {
    mockFetchTimeline.mockResolvedValueOnce({
      posts: [{ id: 'p1', content: 'hi', user: { id: AUTHOR_ID, nickname: 'A', avatarUrl: null } }],
      nextCursor: undefined,
      isGuest: false,
    })
    mockMuteFindMany.mockResolvedValueOnce([{ mutedId: AUTHOR_ID }])
    const req = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0].user.isBlocked).toBe(false)
    expect(body.items[0].user.isMuted).toBe(true)
  })

  it('複数アイテム時に block.findMany / mute.findMany がそれぞれ 1 回だけ呼ばれる（N+1 防止）', async () => {
    const AUTHOR_ID_2 = 'author-user-2'
    mockFetchTimeline.mockResolvedValueOnce({
      posts: [
        { id: 'p1', content: 'post1', user: { id: AUTHOR_ID, nickname: 'A', avatarUrl: null } },
        { id: 'p2', content: 'post2', user: { id: AUTHOR_ID_2, nickname: 'B', avatarUrl: null } },
        { id: 'p3', content: 'post3', user: { id: AUTHOR_ID, nickname: 'A', avatarUrl: null } },
      ],
      nextCursor: undefined,
      isGuest: false,
    })
    const req = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/feed/route')
    await GET(req)

    expect(mockBlockFindMany).toHaveBeenCalledTimes(1)
    expect(mockMuteFindMany).toHaveBeenCalledTimes(1)
  })

  it('ゲストユーザーのリクエストで isBlocked/isMuted は false になる', async () => {
    mockFetchTimeline.mockResolvedValueOnce({
      posts: [{ id: 'p1', content: 'pub', user: { id: AUTHOR_ID, nickname: 'A', avatarUrl: null } }],
      nextCursor: undefined,
      isGuest: true,
    })
    const req = await makeAuthenticatedRequest('guest-user-id')
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0].user.isBlocked).toBe(false)
    expect(body.items[0].user.isMuted).toBe(false)
  })

  it('quotePost/repostPost のネスト著者には isBlocked/isMuted が付かない（トップレベルのみ）', async () => {
    const NESTED_AUTHOR_ID = 'nested-author-id'
    mockFetchTimeline.mockResolvedValueOnce({
      posts: [
        {
          id: 'p1',
          content: 'hi',
          user: { id: AUTHOR_ID, nickname: 'A', avatarUrl: null },
          quotePost: { id: 'q1', content: 'quoted', user: { id: NESTED_AUTHOR_ID, nickname: 'N', avatarUrl: null } },
          repostPost: null,
        },
      ],
      nextCursor: undefined,
      isGuest: false,
    })
    mockBlockFindMany.mockResolvedValueOnce([{ blockedId: NESTED_AUTHOR_ID }])
    const req = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/feed/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    const item = body.items[0]
    expect(item.user.isBlocked).toBe(false)
    expect(item.user.isMuted).toBe(false)
    expect(item.quotePost?.user?.isBlocked).toBeUndefined()
    expect(item.quotePost?.user?.isMuted).toBeUndefined()
  })
})
