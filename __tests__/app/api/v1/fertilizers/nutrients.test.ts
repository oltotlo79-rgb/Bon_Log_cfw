// @vitest-environment node
/**
 * GET /api/v1/fertilizers/nutrients — 栄養素一覧
 * GET /api/v1/fertilizers/nutrients/{slug} — 栄養素詳細
 *
 * 200 / 400 / 401 / 404 / 429 の全分岐・ゲスト可・category フィルタ・
 * deficiency/excess/foodSources 含む詳細レスポンスを検証する。
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

const mockListNutrients = vi.fn()
const mockGetNutrientBySlug = vi.fn()
vi.mock('@/lib/services/fertilizer-read-service', () => ({
  nutrientCategoryQuerySchema: {
    safeParse: (input: Record<string, unknown>) => {
      const validCategories = ['primary', 'secondary', 'trace']
      if (input.category !== undefined && !validCategories.includes(input.category as string)) {
        return { success: false, error: { issues: [{ message: '無効なカテゴリです' }] } }
      }
      return { success: true, data: { category: input.category } }
    },
  },
  slugQuerySchema: {
    safeParse: (input: unknown) => {
      if (typeof input !== 'string' || input.length === 0 || input.length > 100) {
        return { success: false, error: { issues: [{ message: '無効なスラッグです' }] } }
      }
      return { success: true, data: input }
    },
  },
  treeCategoryQuerySchema: {
    safeParse: (input: Record<string, unknown>) => {
      const validCategories = ['conifer', 'deciduous', 'flowering', 'fruiting', 'grass', 'evergreen']
      if (input.category !== undefined && !validCategories.includes(input.category as string)) {
        return { success: false, error: { issues: [{ message: '無効なカテゴリです' }] } }
      }
      return { success: true, data: { category: input.category } }
    },
  },
  listNutrients: (...args: unknown[]) => mockListNutrients(...args),
  getNutrientBySlug: (...args: unknown[]) => mockGetNutrientBySlug(...args),
  listFertilizerCategories: vi.fn().mockResolvedValue({ categories: [] }),
  listTreeSpecies: vi.fn().mockResolvedValue({ treeSpecies: [] }),
  getFertilizationScheduleBySlug: vi.fn().mockResolvedValue(null),
}))

const mockNutrients = [
  { id: 'n1', name: '窒素', symbol: 'N', category: 'primary', description: '葉の成長に必要', bonsaiRole: '成長促進', slug: 'nitrogen' },
  { id: 'n2', name: 'リン', symbol: 'P', category: 'primary', description: '根の発達に必要', bonsaiRole: '開花促進', slug: 'phosphorus' },
]

const mockNutrientDetail = {
  id: 'n1',
  name: '窒素',
  symbol: 'N',
  category: 'primary',
  description: '葉の成長に必要',
  bonsaiRole: '成長促進',
  deficiencySymptoms: '葉が黄化する',
  excessSymptoms: '徒長しやすくなる',
  foodSources: '油かす、魚粉',
  slug: 'nitrogen',
}

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

describe('GET /api/v1/fertilizers/nutrients (一覧)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListNutrients.mockResolvedValue({ nutrients: mockNutrients })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 配列を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/nutrients')
    const { GET } = await import('@/app/api/v1/fertilizers/nutrients/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
  })

  it('items に { id, name, symbol, category, slug } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/nutrients')
    const { GET } = await import('@/app/api/v1/fertilizers/nutrients/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      symbol: expect.any(String),
      category: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/fertilizers/nutrients')
    const { GET } = await import('@/app/api/v1/fertilizers/nutrients/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('category=primary フィルタが listNutrients に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/nutrients', 'category=primary')
    const { GET } = await import('@/app/api/v1/fertilizers/nutrients/route')
    await GET(req)

    expect(mockListNutrients).toHaveBeenCalledWith(expect.objectContaining({ category: 'primary' }))
  })

  it('不正な category → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/nutrients', 'category=INVALID')
    const { GET } = await import('@/app/api/v1/fertilizers/nutrients/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/fertilizers/nutrients')
    const { GET } = await import('@/app/api/v1/fertilizers/nutrients/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/nutrients')
    const { GET } = await import('@/app/api/v1/fertilizers/nutrients/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})

describe('GET /api/v1/fertilizers/nutrients/{slug} (詳細)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetNutrientBySlug.mockResolvedValue(mockNutrientDetail)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 詳細オブジェクトを返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/nutrients/nitrogen')
    const { GET } = await import('@/app/api/v1/fertilizers/nutrients/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'nitrogen' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      symbol: expect.any(String),
    })
  })

  it('詳細に deficiencySymptoms, excessSymptoms, foodSources が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/nutrients/nitrogen')
    const { GET } = await import('@/app/api/v1/fertilizers/nutrients/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'nitrogen' }) })

    const body = await res.json()
    expect(body).toHaveProperty('deficiencySymptoms')
    expect(body).toHaveProperty('excessSymptoms')
    expect(body).toHaveProperty('foodSources')
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/fertilizers/nutrients/nitrogen')
    const { GET } = await import('@/app/api/v1/fertilizers/nutrients/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'nitrogen' }) })

    expect(res.status).toBe(200)
  })

  it('不存在 slug → 404 NOT_FOUND', async () => {
    mockGetNutrientBySlug.mockResolvedValueOnce(null)
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/nutrients/no-such')
    const { GET } = await import('@/app/api/v1/fertilizers/nutrients/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-such' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/fertilizers/nutrients/nitrogen')
    const { GET } = await import('@/app/api/v1/fertilizers/nutrients/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'nitrogen' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/nutrients/nitrogen')
    const { GET } = await import('@/app/api/v1/fertilizers/nutrients/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'nitrogen' }) })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
