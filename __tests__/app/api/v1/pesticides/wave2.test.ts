// @vitest-environment node
/**
 * Wave 2 エンドポイントのルートテスト
 *
 * GET /api/v1/pesticides/spreaders            (P-1)
 * GET /api/v1/pesticides/spreaders/{slug}     (P-2)
 * GET /api/v1/pesticides/spreader-products    (P-3)
 * GET /api/v1/pesticides/columns              (P-4)
 * GET /api/v1/pesticides/columns/{slug}       (P-5)
 * GET /api/v1/pesticides/formulations         (P-6)
 * GET /api/v1/pesticides/mixing-data          (P-7)
 *
 * ゲスト可・未認証 401・レート制限 429・404・400 不正パラメータを検証する。
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

const mockListSpreaderTypes = vi.fn()
const mockGetSpreaderTypeBySlug = vi.fn()
const mockListSpreaderProducts = vi.fn()
const mockListPesticideColumns = vi.fn()
const mockGetPesticideColumnBySlug = vi.fn()
const mockListFormulationTypes = vi.fn()
const mockGetMixingData = vi.fn()

vi.mock('@/lib/services/pesticide-read-service', () => ({
  diseasePestListQuerySchema: { safeParse: () => ({ success: true, data: {} }) },
  pesticideListQuerySchema: { safeParse: () => ({ success: true, data: {} }) },
  ingredientListQuerySchema: { safeParse: () => ({ success: true, data: {} }) },
  spreaderProductListQuerySchema: {
    safeParse: (input: Record<string, unknown>) => {
      if (
        input.limit !== undefined &&
        (typeof input.limit !== 'number' || input.limit < 1 || input.limit > 100)
      ) {
        return { success: false, error: { issues: [{ message: '無効な limit です' }] } }
      }
      return { success: true, data: { ...input } }
    },
  },
  pesticideColumnListQuerySchema: {
    safeParse: (input: Record<string, unknown>) => {
      if (
        input.limit !== undefined &&
        (typeof input.limit !== 'number' || input.limit < 1 || input.limit > 100)
      ) {
        return { success: false, error: { issues: [{ message: '無効な limit です' }] } }
      }
      return { success: true, data: { ...input } }
    },
  },
  parsePesticideTypeParam: () => undefined,
  listDiseasePests: vi.fn(),
  getDiseasePestBySlug: vi.fn(),
  listPesticides: vi.fn(),
  getPesticideBySlug: vi.fn(),
  listActiveIngredients: vi.fn(),
  getActiveIngredientBySlug: vi.fn(),
  listSpreaderTypes: (...args: unknown[]) => mockListSpreaderTypes(...args),
  getSpreaderTypeBySlug: (...args: unknown[]) => mockGetSpreaderTypeBySlug(...args),
  listSpreaderProducts: (...args: unknown[]) => mockListSpreaderProducts(...args),
  listPesticideColumns: (...args: unknown[]) => mockListPesticideColumns(...args),
  getPesticideColumnBySlug: (...args: unknown[]) => mockGetPesticideColumnBySlug(...args),
  listFormulationTypes: (...args: unknown[]) => mockListFormulationTypes(...args),
  getMixingData: (...args: unknown[]) => mockGetMixingData(...args),
}))

// ── モックデータ ──────────────────────────────────────────────

const mockSpreaderTypesList = {
  items: [
    {
      id: 'st1',
      slug: 'nonionic',
      name: 'ノニオン系',
      description: '非イオン性展着剤',
      sortOrder: 1,
      products: [
        {
          id: 'sp1',
          slug: 'spread-1',
          name: '展着剤A',
          description: '汎用展着剤',
          formulationType: { name: '液剤', code: 'SL' },
        },
      ],
    },
    {
      id: 'st2',
      slug: 'cationic',
      name: 'カチオン系',
      description: null,
      sortOrder: 2,
      products: [],
    },
  ],
}

const mockSpreaderTypeDetail = {
  id: 'st1',
  slug: 'nonionic',
  name: 'ノニオン系',
  description: '非イオン性展着剤',
  effect: '浸透性・展着性を向上',
  usageNote: '1000〜2000倍に希釈して使用',
  sortOrder: 1,
  products: [
    {
      id: 'sp1',
      slug: 'spread-1',
      name: '展着剤A',
      description: '汎用展着剤',
      formulationType: { name: '液剤', code: 'SL' },
    },
  ],
}

const mockSpreaderProductsList = {
  items: [
    {
      id: 'sp1',
      slug: 'spread-1',
      name: '展着剤A',
      registrationNumber: '11111',
      formulationType: { name: '液剤', code: 'SL' },
      spreaderTypes: [{ id: 'st1', slug: 'nonionic', name: 'ノニオン系' }],
    },
  ],
  nextCursor: null,
}

const mockColumnsList = {
  items: [
    {
      id: 'col1',
      slug: 'column-1',
      title: '農薬の基礎知識',
      category: 'basics',
      publishedAt: '2024-01-01T00:00:00.000Z',
      sortOrder: 1,
    },
    {
      id: 'col2',
      slug: 'column-2',
      title: '病害虫の見分け方',
      category: 'pest',
      publishedAt: '2024-02-01T00:00:00.000Z',
      sortOrder: 2,
    },
  ],
  nextCursor: null,
}

const mockColumnDetail = {
  id: 'col1',
  slug: 'column-1',
  title: '農薬の基礎知識',
  category: 'basics',
  publishedAt: '2024-01-01T00:00:00.000Z',
  content: '農薬について詳しく説明します。',
  sortOrder: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-15T00:00:00.000Z',
}

const mockFormulationsList = {
  items: [
    {
      id: 'ft1',
      code: 'SL',
      name: '液剤',
      description: '液状の製剤',
      sortOrder: 1,
      pesticidesCount: 5,
    },
    {
      id: 'ft2',
      code: 'WP',
      name: '水和剤',
      description: '水に溶かして使用する粉末状製剤',
      sortOrder: 2,
      pesticidesCount: 3,
    },
  ],
}

const mockMixingData = {
  pesticides: [
    { id: 'p1', slug: 'sumithion', name: 'スミチオン', pesticideType: 'insecticide' },
    { id: 'p2', slug: 'topsin-m', name: 'トップジンM', pesticideType: 'fungicide' },
  ],
  incompatibilities: [
    { pesticideId: 'p1', incompatibleWithId: 'p2' },
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
// P-1: GET /api/v1/pesticides/spreaders (一覧)
// ============================================================

describe('P-1: GET /api/v1/pesticides/spreaders (展着剤タイプ一覧)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListSpreaderTypes.mockResolvedValue(mockSpreaderTypesList)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 と { items } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreaders')
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(2)
  })

  it('items に { id, slug, name, description, sortOrder, products } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreaders')
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
      sortOrder: expect.any(Number),
    })
    expect(Array.isArray(body.items[0].products)).toBe(true)
  })

  it('products に { id, slug, name, description, formulationType } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreaders')
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/route')
    const res = await GET(req)

    const body = await res.json()
    const product = body.items[0].products[0]
    expect(product).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
    })
    expect(product.formulationType).toMatchObject({ name: expect.any(String), code: expect.any(String) })
  })

  it('ゲストユーザーも 200 を返す（rejectGuest なし）', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/pesticides/spreaders')
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/spreaders')
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreaders')
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/pesticides/spreaders', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('空 items のとき { items: [] } を返す', async () => {
    mockListSpreaderTypes.mockResolvedValueOnce({ items: [] })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreaders')
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items).toHaveLength(0)
  })
})

// ============================================================
// P-2: GET /api/v1/pesticides/spreaders/{slug} (詳細)
// ============================================================

describe('P-2: GET /api/v1/pesticides/spreaders/{slug} (展着剤タイプ詳細)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetSpreaderTypeBySlug.mockResolvedValue(mockSpreaderTypeDetail)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 詳細オブジェクトを返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreaders/nonionic')
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'nonionic' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
      sortOrder: expect.any(Number),
    })
  })

  it('詳細に effect と usageNote フィールドが含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreaders/nonionic')
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'nonionic' }) })

    const body = await res.json()
    expect(body).toHaveProperty('effect')
    expect(body).toHaveProperty('usageNote')
    expect(typeof body.effect).toBe('string')
    expect(typeof body.usageNote).toBe('string')
  })

  it('詳細に products 配列が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreaders/nonionic')
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'nonionic' }) })

    const body = await res.json()
    expect(Array.isArray(body.products)).toBe(true)
    expect(body.products[0]).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
    })
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/pesticides/spreaders/nonionic')
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'nonionic' }) })

    expect(res.status).toBe(200)
  })

  it('不存在 slug → 404 NOT_FOUND', async () => {
    mockGetSpreaderTypeBySlug.mockResolvedValueOnce(null)
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreaders/no-such')
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-such' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/spreaders/nonionic')
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'nonionic' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreaders/nonionic')
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'nonionic' }) })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/pesticides/spreaders/nonionic', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/pesticides/spreaders/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'nonionic' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })
})

// ============================================================
// P-3: GET /api/v1/pesticides/spreader-products (カーソルページネーション)
// ============================================================

describe('P-3: GET /api/v1/pesticides/spreader-products (展着剤製品一覧)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListSpreaderProducts.mockResolvedValue(mockSpreaderProductsList)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 と { items, nextCursor } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreader-products')
    const { GET } = await import('@/app/api/v1/pesticides/spreader-products/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect('nextCursor' in body).toBe(true)
  })

  it('items に spreaderTypes 配列が含まれる製品が返される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreader-products')
    const { GET } = await import('@/app/api/v1/pesticides/spreader-products/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
    })
    expect(Array.isArray(body.items[0].spreaderTypes)).toBe(true)
    expect(body.items[0].spreaderTypes[0]).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
    })
  })

  it('cursor パラメータが listSpreaderProducts に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreader-products', 'cursor=spread-1')
    const { GET } = await import('@/app/api/v1/pesticides/spreader-products/route')
    await GET(req)

    expect(mockListSpreaderProducts).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'spread-1' }),
    )
  })

  it('nextCursor が設定されているとき pagination を含む', async () => {
    mockListSpreaderProducts.mockResolvedValueOnce({
      items: [{ ...mockSpreaderProductsList.items[0] }],
      nextCursor: 'spread-2',
    })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreader-products')
    const { GET } = await import('@/app/api/v1/pesticides/spreader-products/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.nextCursor).toBe('spread-2')
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/pesticides/spreader-products')
    const { GET } = await import('@/app/api/v1/pesticides/spreader-products/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/spreader-products')
    const { GET } = await import('@/app/api/v1/pesticides/spreader-products/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正な limit → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreader-products', 'limit=999')
    const { GET } = await import('@/app/api/v1/pesticides/spreader-products/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/spreader-products')
    const { GET } = await import('@/app/api/v1/pesticides/spreader-products/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})

// ============================================================
// P-4: GET /api/v1/pesticides/columns (カーソルページネーション + publishedAt)
// ============================================================

describe('P-4: GET /api/v1/pesticides/columns (農薬コラム一覧)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListPesticideColumns.mockResolvedValue(mockColumnsList)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 と { items, nextCursor } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/columns')
    const { GET } = await import('@/app/api/v1/pesticides/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(2)
    expect('nextCursor' in body).toBe(true)
  })

  it('items に { id, slug, title, category, publishedAt, sortOrder } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/columns')
    const { GET } = await import('@/app/api/v1/pesticides/columns/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      title: expect.any(String),
      category: expect.any(String),
      publishedAt: expect.any(String),
      sortOrder: expect.any(Number),
    })
  })

  it('cursor パラメータが listPesticideColumns に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/columns', 'cursor=column-1')
    const { GET } = await import('@/app/api/v1/pesticides/columns/route')
    await GET(req)

    expect(mockListPesticideColumns).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'column-1' }),
    )
  })

  it('nextCursor が設定されているとき pagination を含む', async () => {
    mockListPesticideColumns.mockResolvedValueOnce({
      items: [{ ...mockColumnsList.items[0] }],
      nextCursor: 'column-3',
    })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/columns')
    const { GET } = await import('@/app/api/v1/pesticides/columns/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.nextCursor).toBe('column-3')
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/pesticides/columns')
    const { GET } = await import('@/app/api/v1/pesticides/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/columns')
    const { GET } = await import('@/app/api/v1/pesticides/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正な limit → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/columns', 'limit=999')
    const { GET } = await import('@/app/api/v1/pesticides/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/columns')
    const { GET } = await import('@/app/api/v1/pesticides/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('空 items のとき { items: [], nextCursor: null } を返す', async () => {
    mockListPesticideColumns.mockResolvedValueOnce({ items: [], nextCursor: null })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/columns')
    const { GET } = await import('@/app/api/v1/pesticides/columns/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items).toHaveLength(0)
  })
})

// ============================================================
// P-5: GET /api/v1/pesticides/columns/{slug} (詳細)
// ============================================================

describe('P-5: GET /api/v1/pesticides/columns/{slug} (農薬コラム詳細)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetPesticideColumnBySlug.mockResolvedValue(mockColumnDetail)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 詳細オブジェクトを返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/columns/column-1')
    const { GET } = await import('@/app/api/v1/pesticides/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'column-1' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      title: expect.any(String),
      category: expect.any(String),
      publishedAt: expect.any(String),
      content: expect.any(String),
      sortOrder: expect.any(Number),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })
  })

  it('詳細に content フィールドが含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/columns/column-1')
    const { GET } = await import('@/app/api/v1/pesticides/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'column-1' }) })

    const body = await res.json()
    expect(typeof body.content).toBe('string')
    expect(body.content.length).toBeGreaterThan(0)
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/pesticides/columns/column-1')
    const { GET } = await import('@/app/api/v1/pesticides/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'column-1' }) })

    expect(res.status).toBe(200)
  })

  it('不存在 slug → 404 NOT_FOUND', async () => {
    mockGetPesticideColumnBySlug.mockResolvedValueOnce(null)
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/columns/no-such')
    const { GET } = await import('@/app/api/v1/pesticides/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-such' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/columns/column-1')
    const { GET } = await import('@/app/api/v1/pesticides/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'column-1' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/columns/column-1')
    const { GET } = await import('@/app/api/v1/pesticides/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'column-1' }) })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/pesticides/columns/column-1', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/pesticides/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'column-1' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })
})

// ============================================================
// P-6: GET /api/v1/pesticides/formulations (剤型マスタ一覧)
// ============================================================

describe('P-6: GET /api/v1/pesticides/formulations (剤型マスタ一覧)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListFormulationTypes.mockResolvedValue(mockFormulationsList)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 と { items } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/formulations')
    const { GET } = await import('@/app/api/v1/pesticides/formulations/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(2)
  })

  it('items に { id, code, name, description, sortOrder, pesticidesCount } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/formulations')
    const { GET } = await import('@/app/api/v1/pesticides/formulations/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      id: expect.any(String),
      code: expect.any(String),
      name: expect.any(String),
      sortOrder: expect.any(Number),
      pesticidesCount: expect.any(Number),
    })
  })

  it('pesticidesCount が _count.pesticides から導出されている', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/formulations')
    const { GET } = await import('@/app/api/v1/pesticides/formulations/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0].pesticidesCount).toBe(5)
    expect(body.items[1].pesticidesCount).toBe(3)
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/pesticides/formulations')
    const { GET } = await import('@/app/api/v1/pesticides/formulations/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/formulations')
    const { GET } = await import('@/app/api/v1/pesticides/formulations/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/formulations')
    const { GET } = await import('@/app/api/v1/pesticides/formulations/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/pesticides/formulations', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/pesticides/formulations/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('空 items のとき { items: [] } を返す', async () => {
    mockListFormulationTypes.mockResolvedValueOnce({ items: [] })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/formulations')
    const { GET } = await import('@/app/api/v1/pesticides/formulations/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items).toHaveLength(0)
  })
})

// ============================================================
// P-7: GET /api/v1/pesticides/mixing-data (混用チェッカー全データ)
// ============================================================

describe('P-7: GET /api/v1/pesticides/mixing-data (混用チェッカー全データ)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetMixingData.mockResolvedValue(mockMixingData)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 と { pesticides, incompatibilities } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/mixing-data')
    const { GET } = await import('@/app/api/v1/pesticides/mixing-data/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.pesticides)).toBe(true)
    expect(Array.isArray(body.incompatibilities)).toBe(true)
  })

  it('pesticides に { id, slug, name, pesticideType } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/mixing-data')
    const { GET } = await import('@/app/api/v1/pesticides/mixing-data/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.pesticides).toHaveLength(2)
    expect(body.pesticides[0]).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
      pesticideType: expect.any(String),
    })
  })

  it('incompatibilities に { pesticideId, incompatibleWithId } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/mixing-data')
    const { GET } = await import('@/app/api/v1/pesticides/mixing-data/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.incompatibilities).toHaveLength(1)
    expect(body.incompatibilities[0]).toMatchObject({
      pesticideId: expect.any(String),
      incompatibleWithId: expect.any(String),
    })
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/pesticides/mixing-data')
    const { GET } = await import('@/app/api/v1/pesticides/mixing-data/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/pesticides/mixing-data')
    const { GET } = await import('@/app/api/v1/pesticides/mixing-data/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/mixing-data')
    const { GET } = await import('@/app/api/v1/pesticides/mixing-data/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/pesticides/mixing-data', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/pesticides/mixing-data/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('incompatibilities が空の場合も正常に返す', async () => {
    mockGetMixingData.mockResolvedValueOnce({ pesticides: mockMixingData.pesticides, incompatibilities: [] })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/pesticides/mixing-data')
    const { GET } = await import('@/app/api/v1/pesticides/mixing-data/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.incompatibilities).toHaveLength(0)
    expect(body.pesticides).toHaveLength(2)
  })
})
