// @vitest-environment node
/**
 * GET /api/v1/fertilizers/tree-species/{slug}/schedule — 拡張フィールドテスト（G-1）
 *
 * レスポンスに treeSpeciesName と slug が含まれることを検証する。
 * （既存テストは months 配列のみ検証しており、これらフィールドが欠けていた）
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const USER_ID = 'user-fertilizer-ext'

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

const mockGetFertilizationScheduleBySlug = vi.fn()
vi.mock('@/lib/services/fertilizer-read-service', () => ({
  nutrientCategoryQuerySchema: {
    safeParse: () => ({ success: true, data: {} }),
  },
  treeCategoryQuerySchema: {
    safeParse: () => ({ success: true, data: {} }),
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
  listFertilizerCategories: vi.fn().mockResolvedValue({ categories: [] }),
  listTreeSpecies: vi.fn().mockResolvedValue({ species: [] }),
  getFertilizationScheduleBySlug: (...args: unknown[]) => mockGetFertilizationScheduleBySlug(...args),
}))

const MOCK_SCHEDULE = {
  id: 'ts-kuromatsu',
  name: '黒松',
  slug: 'kuromatsu',
  plans: [
    {
      month: 3,
      action: 'moderate',
      nitrogenLevel: 'balanced',
      phosphorusLevel: 'balanced',
      potassiumLevel: 'balanced',
      recommendedType: 'organic',
      description: '春の施肥',
    },
    {
      month: 9,
      action: 'light',
      nitrogenLevel: 'low',
      phosphorusLevel: 'balanced',
      potassiumLevel: 'high',
      recommendedType: 'organic',
      description: '秋の施肥',
    },
  ],
}

async function makeRequest(userId: string, slug: string): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email: 'user@example.com' })
  return new NextRequest(`http://localhost/api/v1/fertilizers/tree-species/${slug}/schedule`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/fertilizers/tree-species/{slug}/schedule — G-1 拡張フィールド', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetFertilizationScheduleBySlug.mockResolvedValue(MOCK_SCHEDULE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('レスポンスに treeSpeciesName が含まれる', async () => {
    const req = await makeRequest(USER_ID, 'kuromatsu')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('treeSpeciesName')
  })

  it('treeSpeciesName が樹種名（文字列）になる', async () => {
    const req = await makeRequest(USER_ID, 'kuromatsu')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    const body = await res.json()
    expect(body.treeSpeciesName).toBe('黒松')
    expect(typeof body.treeSpeciesName).toBe('string')
  })

  it('レスポンスに slug が含まれる', async () => {
    const req = await makeRequest(USER_ID, 'kuromatsu')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    const body = await res.json()
    expect(body).toHaveProperty('slug')
  })

  it('slug がリクエストしたスラッグと一致する', async () => {
    const req = await makeRequest(USER_ID, 'kuromatsu')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    const body = await res.json()
    expect(body.slug).toBe('kuromatsu')
    expect(typeof body.slug).toBe('string')
  })

  it('レスポンスに months 配列が含まれる（既存動作の確認）', async () => {
    const req = await makeRequest(USER_ID, 'kuromatsu')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    const body = await res.json()
    expect(Array.isArray(body.months)).toBe(true)
    expect(body.months.length).toBe(2)
  })

  it('レスポンスが { treeSpeciesName, slug, months } の 3 フィールドを持つ', async () => {
    const req = await makeRequest(USER_ID, 'kuromatsu')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    const body = await res.json()
    expect(body).toMatchObject({
      treeSpeciesName: expect.any(String),
      slug: expect.any(String),
      months: expect.any(Array),
    })
  })

  it('別の樹種（momiji）でも treeSpeciesName と slug が正しく返る', async () => {
    mockGetFertilizationScheduleBySlug.mockResolvedValueOnce({
      id: 'ts-momiji',
      name: 'もみじ',
      slug: 'momiji',
      plans: [],
    })
    const req = await makeRequest(USER_ID, 'momiji')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'momiji' }) })

    const body = await res.json()
    expect(body.treeSpeciesName).toBe('もみじ')
    expect(body.slug).toBe('momiji')
  })
})
