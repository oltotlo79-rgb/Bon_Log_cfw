// @vitest-environment node
/**
 * GET /api/v1/fertilizers/tree-species/{slug}/schedule — 樹種メタ情報 + cautionNote テスト
 *
 * レスポンスに nameEn / category / description / examples / fertilizingPolicy が
 * 含まれること、months[] の各要素に cautionNote が含まれることを検証する。
 * 存在しない slug では 404 NOT_FOUND を返すことも確認する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const USER_ID = 'user-fertilizer-meta'

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
  slugQuerySchema: {
    safeParse: (input: unknown) => {
      if (typeof input !== 'string' || input.length === 0 || input.length > 100) {
        return { success: false, error: { issues: [{ message: '無効なスラッグです' }] } }
      }
      return { success: true, data: input }
    },
  },
  getFertilizationScheduleBySlug: (...args: unknown[]) => mockGetFertilizationScheduleBySlug(...args),
}))

const MOCK_SCHEDULE_WITH_META = {
  id: 'ts-kuromatsu',
  name: '黒松',
  nameEn: 'Japanese black pine',
  category: 'conifer',
  description: '松柏類の代表的な樹種',
  examples: '黒松盆栽の代表作',
  fertilizingPolicy: '年2回、春秋に施肥',
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
      cautionNote: '梅雨時期の多肥に注意',
    },
    {
      month: 9,
      action: 'light',
      nitrogenLevel: 'low',
      phosphorusLevel: 'balanced',
      potassiumLevel: 'high',
      recommendedType: 'organic',
      description: '秋の施肥',
      cautionNote: null,
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

describe('GET /api/v1/fertilizers/tree-species/{slug}/schedule — 樹種メタ情報', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetFertilizationScheduleBySlug.mockResolvedValue(MOCK_SCHEDULE_WITH_META)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('レスポンスに nameEn / category / description / examples / fertilizingPolicy が含まれる', async () => {
    const req = await makeRequest(USER_ID, 'kuromatsu')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      nameEn: 'Japanese black pine',
      category: 'conifer',
      description: '松柏類の代表的な樹種',
      examples: '黒松盆栽の代表作',
      fertilizingPolicy: '年2回、春秋に施肥',
    })
  })

  it('nameEn / description / examples / fertilizingPolicy が null のとき null をそのまま返す', async () => {
    mockGetFertilizationScheduleBySlug.mockResolvedValueOnce({
      ...MOCK_SCHEDULE_WITH_META,
      nameEn: null,
      description: null,
      examples: null,
      fertilizingPolicy: null,
    })
    const req = await makeRequest(USER_ID, 'kuromatsu')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    const body = await res.json()
    expect(body.nameEn).toBeNull()
    expect(body.description).toBeNull()
    expect(body.examples).toBeNull()
    expect(body.fertilizingPolicy).toBeNull()
  })

  it('months[] の各要素に cautionNote が含まれる（値あり・null 両方）', async () => {
    const req = await makeRequest(USER_ID, 'kuromatsu')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    const body = await res.json()
    expect(body.months[0]).toHaveProperty('cautionNote', '梅雨時期の多肥に注意')
    expect(body.months[1]).toHaveProperty('cautionNote', null)
  })

  it('存在しない slug で 404 NOT_FOUND を返す', async () => {
    mockGetFertilizationScheduleBySlug.mockResolvedValueOnce(null)
    const req = await makeRequest(USER_ID, 'no-such-species')
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-such-species' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('ゲストユーザーでもメタ情報を含む詳細を取得できる（rejectGuest なし）', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'guest-user', isSuspended: false, email: 'guest@example.com' })
    const req = new NextRequest('http://localhost/api/v1/fertilizers/tree-species/kuromatsu/schedule', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/fertilizers/tree-species/[slug]/schedule/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'kuromatsu' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.category).toBe('conifer')
  })
})
