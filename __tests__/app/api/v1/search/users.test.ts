// @vitest-environment node
/**
 * GET /api/v1/search/users のユニットテスト
 *
 * 200 / q の Zod 検証 / 401 / 429 の全分岐および v1.4.0 で追加された
 * following / requested / isPublic フィールドとバッチクエリ（N+1 防止）を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)

const mockUserFindUnique = vi.fn()
const mockUserFindMany = vi.fn()
const mockFollowFindMany = vi.fn()
const mockFollowRequestFindMany = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
    follow: {
      findMany: (...args: unknown[]) => mockFollowFindMany(...args),
    },
    followRequest: {
      findMany: (...args: unknown[]) => mockFollowRequestFindMany(...args),
    },
  },
}))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

const mockFetchSearchUsers = vi.fn()
vi.mock('@/lib/services/search-service', () => ({
  fetchSearchPosts: vi.fn(),
  fetchSearchUsers: (...args: unknown[]) => mockFetchSearchUsers(...args),
}))

async function makeAuthenticatedRequest(
  userId: string,
  searchParams?: Record<string, string>,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const url = new URL('http://localhost/api/v1/search/users')
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v)
    }
  }
  return new NextRequest(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/search/users', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', isSuspended: false, email: 'u@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 19, resetTime: Date.now() + 60000 })
    mockFetchSearchUsers.mockResolvedValue({ users: [], nextCursor: undefined })
    // デフォルトはフォロー・リクエストなし（空配列）、isPublic 解決用 findMany も空
    mockFollowFindMany.mockResolvedValue([])
    mockFollowRequestFindMany.mockResolvedValue([])
    mockUserFindMany.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンと q パラメータで 200 と { items, nextCursor } を返す', async () => {
    mockFetchSearchUsers.mockResolvedValueOnce({
      users: [{ id: 'u1', nickname: '太郎' }],
      nextCursor: undefined,
    })
    mockUserFindMany.mockResolvedValueOnce([{ id: 'u1', isPublic: true }])
    const req = await makeAuthenticatedRequest('user-1', { q: '太郎' })
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.nextCursor).toBeNull()
  })

  it('q なしで 200 と結果を返す（空クエリは有効）', async () => {
    const req = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
  })

  it('nextCursor がある場合レスポンスに含まれる', async () => {
    mockFetchSearchUsers.mockResolvedValueOnce({
      users: [{ id: 'u1' }, { id: 'u2' }],
      nextCursor: 'u2',
    })
    mockUserFindMany.mockResolvedValueOnce([
      { id: 'u1', isPublic: true },
      { id: 'u2', isPublic: false },
    ])
    const req = await makeAuthenticatedRequest('user-1', { q: '花子' })
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nextCursor).toBe('u2')
    expect(body.items).toHaveLength(2)
  })

  it('q が MAX_SEARCH_QUERY_LENGTH(100) を超えると 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', { q: 'x'.repeat(101) })
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('q がちょうど 100 文字のとき 200 を返す（境界値）', async () => {
    const req = await makeAuthenticatedRequest('user-1', { q: 'b'.repeat(100) })
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('fetchSearchUsers に q, userId, cursor, limit が渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', { q: '花子', cursor: 'c456', limit: '3' })
    const { GET } = await import('@/app/api/v1/search/users/route')
    await GET(req)

    expect(mockFetchSearchUsers).toHaveBeenCalledWith('花子', 'user-1', 'c456', 3)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/search/users?q=test')
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/search/users?q=test', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: true, email: 'u@example.com' })
    const req = await makeAuthenticatedRequest('user-1', { q: '太郎' })
    const { GET } = await import('@/app/api/v1/search/users/route')
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
    const req = await makeAuthenticatedRequest('user-1', { q: '太郎' })
    const { GET } = await import('@/app/api/v1/search/users/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  // フォロー状態・isPublic フィールド検証（v1.4.0）
  describe('フォロー状態・isPublic フィールド', () => {
    it('items に following / requested / isPublic が含まれること', async () => {
      mockFetchSearchUsers.mockResolvedValueOnce({
        users: [{ id: 'u1', nickname: 'テスト太郎' }],
        nextCursor: undefined,
      })
      mockFollowFindMany.mockResolvedValueOnce([])
      mockFollowRequestFindMany.mockResolvedValueOnce([])
      mockUserFindMany.mockResolvedValueOnce([{ id: 'u1', isPublic: true }])

      const req = await makeAuthenticatedRequest('user-1', { q: 'テスト' })
      const { GET } = await import('@/app/api/v1/search/users/route')
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.items).toHaveLength(1)
      const item = body.items[0] as { following: boolean; requested: boolean; isPublic: boolean }
      expect(typeof item.following).toBe('boolean')
      expect(typeof item.requested).toBe('boolean')
      expect(typeof item.isPublic).toBe('boolean')
    })

    it('フォロー中・リクエスト中・未フォローが混在する場合に各 item の値が正しい', async () => {
      // u1: フォロー中, u2: リクエスト中, u3: 未フォロー
      mockFetchSearchUsers.mockResolvedValueOnce({
        users: [
          { id: 'u1', nickname: 'フォロー中' },
          { id: 'u2', nickname: 'リクエスト中' },
          { id: 'u3', nickname: '未フォロー' },
        ],
        nextCursor: undefined,
      })
      mockFollowFindMany.mockResolvedValueOnce([{ followingId: 'u1' }])
      mockFollowRequestFindMany.mockResolvedValueOnce([{ targetId: 'u2' }])
      mockUserFindMany.mockResolvedValueOnce([
        { id: 'u1', isPublic: true },
        { id: 'u2', isPublic: false },
        { id: 'u3', isPublic: true },
      ])

      const req = await makeAuthenticatedRequest('user-1', { q: '太郎' })
      const { GET } = await import('@/app/api/v1/search/users/route')
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      const items = body.items as Array<{ id: string; following: boolean; requested: boolean; isPublic: boolean }>
      expect(items).toHaveLength(3)

      const u1 = items.find((i) => i.id === 'u1')
      const u2 = items.find((i) => i.id === 'u2')
      const u3 = items.find((i) => i.id === 'u3')

      expect(u1?.following).toBe(true)
      expect(u1?.requested).toBe(false)
      expect(u1?.isPublic).toBe(true)

      expect(u2?.following).toBe(false)
      expect(u2?.requested).toBe(true)
      expect(u2?.isPublic).toBe(false)

      expect(u3?.following).toBe(false)
      expect(u3?.requested).toBe(false)
      expect(u3?.isPublic).toBe(true)
    })

    it('isPublic が resolveIsPublicMap（user.findMany）由来で正しく反映される', async () => {
      mockFetchSearchUsers.mockResolvedValueOnce({
        users: [
          { id: 'pub-1', nickname: '公開ユーザー' },
          { id: 'prv-1', nickname: '非公開ユーザー' },
        ],
        nextCursor: undefined,
      })
      mockFollowFindMany.mockResolvedValueOnce([])
      mockFollowRequestFindMany.mockResolvedValueOnce([])
      mockUserFindMany.mockResolvedValueOnce([
        { id: 'pub-1', isPublic: true },
        { id: 'prv-1', isPublic: false },
      ])

      const req = await makeAuthenticatedRequest('user-1', { q: 'ユーザー' })
      const { GET } = await import('@/app/api/v1/search/users/route')
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      const items = body.items as Array<{ id: string; isPublic: boolean }>

      const pub = items.find((i) => i.id === 'pub-1')
      const prv = items.find((i) => i.id === 'prv-1')
      expect(pub?.isPublic).toBe(true)
      expect(prv?.isPublic).toBe(false)
    })

    it('バッチ性（N+1 防止）: 複数 item 返却時に各 findMany が 1 回だけ呼ばれる', async () => {
      mockFetchSearchUsers.mockResolvedValueOnce({
        users: [
          { id: 'u1', nickname: 'A' },
          { id: 'u2', nickname: 'B' },
          { id: 'u3', nickname: 'C' },
        ],
        nextCursor: undefined,
      })
      mockFollowFindMany.mockResolvedValueOnce([{ followingId: 'u1' }])
      mockFollowRequestFindMany.mockResolvedValueOnce([{ targetId: 'u2' }])
      mockUserFindMany.mockResolvedValueOnce([
        { id: 'u1', isPublic: true },
        { id: 'u2', isPublic: false },
        { id: 'u3', isPublic: true },
      ])

      const req = await makeAuthenticatedRequest('user-1', { q: 'テスト' })
      const { GET } = await import('@/app/api/v1/search/users/route')
      const res = await GET(req)

      expect(res.status).toBe(200)
      // follow.findMany が N 回ではなく 1 回のみ呼ばれること（N+1 防止）
      expect(mockFollowFindMany).toHaveBeenCalledTimes(1)
      // followRequest.findMany が 1 回のみ呼ばれること
      expect(mockFollowRequestFindMany).toHaveBeenCalledTimes(1)
      // isPublic 解決用 user.findMany が 1 回のみ呼ばれること
      expect(mockUserFindMany).toHaveBeenCalledTimes(1)
    })
  })
})
