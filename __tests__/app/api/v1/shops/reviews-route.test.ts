// @vitest-environment node
/**
 * GET  /api/v1/shops/{id}/reviews  — レビュー一覧取得（ゲスト可）
 * POST /api/v1/shops/{id}/reviews  — レビュー投稿（認証必須・ゲスト不可）
 *
 * ゲスト可否・二重投稿 409・mediaUrls 外部 URL 400・rating 範囲・429 を検証する。
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
const mockListReviewsV1 = vi.fn()
const mockCreateReviewV1 = vi.fn()

vi.mock('@/lib/services/shop-service', () => ({
  listReviewsV1QuerySchema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, string | undefined>
      const limit = d?.['limit'] !== undefined ? Number(d['limit']) : undefined
      if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
        return { success: false, error: { issues: [{ message: 'limit は1-100の範囲で指定してください' }] } }
      }
      return {
        success: true,
        data: {
          cursor: d?.['cursor'],
          limit,
        },
      }
    },
  },
  createReviewV1Schema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>
      const rating = d?.['rating']
      if (rating === undefined || rating === null || typeof rating !== 'number') {
        return { success: false, error: { issues: [{ message: '評価は1～5の間で選択してください' }] } }
      }
      if ((rating as number) < 1 || (rating as number) > 5 || !Number.isInteger(rating)) {
        return { success: false, error: { issues: [{ message: '評価は1～5の間で選択してください' }] } }
      }
      const mediaUrls = (d['mediaUrls'] as string[]) ?? []
      if (mediaUrls.length > 3) {
        return { success: false, error: { issues: [{ message: '画像は3枚までです' }] } }
      }
      return {
        success: true,
        data: {
          rating,
          content: d['content'] ?? null,
          mediaUrls,
        },
      }
    },
  },
  listReviewsV1: (...args: unknown[]) => mockListReviewsV1(...args),
  createReviewV1: (...args: unknown[]) => mockCreateReviewV1(...args),
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
const USER_ID = 'user-abc'
const OWNER_EMAIL = 'owner@example.com'
const VALID_SHOP_ID = 'shop-cjld2cyuq001'

const mockReviewItem = {
  id: 'review-001',
  rating: 4,
  content: 'とても良い園芸店です',
  images: [],
  user: { id: USER_ID, nickname: 'テストユーザー', avatarUrl: null },
  createdAt: '2025-01-01T00:00:00.000Z',
}

async function makeAuthenticatedGetRequest(
  userId: string,
  shopId: string,
  searchParams = '',
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const req = new NextRequest(
    `http://localhost/api/v1/shops/${shopId}/reviews${searchParams ? `?${searchParams}` : ''}`,
    { headers: { authorization: `Bearer ${token}` } },
  )
  return [req, { params: Promise.resolve({ id: shopId }) }]
}

async function makeAuthenticatedPostRequest(
  userId: string,
  shopId: string,
  body: unknown,
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const req = new NextRequest(`http://localhost/api/v1/shops/${shopId}/reviews`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return [req, { params: Promise.resolve({ id: shopId }) }]
}

const validCreateBody = {
  rating: 4,
  content: 'とても良い園芸店です',
  mediaUrls: [],
}

// ──────────────────────────────────────────────────
// GET /api/v1/shops/{id}/reviews
// ──────────────────────────────────────────────────
describe('GET /api/v1/shops/[id]/reviews', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: OWNER_EMAIL })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListReviewsV1.mockResolvedValue({ ok: true, items: [mockReviewItem], nextCursor: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系（認証済み）: 200 + { items, nextCursor }', async () => {
    const [req, params] = await makeAuthenticatedGetRequest(USER_ID, VALID_SHOP_ID)
    const { GET } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
    expect(body.nextCursor).toBeNull()
    expect(body.items[0]?.rating).toBe(4)
  })

  it('ゲストトークンでもアクセス可（レビュー一覧は公開）', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const guestToken = await signAccessToken('guest-user')
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })

    const req = new NextRequest(`http://localhost/api/v1/shops/${VALID_SHOP_ID}/reviews`, {
      headers: { authorization: `Bearer ${guestToken}` },
    })
    const { GET } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await GET(req, { params: Promise.resolve({ id: VALID_SHOP_ID }) })

    expect(res.status).toBe(200)
  })

  it('Bearer なし → 401', async () => {
    const req = new NextRequest(`http://localhost/api/v1/shops/${VALID_SHOP_ID}/reviews`)
    const { GET } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await GET(req, { params: Promise.resolve({ id: VALID_SHOP_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('listReviewsV1 に正しい shopId が渡される', async () => {
    const [req, params] = await makeAuthenticatedGetRequest(USER_ID, VALID_SHOP_ID)
    const { GET } = await import('@/app/api/v1/shops/[id]/reviews/route')
    await GET(req, params)

    expect(mockListReviewsV1).toHaveBeenCalledWith(VALID_SHOP_ID, expect.anything())
  })

  it('cursor パラメータが listReviewsV1 に渡される', async () => {
    const [req, params] = await makeAuthenticatedGetRequest(USER_ID, VALID_SHOP_ID, 'cursor=cursor-review-id')
    const { GET } = await import('@/app/api/v1/shops/[id]/reviews/route')
    await GET(req, params)

    const callArg = mockListReviewsV1.mock.calls[0]?.[1] as Record<string, unknown>
    expect(callArg?.cursor).toBe('cursor-review-id')
  })

  it('不正な limit（0）→ 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedGetRequest(USER_ID, VALID_SHOP_ID, 'limit=0')
    const { GET } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await GET(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const [req, params] = await makeAuthenticatedGetRequest(USER_ID, VALID_SHOP_ID)
    const { GET } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('listReviewsV1 が失敗した場合 500 INTERNAL_ERROR', async () => {
    mockListReviewsV1.mockResolvedValue({ ok: false, error: '取得失敗' })
    const [req, params] = await makeAuthenticatedGetRequest(USER_ID, VALID_SHOP_ID)
    const { GET } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await GET(req, params)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

// ──────────────────────────────────────────────────
// POST /api/v1/shops/{id}/reviews
// ──────────────────────────────────────────────────
describe('POST /api/v1/shops/[id]/reviews', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: OWNER_EMAIL })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockCreateReviewV1.mockResolvedValue({ ok: true, review: mockReviewItem })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 201 + ReviewItem', async () => {
    const [req, params] = await makeAuthenticatedPostRequest(USER_ID, VALID_SHOP_ID, validCreateBody)
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, params)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('review-001')
    expect(body.rating).toBe(4)
  })

  it('createReviewV1 に正しい shopId と userId が渡される', async () => {
    const [req, params] = await makeAuthenticatedPostRequest(USER_ID, VALID_SHOP_ID, validCreateBody)
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    await POST(req, params)

    expect(mockCreateReviewV1).toHaveBeenCalledWith(VALID_SHOP_ID, expect.anything(), USER_ID)
  })

  it('Bearer なし → 401', async () => {
    const req = new NextRequest(`http://localhost/api/v1/shops/${VALID_SHOP_ID}/reviews`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_SHOP_ID }) })

    expect(res.status).toBe(401)
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(`http://localhost/api/v1/shops/${VALID_SHOP_ID}/reviews`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_SHOP_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('rating が 0（範囲外）→ 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedPostRequest(USER_ID, VALID_SHOP_ID, {
      ...validCreateBody,
      rating: 0,
    })
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rating が 6（範囲外）→ 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedPostRequest(USER_ID, VALID_SHOP_ID, {
      ...validCreateBody,
      rating: 6,
    })
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rating が文字列（型不正）→ 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedPostRequest(USER_ID, VALID_SHOP_ID, {
      ...validCreateBody,
      rating: 'four',
    })
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rating が 1（境界値）→ 201', async () => {
    const [req, params] = await makeAuthenticatedPostRequest(USER_ID, VALID_SHOP_ID, {
      ...validCreateBody,
      rating: 1,
    })
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, params)

    expect(res.status).toBe(201)
  })

  it('rating が 5（境界値）→ 201', async () => {
    const [req, params] = await makeAuthenticatedPostRequest(USER_ID, VALID_SHOP_ID, {
      ...validCreateBody,
      rating: 5,
    })
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, params)

    expect(res.status).toBe(201)
  })

  it('mediaUrls が 4 枚（上限超過）→ 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedPostRequest(USER_ID, VALID_SHOP_ID, {
      ...validCreateBody,
      mediaUrls: [
        'https://storage.example.com/a.jpg',
        'https://storage.example.com/b.jpg',
        'https://storage.example.com/c.jpg',
        'https://storage.example.com/d.jpg',
      ],
    })
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('shop が存在しない → 404 NOT_FOUND', async () => {
    const { ERR_SHOP_NOT_FOUND } = await import('@/lib/constants/errors')
    mockCreateReviewV1.mockResolvedValue({ ok: false, error: ERR_SHOP_NOT_FOUND })

    const [req, params] = await makeAuthenticatedPostRequest(USER_ID, 'nonexistent', validCreateBody)
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('二重レビュー（conflict: true）→ 409 CONFLICT', async () => {
    const { ERR_REVIEW_ALREADY_EXISTS } = await import('@/lib/constants/errors')
    mockCreateReviewV1.mockResolvedValue({
      ok: false,
      error: ERR_REVIEW_ALREADY_EXISTS,
      conflict: true,
    })

    const [req, params] = await makeAuthenticatedPostRequest(USER_ID, VALID_SHOP_ID, validCreateBody)
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, params)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
  })

  it('外部 URL の mediaUrls（ERR_INVALID_INPUT）→ 500 or 別エラー（service 側で処理）', async () => {
    const { ERR_INVALID_INPUT } = await import('@/lib/constants/errors')
    mockCreateReviewV1.mockResolvedValue({ ok: false, error: ERR_INVALID_INPUT })

    const [req, params] = await makeAuthenticatedPostRequest(USER_ID, VALID_SHOP_ID, {
      ...validCreateBody,
      mediaUrls: ['https://external.example.com/img.jpg'],
    })
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, params)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('JSON パース失敗 → 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(USER_ID)
    const req = new NextRequest(`http://localhost/api/v1/shops/${VALID_SHOP_ID}/reviews`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'invalid-json{',
    })
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_SHOP_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const [req, params] = await makeAuthenticatedPostRequest(USER_ID, VALID_SHOP_ID, validCreateBody)
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('createReviewV1 が内部エラーを返した場合 500 INTERNAL_ERROR', async () => {
    mockCreateReviewV1.mockResolvedValue({ ok: false, error: '操作に失敗しました' })
    const [req, params] = await makeAuthenticatedPostRequest(USER_ID, VALID_SHOP_ID, validCreateBody)
    const { POST } = await import('@/app/api/v1/shops/[id]/reviews/route')
    const res = await POST(req, params)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
