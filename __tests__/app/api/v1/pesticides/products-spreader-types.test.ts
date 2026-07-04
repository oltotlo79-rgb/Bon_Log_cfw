// @vitest-environment node
/**
 * GET /api/v1/pesticides/products/{slug} — spreaderTypes フィールドのユニットテスト
 *
 * PesticideDetail に追加された spreaderTypes: { id, slug, name }[] が
 * レスポンスにそのまま含まれること、展着剤 0 件で空配列になることを検証する。
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

const mockGetPesticideBySlug = vi.fn()
vi.mock('@/lib/services/pesticide-read-service', () => ({
  getPesticideBySlug: (...args: unknown[]) => mockGetPesticideBySlug(...args),
}))

const mockPesticideDetailWithSpreader = {
  id: 'p1',
  name: 'スミチオン',
  registrationNumber: '12345',
  pesticideType: 'insecticide',
  description: '有機リン系殺虫剤',
  slug: 'sumithion',
  formulationType: { name: '乳剤', code: 'EC' },
  activeIngredients: [],
  effects: [],
  incompatibilities: [],
  spreaderTypes: [
    { id: 'st1', slug: 'nonionic', name: '非イオン系' },
    { id: 'st2', slug: 'silicon', name: 'シリコン系' },
  ],
}

async function makeRequest(userId: string, email: string, slug: string): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest(`http://localhost/api/v1/pesticides/products/${slug}`, {
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/pesticides/products/{slug} — spreaderTypes', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetPesticideBySlug.mockResolvedValue(mockPesticideDetailWithSpreader)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('spreaderTypes 配列が { id, slug, name } を含めて返る', async () => {
    const req = await makeRequest('user-1', 'user@example.com', 'sumithion')
    const { GET } = await import('@/app/api/v1/pesticides/products/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'sumithion' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.spreaderTypes)).toBe(true)
    expect(body.spreaderTypes).toHaveLength(2)
    expect(body.spreaderTypes[0]).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
    })
  })

  it('展着剤が 0 件のとき spreaderTypes は空配列で返る', async () => {
    mockGetPesticideBySlug.mockResolvedValueOnce({
      ...mockPesticideDetailWithSpreader,
      spreaderTypes: [],
    })
    const req = await makeRequest('user-1', 'user@example.com', 'sumithion')
    const { GET } = await import('@/app/api/v1/pesticides/products/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'sumithion' }) })

    const body = await res.json()
    expect(body.spreaderTypes).toEqual([])
  })

  it('ゲストユーザーでも spreaderTypes を含む詳細を取得できる', async () => {
    const req = await makeRequest('guest-id', GUEST_EMAIL, 'sumithion')
    const { GET } = await import('@/app/api/v1/pesticides/products/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'sumithion' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.spreaderTypes)).toBe(true)
  })

  it('不存在 slug → 404 NOT_FOUND', async () => {
    mockGetPesticideBySlug.mockResolvedValueOnce(null)
    const req = await makeRequest('user-1', 'user@example.com', 'no-such')
    const { GET } = await import('@/app/api/v1/pesticides/products/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-such' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })
})
