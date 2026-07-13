// @vitest-environment node
/**
 * GET /api/v1/genres?type=shop|post — ジャンル一覧取得（ゲスト可）
 *
 * ゲスト可否・type フィルタ分離・不正 type → 400 を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

// ──────────────────────────────────────────────────
// Mock: prisma（requireBearerUser → user.findUnique）
// ──────────────────────────────────────────────────
const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

// ──────────────────────────────────────────────────
// Mock: rate-limit
// ──────────────────────────────────────────────────
const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

// ──────────────────────────────────────────────────
// Mock: shop-service（listGenresV1QuerySchema + listGenresV1）
// ──────────────────────────────────────────────────
const mockListGenresV1 = vi.fn()

vi.mock('@/lib/services/shop-service', () => ({
  listGenresV1QuerySchema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, string | undefined>
      const type = d?.['type']
      if (type !== undefined && type !== 'shop' && type !== 'post') {
        return { success: false, error: { issues: [{ message: 'type は shop または post を指定してください' }] } }
      }
      return {
        success: true,
        data: { type: (type ?? 'shop') as 'shop' | 'post' },
      }
    },
  },
  listGenresV1: (...args: unknown[]) => mockListGenresV1(...args),
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
const USER_ID = 'user-abc'
const OWNER_EMAIL = 'owner@example.com'

const mockShopGenres = [
  { id: 'genre-1', name: '松柏類', category: '樹種' },
  { id: 'genre-2', name: '雑木類', category: '樹種' },
]

const mockPostGenres = [
  { id: 'genre-3', name: '施設・イベント', category: 'その他' },
]

async function makeAuthenticatedGetRequest(
  userId: string,
  searchParams = '',
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  return new NextRequest(
    `http://localhost/api/v1/genres${searchParams ? `?${searchParams}` : ''}`,
    { headers: { authorization: `Bearer ${token}` } },
  )
}

// ──────────────────────────────────────────────────
// GET /api/v1/genres
// ──────────────────────────────────────────────────
describe('GET /api/v1/genres', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: OWNER_EMAIL })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListGenresV1.mockResolvedValue({ ok: true, items: mockShopGenres })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系（type=shop）: 200 + { items: [{id, name, category}] }', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'type=shop')
    const { GET } = await import('@/app/api/v1/genres/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(2)
    expect(body.items[0]).toMatchObject({ id: 'genre-1', name: '松柏類', category: '樹種' })
  })

  it('正常系（type=post）: items[].category が文字列で返る', async () => {
    mockListGenresV1.mockResolvedValue({ ok: true, items: mockPostGenres })
    const req = await makeAuthenticatedGetRequest(USER_ID, 'type=post')
    const { GET } = await import('@/app/api/v1/genres/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.items[0]?.category).toBe('string')
  })

  it('type=post: listGenresV1 に type="post" が渡される', async () => {
    mockListGenresV1.mockResolvedValue({ ok: true, items: mockPostGenres })
    const req = await makeAuthenticatedGetRequest(USER_ID, 'type=post')
    const { GET } = await import('@/app/api/v1/genres/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0]?.name).toBe('施設・イベント')

    const callArg = mockListGenresV1.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArg?.type).toBe('post')
  })

  it('type=shop と type=post は異なるジャンルセットを返す（分離確認）', async () => {
    const { GET } = await import('@/app/api/v1/genres/route')

    mockListGenresV1.mockResolvedValue({ ok: true, items: mockShopGenres })
    const reqShop = await makeAuthenticatedGetRequest(USER_ID, 'type=shop')
    const resShop = await GET(reqShop)
    const bodyShop = await resShop.json()

    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: OWNER_EMAIL })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 58, resetTime: Date.now() + 60000 })
    mockListGenresV1.mockResolvedValue({ ok: true, items: mockPostGenres })
    const reqPost = await makeAuthenticatedGetRequest(USER_ID, 'type=post')
    const resPost = await GET(reqPost)
    const bodyPost = await resPost.json()

    expect(bodyShop.items[0]?.id).not.toBe(bodyPost.items[0]?.id)
  })

  it('type 省略（デフォルト shop）: 200', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/genres/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const callArg = mockListGenresV1.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArg?.type).toBe('shop')
  })

  it('ゲストトークンでもアクセス可（ジャンル一覧は公開）', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const guestToken = await signAccessToken('guest-user')
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })

    const req = new NextRequest('http://localhost/api/v1/genres?type=shop', {
      headers: { authorization: `Bearer ${guestToken}` },
    })
    const { GET } = await import('@/app/api/v1/genres/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('Bearer なし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/genres?type=shop')
    const { GET } = await import('@/app/api/v1/genres/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正な type（type=event）→ 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'type=event')
    const { GET } = await import('@/app/api/v1/genres/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な type（type=invalid）→ 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'type=invalid')
    const { GET } = await import('@/app/api/v1/genres/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('エラー形式は {error:{code,message,status}} になる', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'type=bad_type')
    const { GET } = await import('@/app/api/v1/genres/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedGetRequest(USER_ID, 'type=shop')
    const { GET } = await import('@/app/api/v1/genres/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('listGenresV1 が失敗した場合 500 INTERNAL_ERROR', async () => {
    mockListGenresV1.mockResolvedValue({ ok: false, error: '取得失敗' })
    const req = await makeAuthenticatedGetRequest(USER_ID, 'type=shop')
    const { GET } = await import('@/app/api/v1/genres/route')
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('空ジャンルリスト: items が []', async () => {
    mockListGenresV1.mockResolvedValue({ ok: true, items: [] })
    const req = await makeAuthenticatedGetRequest(USER_ID, 'type=shop')
    const { GET } = await import('@/app/api/v1/genres/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })
})
