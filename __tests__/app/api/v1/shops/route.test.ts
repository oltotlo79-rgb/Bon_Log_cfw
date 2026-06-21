// @vitest-environment node
/**
 * GET  /api/v1/shops  — 盆栽園一覧取得（ゲスト可）
 * POST /api/v1/shops  — 盆栽園登録（認証必須・ゲスト不可）
 *
 * ゲスト可否・バリデーション・429・フィルタパラメータ・重複 409 を検証する。
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
// Mock: shop-service
// ──────────────────────────────────────────────────
const mockListShopsV1 = vi.fn()
const mockCreateShopV1 = vi.fn()

vi.mock('@/lib/services/shop-service', () => ({
  listShopsV1QuerySchema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, string | undefined>
      const sortBy = d?.['sortBy']
      const validSortBy = ['rating', 'name', 'newest', 'location']
      if (sortBy !== undefined && !validSortBy.includes(sortBy)) {
        return { success: false, error: { issues: [{ message: '不正な sortBy です' }] } }
      }
      const limit = d?.['limit'] !== undefined ? Number(d['limit']) : undefined
      if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
        return { success: false, error: { issues: [{ message: 'limit は1-100の範囲で指定してください' }] } }
      }
      return {
        success: true,
        data: {
          cursor: d?.['cursor'],
          limit,
          search: d?.['search'],
          genreId: d?.['genreId'],
          prefecture: d?.['prefecture'],
          sortBy: sortBy as 'rating' | 'name' | 'newest' | 'location' | undefined,
        },
      }
    },
  },
  createShopV1Schema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>
      if (!d?.['name'] || (d['name'] as string).trim().length < 1) {
        return { success: false, error: { issues: [{ message: '名称を入力してください' }] } }
      }
      if (!d?.['address'] || (d['address'] as string).trim().length < 1) {
        return { success: false, error: { issues: [{ message: '住所を入力してください' }] } }
      }
      const MAX_NAME = 100
      if ((d['name'] as string).length > MAX_NAME) {
        return { success: false, error: { issues: [{ message: '名称が長すぎます' }] } }
      }
      const MAX_ADDRESS = 300
      if ((d['address'] as string).length > MAX_ADDRESS) {
        return { success: false, error: { issues: [{ message: '住所が長すぎます' }] } }
      }
      return {
        success: true,
        data: {
          ...d,
          genreIds: (d['genreIds'] as string[]) ?? [],
        },
      }
    },
  },
  listShopsV1: (...args: unknown[]) => mockListShopsV1(...args),
  createShopV1: (...args: unknown[]) => mockCreateShopV1(...args),
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
const USER_ID = 'user-abc'
const OWNER_EMAIL = 'owner@example.com'
const SHOP_ID = 'shop-test-id'

const mockShopItem = {
  id: SHOP_ID,
  name: 'テスト盆栽園',
  address: '東京都渋谷区テスト1-1-1',
  latitude: 35.6895,
  longitude: 139.6917,
  phone: null,
  website: null,
  businessHours: null,
  closedDays: null,
  genres: [{ id: 'genre-1', name: '松柏類' }],
  averageRating: 4.2,
  reviewCount: 5,
  isOwner: false,
}

async function makeAuthenticatedGetRequest(userId: string, searchParams = ''): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  return new NextRequest(
    `http://localhost/api/v1/shops${searchParams ? `?${searchParams}` : ''}`,
    { headers: { authorization: `Bearer ${token}` } },
  )
}

async function makeAuthenticatedPostRequest(
  userId: string,
  body: unknown,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  return new NextRequest('http://localhost/api/v1/shops', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

const validCreateBody = {
  name: 'テスト盆栽園',
  address: '東京都渋谷区テスト1-1-1',
  genreIds: [],
}

// ──────────────────────────────────────────────────
// GET tests
// ──────────────────────────────────────────────────
describe('GET /api/v1/shops', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: OWNER_EMAIL })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListShopsV1.mockResolvedValue({ ok: true, items: [mockShopItem], nextCursor: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系（認証済み）: 200 + { items, nextCursor }', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
    expect(body.nextCursor).toBeNull()
  })

  it('ゲストトークン（guest@example.com）: 200 — 盆栽園一覧は公開エンドポイント', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const guestToken = await signAccessToken('guest-user')
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })

    const req = new NextRequest('http://localhost/api/v1/shops', {
      headers: { authorization: `Bearer ${guestToken}` },
    })
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('Bearer なし: 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/shops')
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('listShopsV1 がクエリパラメータを受け取る', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'search=%E6%9D%BE&sortBy=newest')
    const { GET } = await import('@/app/api/v1/shops/route')
    await GET(req)

    expect(mockListShopsV1).toHaveBeenCalledTimes(1)
    const callArg = mockListShopsV1.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArg?.search).toBe('松')
    expect(callArg?.sortBy).toBe('newest')
  })

  it('listShopsV1 に userId が渡される', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/shops/route')
    await GET(req)

    expect(mockListShopsV1).toHaveBeenCalledWith(expect.anything(), USER_ID)
  })

  it('prefecture フィルタ: listShopsV1 に prefecture が渡される', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'prefecture=%E6%9D%B1%E4%BA%AC%E9%83%BD')
    const { GET } = await import('@/app/api/v1/shops/route')
    await GET(req)

    const callArg = mockListShopsV1.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArg?.prefecture).toBe('東京都')
  })

  it('genreId フィルタ: listShopsV1 に genreId が渡される', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'genreId=genre-1')
    const { GET } = await import('@/app/api/v1/shops/route')
    await GET(req)

    const callArg = mockListShopsV1.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArg?.genreId).toBe('genre-1')
  })

  it('sortBy=rating: listShopsV1 に sortBy=rating が渡される', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'sortBy=rating')
    const { GET } = await import('@/app/api/v1/shops/route')
    await GET(req)

    const callArg = mockListShopsV1.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArg?.sortBy).toBe('rating')
  })

  it('不正な sortBy → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'sortBy=invalid_sort')
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な limit（0）→ 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'limit=0')
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な limit（101）→ 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'limit=101')
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedGetRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('listShopsV1 が失敗した場合 500 INTERNAL_ERROR', async () => {
    mockListShopsV1.mockResolvedValue({ ok: false, error: '取得失敗' })
    const req = await makeAuthenticatedGetRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('エラー形式は {error:{code,message,status}} になる', async () => {
    mockListShopsV1.mockResolvedValue({ ok: false, error: '取得失敗' })
    const req = await makeAuthenticatedGetRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})

// ──────────────────────────────────────────────────
// POST tests
// ──────────────────────────────────────────────────
describe('POST /api/v1/shops', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: OWNER_EMAIL })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockCreateShopV1.mockResolvedValue({ ok: true, shop: { id: SHOP_ID } })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 201 + { id }', async () => {
    const req = await makeAuthenticatedPostRequest(USER_ID, validCreateBody)
    const { POST } = await import('@/app/api/v1/shops/route')
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(SHOP_ID)
  })

  it('createShopV1 に userId が渡される', async () => {
    const req = await makeAuthenticatedPostRequest(USER_ID, validCreateBody)
    const { POST } = await import('@/app/api/v1/shops/route')
    await POST(req)

    expect(mockCreateShopV1).toHaveBeenCalledWith(expect.anything(), USER_ID)
  })

  it('Bearer なし → 401', async () => {
    const req = new NextRequest('http://localhost/api/v1/shops', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    const { POST } = await import('@/app/api/v1/shops/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const req = await makeAuthenticatedPostRequest('guest-user', validCreateBody)
    const { POST } = await import('@/app/api/v1/shops/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('name 空 → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPostRequest(USER_ID, {
      ...validCreateBody,
      name: '',
    })
    const { POST } = await import('@/app/api/v1/shops/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('name 超過（101 文字）→ 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPostRequest(USER_ID, {
      ...validCreateBody,
      name: 'a'.repeat(101),
    })
    const { POST } = await import('@/app/api/v1/shops/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('address 空 → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPostRequest(USER_ID, {
      ...validCreateBody,
      address: '',
    })
    const { POST } = await import('@/app/api/v1/shops/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('address 超過（301 文字）→ 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPostRequest(USER_ID, {
      ...validCreateBody,
      address: 'a'.repeat(301),
    })
    const { POST } = await import('@/app/api/v1/shops/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('重複住所（existingId あり）→ 409 CONFLICT', async () => {
    mockCreateShopV1.mockResolvedValue({
      ok: false,
      error: 'この住所の盆栽園は既に登録されています',
      existingId: 'existing-shop-id',
    })
    const req = await makeAuthenticatedPostRequest(USER_ID, validCreateBody)
    const { POST } = await import('@/app/api/v1/shops/route')
    const res = await POST(req)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
  })

  it('JSON パース失敗 → 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(USER_ID)
    const req = new NextRequest('http://localhost/api/v1/shops', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'invalid-json{',
    })
    const { POST } = await import('@/app/api/v1/shops/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedPostRequest(USER_ID, validCreateBody)
    const { POST } = await import('@/app/api/v1/shops/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('createShopV1 が existingId なしで失敗した場合 500 INTERNAL_ERROR', async () => {
    mockCreateShopV1.mockResolvedValue({ ok: false, error: '登録に失敗しました' })
    const req = await makeAuthenticatedPostRequest(USER_ID, validCreateBody)
    const { POST } = await import('@/app/api/v1/shops/route')
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
