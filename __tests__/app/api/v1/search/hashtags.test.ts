// @vitest-environment node
/**
 * GET /api/v1/search/hashtags のユニットテスト（C-2）
 *
 * ゲスト可・認証必須・レート制限・バリデーション・レスポンス形式を検証する。
 * レスポンスは { items: [{id, name, count}] } 形式。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const USER_ID = 'user-hashtag-search'

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

const mockSearchHashtags = vi.fn()
vi.mock('@/lib/actions/hashtag', () => ({
  searchHashtags: (...args: unknown[]) => mockSearchHashtags(...args),
  getTrendingHashtags: vi.fn(),
}))

async function makeBearerRequest(userId: string, searchParams = ''): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const url = `http://localhost/api/v1/search/hashtags${searchParams ? `?${searchParams}` : ''}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

const MOCK_HASHTAGS = [
  { id: 'ht-1', name: '黒松', count: 42, createdAt: new Date() },
  { id: 'ht-2', name: '盆栽', count: 30, createdAt: new Date() },
  { id: 'ht-3', name: '盆栽愛好家', count: 15, createdAt: new Date() },
]

describe('GET /api/v1/search/hashtags', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 19, resetTime: Date.now() + 60000 })
    mockSearchHashtags.mockResolvedValue(MOCK_HASHTAGS)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ── 正常系 ──

  it('有効なトークンと q パラメータで 200 を返す', async () => {
    const req = await makeBearerRequest(USER_ID, 'q=黒松')
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('レスポンスが { items: [...] } 形式', async () => {
    const req = await makeBearerRequest(USER_ID, 'q=黒松')
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    const res = await GET(req)
    const body = await res.json()

    expect(body).toHaveProperty('items')
    expect(Array.isArray(body.items)).toBe(true)
  })

  it('items[].id / name / count が含まれる', async () => {
    const req = await makeBearerRequest(USER_ID, 'q=黒松')
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    const res = await GET(req)
    const body = await res.json()
    const item = body.items[0]

    expect(item).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      count: expect.any(Number),
    })
  })

  it('items に createdAt など余計なフィールドが含まれない', async () => {
    const req = await makeBearerRequest(USER_ID, 'q=黒松')
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    const res = await GET(req)
    const body = await res.json()
    const item = body.items[0]

    expect(item).not.toHaveProperty('createdAt')
    expect(Object.keys(item).sort()).toEqual(['count', 'id', 'name'])
  })

  it('q 省略時は空文字で searchHashtags が呼ばれる', async () => {
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    await GET(req)

    const call = mockSearchHashtags.mock.calls[0]
    expect(call?.[0]).toBe('')
  })

  it('limit を渡すと searchHashtags に渡される', async () => {
    const req = await makeBearerRequest(USER_ID, 'q=松&limit=5')
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    await GET(req)

    const call = mockSearchHashtags.mock.calls[0]
    expect(call?.[1]).toBe(5)
  })

  it('limit 省略時は DEFAULT_HASHTAG_LIMIT で searchHashtags が呼ばれる', async () => {
    const req = await makeBearerRequest(USER_ID, 'q=松')
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    await GET(req)

    const call = mockSearchHashtags.mock.calls[0]
    expect(typeof call?.[1]).toBe('number')
    expect(call?.[1]).toBeGreaterThan(0)
  })

  it('searchHashtags が 1 回だけ呼ばれる', async () => {
    const req = await makeBearerRequest(USER_ID, 'q=松')
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    await GET(req)

    expect(mockSearchHashtags).toHaveBeenCalledOnce()
  })

  it('空の結果で items が空配列', async () => {
    mockSearchHashtags.mockResolvedValueOnce([])
    const req = await makeBearerRequest(USER_ID, 'q=存在しないタグ')
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.items).toEqual([])
  })

  // ── ゲスト許可（rejectGuest なし） ──

  it('ゲストアカウントでも 200 を返す（ゲスト可）', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-id')
    const req = new NextRequest('http://localhost/api/v1/search/hashtags?q=松', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: USER_ID, isSuspended: true, email: 'user@example.com' })
    const req = await makeBearerRequest(USER_ID, 'q=松')
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  // ── 認証エラー ──

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/search/hashtags?q=松', { method: 'GET' })
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/search/hashtags?q=松', {
      method: 'GET',
      headers: { authorization: 'Bearer invalid.token.here' },
    })
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  // ── バリデーション ──

  it('limit=0（下限未満）で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'q=松&limit=0')
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('limit 上限超過で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'q=松&limit=9999')
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  // ── レート制限 ──

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, 'q=松')
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('レート制限超過時は searchHashtags が呼ばれない', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, 'q=松')
    const { GET } = await import('@/app/api/v1/search/hashtags/route')
    await GET(req)

    expect(mockSearchHashtags).not.toHaveBeenCalled()
  })
})
