// @vitest-environment node
/**
 * GET   /api/v1/shops/{id}  — 盆栽園詳細取得（ゲスト可）
 * PATCH /api/v1/shops/{id}  — 盆栽園編集（作成者または admin・認証必須）
 *
 * 所有権チェック・403/404 区別・ゲスト可否を検証する。
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
const mockGetShopV1 = vi.fn()
const mockUpdateShopV1 = vi.fn()

vi.mock('@/lib/services/shop-service', () => ({
  updateShopV1Schema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>
      if (d?.['website'] && typeof d['website'] === 'string' && !d['website'].startsWith('http')) {
        return { success: false, error: { issues: [{ message: 'website は http(s) URL でなければなりません' }] } }
      }
      return { success: true, data: d }
    },
  },
  getShopV1: (...args: unknown[]) => mockGetShopV1(...args),
  updateShopV1: (...args: unknown[]) => mockUpdateShopV1(...args),
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
const OWNER_ID = 'user-owner'
const OTHER_ID = 'user-other'
const VALID_SHOP_ID = 'shop-cjld2cyuq001'

const mockShopDetail = {
  id: VALID_SHOP_ID,
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
  isOwner: true,
}

async function makeAuthenticatedGetRequest(
  userId: string,
  shopId: string,
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const req = new NextRequest(`http://localhost/api/v1/shops/${shopId}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ id: shopId }) }]
}

async function makeAuthenticatedPatchRequest(
  userId: string,
  shopId: string,
  body: unknown,
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const req = new NextRequest(`http://localhost/api/v1/shops/${shopId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return [req, { params: Promise.resolve({ id: shopId }) }]
}

// ──────────────────────────────────────────────────
// GET /api/v1/shops/{id}
// ──────────────────────────────────────────────────
describe('GET /api/v1/shops/[id]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetShopV1.mockResolvedValue({ ok: true, shop: mockShopDetail })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + 盆栽園詳細（genres、averageRating 付き）', async () => {
    const [req, params] = await makeAuthenticatedGetRequest(OWNER_ID, VALID_SHOP_ID)
    const { GET } = await import('@/app/api/v1/shops/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(VALID_SHOP_ID)
    expect(body.genres).toBeDefined()
    expect(body.averageRating).toBeCloseTo(4.2)
  })

  it('ゲストトークンでもアクセス可（盆栽園詳細は公開）', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const guestToken = await signAccessToken('guest-user')
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })

    const req = new NextRequest(`http://localhost/api/v1/shops/${VALID_SHOP_ID}`, {
      headers: { authorization: `Bearer ${guestToken}` },
    })
    const { GET } = await import('@/app/api/v1/shops/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: VALID_SHOP_ID }) })

    expect(res.status).toBe(200)
  })

  it('Bearer なし → 401', async () => {
    const req = new NextRequest(`http://localhost/api/v1/shops/${VALID_SHOP_ID}`)
    const { GET } = await import('@/app/api/v1/shops/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: VALID_SHOP_ID }) })

    expect(res.status).toBe(401)
  })

  it('isHidden または不存在 → 404 NOT_FOUND', async () => {
    const { ERR_SHOP_NOT_FOUND } = await import('@/lib/constants/errors')
    mockGetShopV1.mockResolvedValue({ ok: false, error: ERR_SHOP_NOT_FOUND })

    const [req, params] = await makeAuthenticatedGetRequest(OWNER_ID, 'nonexistent-shop')
    const { GET } = await import('@/app/api/v1/shops/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const [req, params] = await makeAuthenticatedGetRequest(OWNER_ID, VALID_SHOP_ID)
    const { GET } = await import('@/app/api/v1/shops/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('getShopV1 に正しい shopId と userId が渡される', async () => {
    const [req, params] = await makeAuthenticatedGetRequest(OWNER_ID, VALID_SHOP_ID)
    const { GET } = await import('@/app/api/v1/shops/[id]/route')
    await GET(req, params)

    expect(mockGetShopV1).toHaveBeenCalledWith(VALID_SHOP_ID, OWNER_ID)
  })

  it('getShopV1 が内部エラーを返した場合 500 INTERNAL_ERROR', async () => {
    mockGetShopV1.mockResolvedValue({ ok: false, error: '操作に失敗しました' })

    const [req, params] = await makeAuthenticatedGetRequest(OWNER_ID, VALID_SHOP_ID)
    const { GET } = await import('@/app/api/v1/shops/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

// ──────────────────────────────────────────────────
// PATCH /api/v1/shops/{id}
// ──────────────────────────────────────────────────
describe('PATCH /api/v1/shops/[id]', () => {
  const validPatchBody = { name: '更新後の名前' }

  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockUpdateShopV1.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系（作成者）: 200 + { success: true }', async () => {
    const [req, params] = await makeAuthenticatedPatchRequest(OWNER_ID, VALID_SHOP_ID, validPatchBody)
    const { PATCH } = await import('@/app/api/v1/shops/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('admin ユーザーは 200 を返す', async () => {
    const ADMIN_ID = 'admin-user-id'
    mockUserFindUnique.mockResolvedValue({ id: ADMIN_ID, isSuspended: false, email: 'admin@example.com' })
    mockUpdateShopV1.mockResolvedValue({ ok: true })

    const [req, params] = await makeAuthenticatedPatchRequest(ADMIN_ID, VALID_SHOP_ID, validPatchBody)
    const { PATCH } = await import('@/app/api/v1/shops/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(200)
  })

  it('Bearer なし → 401', async () => {
    const req = new NextRequest(`http://localhost/api/v1/shops/${VALID_SHOP_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPatchBody),
    })
    const { PATCH } = await import('@/app/api/v1/shops/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: VALID_SHOP_ID }) })

    expect(res.status).toBe(401)
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(`http://localhost/api/v1/shops/${VALID_SHOP_ID}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(validPatchBody),
    })
    const { PATCH } = await import('@/app/api/v1/shops/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: VALID_SHOP_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('他人の盆栽園 → 403（ERR_EDIT_PERMISSION_DENIED）', async () => {
    const { ERR_EDIT_PERMISSION_DENIED } = await import('@/lib/constants/errors')
    mockUpdateShopV1.mockResolvedValue({ ok: false, error: ERR_EDIT_PERMISSION_DENIED })

    const [req, params] = await makeAuthenticatedPatchRequest(OTHER_ID, VALID_SHOP_ID, validPatchBody)
    mockUserFindUnique.mockResolvedValue({ id: OTHER_ID, isSuspended: false, email: 'other@example.com' })
    const { PATCH } = await import('@/app/api/v1/shops/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('不存在の盆栽園 → 404 NOT_FOUND', async () => {
    const { ERR_SHOP_NOT_FOUND } = await import('@/lib/constants/errors')
    mockUpdateShopV1.mockResolvedValue({ ok: false, error: ERR_SHOP_NOT_FOUND })

    const [req, params] = await makeAuthenticatedPatchRequest(OWNER_ID, 'nonexistent', validPatchBody)
    const { PATCH } = await import('@/app/api/v1/shops/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('403 と 404 が区別される（ERR_EDIT_PERMISSION_DENIED vs ERR_SHOP_NOT_FOUND）', async () => {
    const { ERR_EDIT_PERMISSION_DENIED, ERR_SHOP_NOT_FOUND } = await import('@/lib/constants/errors')
    const { PATCH } = await import('@/app/api/v1/shops/[id]/route')

    mockUpdateShopV1.mockResolvedValue({ ok: false, error: ERR_EDIT_PERMISSION_DENIED })
    mockUserFindUnique.mockResolvedValue({ id: OTHER_ID, isSuspended: false, email: 'other@example.com' })
    const [reqA, paramsA] = await makeAuthenticatedPatchRequest(OTHER_ID, VALID_SHOP_ID, validPatchBody)
    const res403 = await PATCH(reqA, paramsA)
    expect(res403.status).toBe(403)

    mockUpdateShopV1.mockResolvedValue({ ok: false, error: ERR_SHOP_NOT_FOUND })
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    const [reqB, paramsB] = await makeAuthenticatedPatchRequest(OWNER_ID, 'nonexistent', validPatchBody)
    const res404 = await PATCH(reqB, paramsB)
    expect(res404.status).toBe(404)
  })

  it('website が不正 URL 形式 → 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedPatchRequest(OWNER_ID, VALID_SHOP_ID, {
      website: 'not-a-url',
    })
    const { PATCH } = await import('@/app/api/v1/shops/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('JSON パース失敗 → 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(OWNER_ID)
    const req = new NextRequest(`http://localhost/api/v1/shops/${VALID_SHOP_ID}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'invalid-json{',
    })
    const { PATCH } = await import('@/app/api/v1/shops/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: VALID_SHOP_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const [req, params] = await makeAuthenticatedPatchRequest(OWNER_ID, VALID_SHOP_ID, validPatchBody)
    const { PATCH } = await import('@/app/api/v1/shops/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('updateShopV1 に正しい shopId と userId が渡される', async () => {
    const [req, params] = await makeAuthenticatedPatchRequest(OWNER_ID, VALID_SHOP_ID, validPatchBody)
    const { PATCH } = await import('@/app/api/v1/shops/[id]/route')
    await PATCH(req, params)

    expect(mockUpdateShopV1).toHaveBeenCalledWith(
      VALID_SHOP_ID,
      expect.anything(),
      OWNER_ID,
    )
  })

  it('updateShopV1 が他エラーを返した場合 500 INTERNAL_ERROR', async () => {
    mockUpdateShopV1.mockResolvedValue({ ok: false, error: '操作に失敗しました' })
    const [req, params] = await makeAuthenticatedPatchRequest(OWNER_ID, VALID_SHOP_ID, validPatchBody)
    const { PATCH } = await import('@/app/api/v1/shops/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
