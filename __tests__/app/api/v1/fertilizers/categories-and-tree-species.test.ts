// @vitest-environment node
/**
 * GET /api/v1/fertilizers/categories — 肥料カテゴリ一覧
 * GET /api/v1/fertilizers/tree-species — 樹種一覧
 * GET /api/v1/fertilizers/tree-species/{slug}/schedule — 施肥スケジュール
 *
 * 200 / 400 / 401 / 404 / 429 の全分岐・ゲスト可・category フィルタ・
 * months 配列含む schedule レスポンス・不存在 slug → 404 を検証する。
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

const mockListFertilizerCategories = vi.fn()
const mockListTreeSpecies = vi.fn()
const mockGetFertilizationScheduleBySlug = vi.fn()
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
  treeCategoryQuerySchema: {
    safeParse: (input: Record<string, unknown>) => {
      const validCategories = ['conifer', 'deciduous', 'flowering', 'fruiting', 'grass', 'evergreen']
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
  listNutrients: vi.fn().mockResolvedValue({ nutrients: [] }),
  getNutrientBySlug: vi.fn().mockResolvedValue(null),
  listFertilizerCategories: (...args: unknown[]) => mockListFertilizerCategories(...args),
  listTreeSpecies: (...args: unknown[]) => mockListTreeSpecies(...args),
  getFertilizationScheduleBySlug: (...args: unknown[]) => mockGetFertilizationScheduleBySlug(...args),
}))

const mockCategories = [
  { code: 'organic', name: '有機肥料', description: '植物・動物由来の原料', merit: '土壌改善効果', demerit: '即効性が低い', bonsaiUsage: '元肥として使用', slug: 'organic' },
  { code: 'chemical', name: '化成肥料', description: '化学合成した肥料', merit: '即効性が高い', demerit: '土壌が痩せやすい', bonsaiUsage: '追肥として使用', slug: 'chemical' },
]

const mockTreeSpecies = [
  { id: 'ts1', name: '黒松', category: 'conifer', fertilizingPolicy: '年2回施肥', slug: 'kuromatsu' },
  { id: 'ts2', name: 'もみじ', category: 'deciduous', fertilizingPolicy: '春秋施肥', slug: 'momiji' },
]

const mockSchedule = {
  id: 'ts1',
  name: '黒松',
  slug: 'kuromatsu',
  plans: [
    { month: 3, action: 'moderate', nitrogenLevel: 'balanced', phosphorusLevel: 'balanced', potassiumLevel: 'balanced', recommendedType: 'organic', description: '春の施肥' },
    { month: 9, action: 'light', nitrogenLevel: 'low', phosphorusLevel: 'balanced', potassiumLevel: 'high', recommendedType: 'organic', description: '秋の施肥' },
  ],
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

describe('GET /api/v1/fertilizers/categories (肥料カテゴリ一覧)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListFertilizerCategories.mockResolvedValue({ categories: mockCategories })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 配列を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/categories')
    const { GET } = await import('@/app/api/v1/fertilizers/categories/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
  })

  it('items に { code, name, description, slug } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/categories')
    const { GET } = await import('@/app/api/v1/fertilizers/categories/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body[0]).toMatchObject({
      code: expect.any(String),
      name: expect.any(String),
      description: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/fertilizers/categories')
    const { GET } = await import('@/app/api/v1/fertilizers/categories/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/fertilizers/categories')
    const { GET } = await import('@/app/api/v1/fertilizers/categories/route')
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
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/categories')
    const { GET } = await import('@/app/api/v1/fertilizers/categories/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('空配列のとき [] を返す', async () => {
    mockListFertilizerCategories.mockResolvedValueOnce({ categories: [] })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/categories')
    const { GET } = await import('@/app/api/v1/fertilizers/categories/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body).toHaveLength(0)
  })
})

describe('GET /api/v1/fertilizers/tree-species (樹種一覧)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListTreeSpecies.mockResolvedValue({ treeSpecies: mockTreeSpecies })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 配列を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/tree-species')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
  })

  it('items に { id, name, category, slug } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/tree-species')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      category: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/fertilizers/tree-species')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('category=conifer フィルタが listTreeSpecies に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/tree-species', 'category=conifer')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/route')
    await GET(req)

    expect(mockListTreeSpecies).toHaveBeenCalledWith(expect.objectContaining({ category: 'conifer' }))
  })

  it('不正な category → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/tree-species', 'category=INVALID')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/fertilizers/tree-species')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/route')
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
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/tree-species')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})

describe('GET /api/v1/fertilizers/tree-species/{slug}/schedule (施肥スケジュール)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetFertilizationScheduleBySlug.mockResolvedValue(mockSchedule)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 { months } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/tree-species/kuromatsu/schedule')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('months')
    expect(Array.isArray(body.months)).toBe(true)
  })

  it('months 配列に month/action フィールドが含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/tree-species/kuromatsu/schedule')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    const body = await res.json()
    expect(body.months[0]).toMatchObject({
      month: expect.any(Number),
      action: expect.any(String),
    })
  })

  it('months が月順（昇順）で返される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/tree-species/kuromatsu/schedule')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    const body = await res.json()
    const months = body.months.map((m: { month: number }) => m.month)
    expect(months).toEqual([...months].sort((a: number, b: number) => a - b))
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/fertilizers/tree-species/kuromatsu/schedule')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    expect(res.status).toBe(200)
  })

  it('不存在 slug → 404 NOT_FOUND', async () => {
    mockGetFertilizationScheduleBySlug.mockResolvedValueOnce(null)
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/tree-species/no-such/schedule')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-such' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/fertilizers/tree-species/kuromatsu/schedule')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

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
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/tree-species/kuromatsu/schedule')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
