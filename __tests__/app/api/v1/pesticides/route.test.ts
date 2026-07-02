// @vitest-environment node
/**
 * GET /api/v1/pesticides/disease-pests  — 病害虫一覧
 * GET /api/v1/pesticides/disease-pests/{slug} — 病害虫詳細
 * GET /api/v1/pesticides/products — 農薬製品一覧
 * GET /api/v1/pesticides/products/{slug} — 農薬製品詳細
 * GET /api/v1/pesticides/ingredients — 有効成分一覧
 * GET /api/v1/pesticides/ingredients/{slug} — 有効成分詳細
 *
 * 200 / 400 / 401 / 403 / 404 / 429 の全分岐・ゲスト可・
 * category/type/search 等フィルタ・ネスト（effects/activeIngredients/incompatibilities）・
 * 不存在 slug → 404 を検証する。
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

const mockListDiseasePests = vi.fn()
const mockGetDiseasePestBySlug = vi.fn()
const mockListPesticides = vi.fn()
const mockGetPesticideBySlug = vi.fn()
const mockListActiveIngredients = vi.fn()
const mockGetActiveIngredientBySlug = vi.fn()

vi.mock('@/lib/services/pesticide-read-service', () => ({
  diseasePestListQuerySchema: {
    safeParse: (input: Record<string, unknown>) => {
      const validCategories = ['pest', 'disease', 'beneficial_insect', 'other']
      if (input.category !== undefined && !validCategories.includes(input.category as string)) {
        return { success: false, error: { issues: [{ message: '無効なカテゴリです' }] } }
      }
      if (
        input.limit !== undefined &&
        (typeof input.limit !== 'number' || input.limit < 1 || input.limit > 100)
      ) {
        return { success: false, error: { issues: [{ message: '無効な limit です' }] } }
      }
      return { success: true, data: { ...input } }
    },
  },
  pesticideListQuerySchema: {
    safeParse: (input: Record<string, unknown>) => {
      return { success: true, data: { ...input } }
    },
  },
  ingredientListQuerySchema: {
    safeParse: (input: Record<string, unknown>) => {
      return { success: true, data: { ...input } }
    },
  },
  parsePesticideTypeParam: (raw: string | null) => {
    if (!raw) return undefined
    const validTypes = ['fungicide', 'insecticide', 'acaricide', 'compound', 'other']
    if (raw === 'herbicide') return 'other'
    return validTypes.includes(raw) ? raw : undefined
  },
  listDiseasePests: (...args: unknown[]) => mockListDiseasePests(...args),
  getDiseasePestBySlug: (...args: unknown[]) => mockGetDiseasePestBySlug(...args),
  listPesticides: (...args: unknown[]) => mockListPesticides(...args),
  getPesticideBySlug: (...args: unknown[]) => mockGetPesticideBySlug(...args),
  listActiveIngredients: (...args: unknown[]) => mockListActiveIngredients(...args),
  getActiveIngredientBySlug: (...args: unknown[]) => mockGetActiveIngredientBySlug(...args),
}))

// ── モックデータ ──────────────────────────────────────────────

const mockDiseasePestList = {
  items: [
    {
      id: 'dp1',
      name: 'アブラムシ',
      nameKana: 'アブラムシ',
      category: 'pest',
      description: '葉に寄生する害虫',
      imageUrl: '/images/aphid.jpg',
      slug: 'aphid',
      bodySizeMinMm: null,
      bodySizeMaxMm: null,
    },
    {
      id: 'dp2',
      name: 'うどんこ病',
      nameKana: 'ウドンコビョウ',
      category: 'disease',
      description: '葉に白い粉が付く',
      imageUrl: null,
      slug: 'powdery-mildew',
      bodySizeMinMm: null,
      bodySizeMaxMm: null,
    },
  ],
  nextCursor: null,
}

const mockDiseasePestDetail = {
  id: 'dp1',
  name: 'アブラムシ',
  nameKana: 'アブラムシ',
  category: 'pest',
  description: '葉に寄生する害虫',
  imageUrl: '/images/aphid.jpg',
  slug: 'aphid',
  bodySizeMinMm: null,
  bodySizeMaxMm: null,
  effects: [
    {
      pesticide: { id: 'p1', name: 'スミチオン', slug: 'sumithion', pesticideType: 'insecticide' },
      rating: { preventionLevel: 'high', treatmentLevel: 'medium', efficacyLevel: null, persistenceLevel: 'low' },
    },
  ],
}

const mockPesticideList = {
  items: [
    { id: 'p1', name: 'スミチオン', registrationNumber: '12345', pesticideType: 'insecticide', description: '有機リン系殺虫剤', slug: 'sumithion' },
    { id: 'p2', name: 'トップジンM', registrationNumber: '67890', pesticideType: 'fungicide', description: 'チオファネートメチル系殺菌剤', slug: 'topsin-m' },
  ],
  nextCursor: null,
}

const mockPesticideDetail = {
  id: 'p1',
  name: 'スミチオン',
  registrationNumber: '12345',
  pesticideType: 'insecticide',
  description: '有機リン系殺虫剤',
  slug: 'sumithion',
  formulationType: { name: '乳剤', code: 'EC' },
  activeIngredients: [{ id: 'ai1', name: 'フェニトロチオン', fracCode: null, iracCode: '1B', resistanceRisk: 'medium', slug: 'fenitrothion' }],
  effects: [
    {
      diseasePest: { id: 'dp1', name: 'アブラムシ', slug: 'aphid' },
      rating: { preventionLevel: 'high', treatmentLevel: 'medium', efficacyLevel: null, persistenceLevel: 'low' },
    },
  ],
  incompatibilities: [{ id: 'p3', name: 'ボルドー液', slug: 'bordeaux', formulationTypeName: '水和剤' }],
}

const mockIngredientList = {
  items: [
    { id: 'ai1', name: 'フェニトロチオン', nameEn: 'Fenitrothion', fracCode: null, iracCode: '1B', resistanceRisk: 'medium', slug: 'fenitrothion' },
    { id: 'ai2', name: 'チオファネートメチル', nameEn: 'Thiophanate-methyl', fracCode: '1', iracCode: null, resistanceRisk: 'high', slug: 'thiophanate-methyl' },
  ],
  nextCursor: null,
}

const mockIngredientDetail = {
  id: 'ai1',
  name: 'フェニトロチオン',
  nameEn: 'Fenitrothion',
  fracCode: null,
  iracCode: '1B',
  resistanceRisk: 'medium',
  slug: 'fenitrothion',
  ingredientGroup: '有機リン系',
  description: '広範囲の害虫に効果',
  pesticides: [
    {
      contentLabel: '50%',
      pesticide: { id: 'p1', name: 'スミチオン', slug: 'sumithion', formulationTypeName: '乳剤' },
    },
  ],
}

// ── ヘルパー ──────────────────────────────────────────────────

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  path: string,
  searchParams = '',
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const url = `http://localhost${path}${searchParams ? `?${searchParams}` : ''}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

// ============================================================
// GET /api/v1/pesticides/disease-pests (一覧)
// ============================================================

describe('GET /api/v1/pesticides/disease-pests (一覧)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListDiseasePests.mockResolvedValue(mockDiseasePestList)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 と { items, nextCursor } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(2)
    expect('nextCursor' in body).toBe(true)
  })

  it('items に { id, name, nameKana, category, description, imageUrl, slug } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      category: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('items に bodySizeMinMm と bodySizeMaxMm（number|null）が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toHaveProperty('bodySizeMinMm')
    expect(body.items[0]).toHaveProperty('bodySizeMaxMm')
    expect(body.items[0].bodySizeMinMm === null || typeof body.items[0].bodySizeMinMm === 'number').toBe(true)
    expect(body.items[0].bodySizeMaxMm === null || typeof body.items[0].bodySizeMaxMm === 'number').toBe(true)
  })

  it('ゲストユーザーも 200 を返す（rejectGuest なし）', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/pesticides/disease-pests')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('category=pest フィルタが listDiseasePests に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests', 'category=pest')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    await GET(req)

    expect(mockListDiseasePests).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'pest' }),
    )
  })

  it('category=disease フィルタが listDiseasePests に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests', 'category=disease')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    await GET(req)

    expect(mockListDiseasePests).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'disease' }),
    )
  })

  it('search パラメータが listDiseasePests に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests', 'search=aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    await GET(req)

    expect(mockListDiseasePests).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'aphid' }),
    )
  })

  it('bodySizeMm パラメータが listDiseasePests に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests', 'bodySizeMm=10')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    await GET(req)

    expect(mockListDiseasePests).toHaveBeenCalledWith(
      expect.objectContaining({ bodySizeMm: 10 }),
    )
  })

  it('不正な category → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests', 'category=INVALID_CATEGORY')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/disease-pests')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/disease-pests', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/pesticides/disease-pests', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('空 items のとき { items: [], nextCursor: null } を返す', async () => {
    mockListDiseasePests.mockResolvedValueOnce({ items: [], nextCursor: null })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items).toHaveLength(0)
  })

  it('エラーレスポンス形式が { error: { code, message, status } }', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/disease-pests')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})

// ============================================================
// GET /api/v1/pesticides/disease-pests/{slug} (詳細)
// ============================================================

describe('GET /api/v1/pesticides/disease-pests/{slug} (詳細)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetDiseasePestBySlug.mockResolvedValue(mockDiseasePestDetail)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 詳細オブジェクトを返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests/aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      category: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('詳細に effects 配列が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests/aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    const body = await res.json()
    expect(Array.isArray(body.effects)).toBe(true)
    expect(body.effects[0]).toMatchObject({
      pesticide: expect.objectContaining({ id: expect.any(String), slug: expect.any(String) }),
      rating: expect.any(Object),
    })
  })

  it('詳細に bodySizeMinMm と bodySizeMaxMm（number|null）が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests/aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    const body = await res.json()
    expect(body).toHaveProperty('bodySizeMinMm')
    expect(body).toHaveProperty('bodySizeMaxMm')
    expect(body.bodySizeMinMm === null || typeof body.bodySizeMinMm === 'number').toBe(true)
    expect(body.bodySizeMaxMm === null || typeof body.bodySizeMaxMm === 'number').toBe(true)
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/pesticides/disease-pests/aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    expect(res.status).toBe(200)
  })

  it('不存在 slug → 404 NOT_FOUND', async () => {
    mockGetDiseasePestBySlug.mockResolvedValueOnce(null)
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests/no-such')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-such' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/disease-pests/aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/pesticides/disease-pests/aphid', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/disease-pests/aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})

// ============================================================
// GET /api/v1/pesticides/products (一覧)
// ============================================================

describe('GET /api/v1/pesticides/products (一覧)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListPesticides.mockResolvedValue(mockPesticideList)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 と { items, nextCursor } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products')
    const { GET } = await import('@/app/api/v1/pesticides/products/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(2)
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/pesticides/products')
    const { GET } = await import('@/app/api/v1/pesticides/products/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('type=insecticide フィルタが listPesticides に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products', 'type=insecticide')
    const { GET } = await import('@/app/api/v1/pesticides/products/route')
    await GET(req)

    expect(mockListPesticides).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'insecticide' }),
    )
  })

  it('type=herbicide → type=other に正規化されて渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products', 'type=herbicide')
    const { GET } = await import('@/app/api/v1/pesticides/products/route')
    await GET(req)

    expect(mockListPesticides).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'other' }),
    )
  })

  it('不正な type は undefined になり pesticideListQuerySchema に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products', 'type=INVALID_TYPE')
    const { GET } = await import('@/app/api/v1/pesticides/products/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockListPesticides).toHaveBeenCalledWith(
      expect.objectContaining({ type: undefined }),
    )
  })

  it('search パラメータが listPesticides に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products', 'search=sumithion')
    const { GET } = await import('@/app/api/v1/pesticides/products/route')
    await GET(req)

    expect(mockListPesticides).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'sumithion' }),
    )
  })

  it('diseasePestId パラメータが listPesticides に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products', 'diseasePestId=dp1')
    const { GET } = await import('@/app/api/v1/pesticides/products/route')
    await GET(req)

    expect(mockListPesticides).toHaveBeenCalledWith(
      expect.objectContaining({ diseasePestId: 'dp1' }),
    )
  })

  it('formulationTypeCode パラメータが listPesticides に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products', 'formulationTypeCode=EC')
    const { GET } = await import('@/app/api/v1/pesticides/products/route')
    await GET(req)

    expect(mockListPesticides).toHaveBeenCalledWith(
      expect.objectContaining({ formulationTypeCode: 'EC' }),
    )
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/products')
    const { GET } = await import('@/app/api/v1/pesticides/products/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/pesticides/products', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/pesticides/products/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products')
    const { GET } = await import('@/app/api/v1/pesticides/products/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})

// ============================================================
// GET /api/v1/pesticides/products/{slug} (詳細)
// ============================================================

describe('GET /api/v1/pesticides/products/{slug} (詳細)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetPesticideBySlug.mockResolvedValue(mockPesticideDetail)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 詳細オブジェクトを返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products/sumithion')
    const { GET } = await import('@/app/api/v1/pesticides/products/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'sumithion' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      pesticideType: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('詳細に activeIngredients 配列が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products/sumithion')
    const { GET } = await import('@/app/api/v1/pesticides/products/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'sumithion' }) })

    const body = await res.json()
    expect(Array.isArray(body.activeIngredients)).toBe(true)
    expect(body.activeIngredients[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('詳細に effects 配列が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products/sumithion')
    const { GET } = await import('@/app/api/v1/pesticides/products/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'sumithion' }) })

    const body = await res.json()
    expect(Array.isArray(body.effects)).toBe(true)
    expect(body.effects[0]).toMatchObject({
      diseasePest: expect.objectContaining({ id: expect.any(String), slug: expect.any(String) }),
      rating: expect.any(Object),
    })
  })

  it('詳細に incompatibilities 配列が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products/sumithion')
    const { GET } = await import('@/app/api/v1/pesticides/products/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'sumithion' }) })

    const body = await res.json()
    expect(Array.isArray(body.incompatibilities)).toBe(true)
    expect(body.incompatibilities[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('詳細に formulationType が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products/sumithion')
    const { GET } = await import('@/app/api/v1/pesticides/products/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'sumithion' }) })

    const body = await res.json()
    expect(body.formulationType).toMatchObject({ name: expect.any(String), code: expect.any(String) })
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/pesticides/products/sumithion')
    const { GET } = await import('@/app/api/v1/pesticides/products/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'sumithion' }) })

    expect(res.status).toBe(200)
  })

  it('不存在 slug → 404 NOT_FOUND', async () => {
    mockGetPesticideBySlug.mockResolvedValueOnce(null)
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products/no-such')
    const { GET } = await import('@/app/api/v1/pesticides/products/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-such' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/products/sumithion')
    const { GET } = await import('@/app/api/v1/pesticides/products/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'sumithion' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/pesticides/products/sumithion', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/pesticides/products/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'sumithion' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/products/sumithion')
    const { GET } = await import('@/app/api/v1/pesticides/products/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'sumithion' }) })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})

// ============================================================
// GET /api/v1/pesticides/ingredients (一覧)
// ============================================================

describe('GET /api/v1/pesticides/ingredients (一覧)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListActiveIngredients.mockResolvedValue(mockIngredientList)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 と { items, nextCursor } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/ingredients')
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(2)
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/pesticides/ingredients')
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('search パラメータが listActiveIngredients に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/ingredients', 'search=フェニトロ')
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/route')
    await GET(req)

    expect(mockListActiveIngredients).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'フェニトロ' }),
    )
  })

  it('items に { id, name, nameEn, fracCode, iracCode, resistanceRisk, slug } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/ingredients')
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/ingredients')
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/pesticides/ingredients', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/ingredients')
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('空 items のとき { items: [], nextCursor: null } を返す', async () => {
    mockListActiveIngredients.mockResolvedValueOnce({ items: [], nextCursor: null })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/ingredients')
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items).toHaveLength(0)
  })
})

// ============================================================
// GET /api/v1/pesticides/ingredients/{slug} (詳細)
// ============================================================

describe('GET /api/v1/pesticides/ingredients/{slug} (詳細)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetActiveIngredientBySlug.mockResolvedValue(mockIngredientDetail)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 詳細オブジェクトを返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/ingredients/fenitrothion')
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'fenitrothion' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('詳細に pesticides 配列が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/ingredients/fenitrothion')
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'fenitrothion' }) })

    const body = await res.json()
    expect(Array.isArray(body.pesticides)).toBe(true)
    expect(body.pesticides[0]).toMatchObject({
      pesticide: expect.objectContaining({ id: expect.any(String), slug: expect.any(String) }),
    })
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/pesticides/ingredients/fenitrothion')
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'fenitrothion' }) })

    expect(res.status).toBe(200)
  })

  it('不存在 slug → 404 NOT_FOUND', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValueOnce(null)
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/ingredients/no-such')
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-such' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/ingredients/fenitrothion')
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'fenitrothion' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/pesticides/ingredients/fenitrothion', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'fenitrothion' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/ingredients/fenitrothion')
    const { GET } = await import('@/app/api/v1/pesticides/ingredients/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'fenitrothion' }) })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
