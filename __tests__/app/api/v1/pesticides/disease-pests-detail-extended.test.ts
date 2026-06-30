// @vitest-environment node
/**
 * GET /api/v1/pesticides/disease-pests/{slug} — effects[].pesticide 拡張フィールドテスト（G-3）
 *
 * getDiseasePestBySlug は effects[].pesticide に formulationType と activeIngredients を含む。
 * ルートはサービス結果をそのまま返すため、これらフィールドがレスポンスに含まれることを検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const USER_ID = 'user-disease-pest-ext'

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

const mockGetDiseasePestBySlug = vi.fn()
vi.mock('@/lib/services/pesticide-read-service', () => ({
  diseasePestListQuerySchema: { safeParse: () => ({ success: true, data: {} }) },
  pesticideListQuerySchema: { safeParse: () => ({ success: true, data: {} }) },
  ingredientListQuerySchema: { safeParse: () => ({ success: true, data: {} }) },
  parsePesticideTypeParam: () => undefined,
  listDiseasePests: vi.fn(),
  getDiseasePestBySlug: (...args: unknown[]) => mockGetDiseasePestBySlug(...args),
  listPesticides: vi.fn(),
  getPesticideBySlug: vi.fn(),
  listActiveIngredients: vi.fn(),
  getActiveIngredientBySlug: vi.fn(),
}))

const MOCK_DETAIL_WITH_EXTENDED_PESTICIDE = {
  id: 'dp-aphid',
  name: 'アブラムシ',
  nameKana: 'アブラムシ',
  category: 'pest',
  description: '葉に寄生する害虫',
  imageUrl: null,
  slug: 'aphid',
  effects: [
    {
      pesticide: {
        id: 'p1',
        name: 'スミチオン',
        slug: 'sumithion',
        pesticideType: 'insecticide',
        formulationType: { name: '乳剤', code: 'EC' },
        activeIngredients: [
          {
            id: 'ai1',
            name: 'フェニトロチオン',
            fracCode: null,
            iracCode: '1B',
            resistanceRisk: 'medium',
            slug: 'fenitrothion',
          },
        ],
      },
      rating: {
        preventionLevel: 'high',
        treatmentLevel: 'medium',
        efficacyLevel: null,
        persistenceLevel: 'low',
      },
    },
  ],
}

async function makeRequest(userId: string, slug: string): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email: 'user@example.com' })
  return new NextRequest(`http://localhost/api/v1/pesticides/disease-pests/${slug}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/pesticides/disease-pests/{slug} — G-3 effects[].pesticide 拡張フィールド', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetDiseasePestBySlug.mockResolvedValue(MOCK_DETAIL_WITH_EXTENDED_PESTICIDE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('200 と詳細オブジェクトを返す', async () => {
    const req = await makeRequest(USER_ID, 'aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    expect(res.status).toBe(200)
  })

  it('effects[].pesticide に formulationType が含まれる', async () => {
    const req = await makeRequest(USER_ID, 'aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    const body = await res.json()
    const pesticide = body.effects[0].pesticide
    expect(pesticide).toHaveProperty('formulationType')
  })

  it('effects[].pesticide.formulationType に name と code が含まれる', async () => {
    const req = await makeRequest(USER_ID, 'aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    const body = await res.json()
    const formulationType = body.effects[0].pesticide.formulationType
    expect(formulationType).toMatchObject({
      name: expect.any(String),
      code: expect.any(String),
    })
    expect(formulationType.name).toBe('乳剤')
    expect(formulationType.code).toBe('EC')
  })

  it('effects[].pesticide に activeIngredients 配列が含まれる', async () => {
    const req = await makeRequest(USER_ID, 'aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    const body = await res.json()
    const pesticide = body.effects[0].pesticide
    expect(pesticide).toHaveProperty('activeIngredients')
    expect(Array.isArray(pesticide.activeIngredients)).toBe(true)
  })

  it('effects[].pesticide.activeIngredients[0] に id/name/slug/iracCode が含まれる', async () => {
    const req = await makeRequest(USER_ID, 'aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    const body = await res.json()
    const ingredient = body.effects[0].pesticide.activeIngredients[0]
    expect(ingredient).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
    })
    expect(ingredient.name).toBe('フェニトロチオン')
    expect(ingredient.iracCode).toBe('1B')
  })

  it('formulationType が null の場合もそのまま返される', async () => {
    mockGetDiseasePestBySlug.mockResolvedValueOnce({
      ...MOCK_DETAIL_WITH_EXTENDED_PESTICIDE,
      effects: [
        {
          pesticide: {
            id: 'p2',
            name: 'テスト農薬',
            slug: 'test-pesticide',
            pesticideType: 'fungicide',
            formulationType: null,
            activeIngredients: [],
          },
          rating: { preventionLevel: 'low', treatmentLevel: 'low', efficacyLevel: null, persistenceLevel: 'low' },
        },
      ],
    })
    const req = await makeRequest(USER_ID, 'aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    const body = await res.json()
    expect(body.effects[0].pesticide.formulationType).toBeNull()
    expect(body.effects[0].pesticide.activeIngredients).toEqual([])
  })

  it('ルートはサービス結果をそのまま返す（変換なし）', async () => {
    const req = await makeRequest(USER_ID, 'aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    const body = await res.json()
    expect(body.id).toBe('dp-aphid')
    expect(body.name).toBe('アブラムシ')
    expect(body.slug).toBe('aphid')
  })

  it('effects 配列が 1 件の場合正しく返る', async () => {
    const req = await makeRequest(USER_ID, 'aphid')
    const { GET } = await import('@/app/api/v1/pesticides/disease-pests/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'aphid' }) })

    const body = await res.json()
    expect(body.effects).toHaveLength(1)
  })
})
