// @vitest-environment node
/**
 * GET /api/v1/hormones — 植物ホルモン一覧
 * GET /api/v1/hormones/{slug} — 植物ホルモン詳細
 *
 * 200 / 400 / 401 / 404 / 429 の全分岐・ゲスト可・category フィルタ・
 * effects[]/seasonalLevels[] 含む詳細レスポンス・不存在 slug → 404 を検証する。
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

const mockListHormones = vi.fn()
const mockGetHormoneBySlug = vi.fn()
vi.mock('@/lib/services/hormone-read-service', () => ({
  hormoneCategoryQuerySchema: {
    safeParse: (input: Record<string, unknown>) => {
      const validCategories = ['major', 'secondary']
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
  listHormones: (...args: unknown[]) => mockListHormones(...args),
  getHormoneBySlug: (...args: unknown[]) => mockGetHormoneBySlug(...args),
}))

const mockHormones = [
  { id: 'h1', name: 'オーキシン', nameEn: 'Auxin', slug: 'auxin', category: 'major', chemicalFormula: 'C10H9NO2', description: '細胞伸長を促進する植物ホルモン' },
  { id: 'h2', name: 'サイトカイニン', nameEn: 'Cytokinin', slug: 'cytokinin', category: 'major', chemicalFormula: null, description: '細胞分裂を促進する植物ホルモン' },
]

const mockHormoneDetail = {
  id: 'h1',
  name: 'オーキシン',
  nameEn: 'Auxin',
  slug: 'auxin',
  category: 'major',
  chemicalFormula: 'C10H9NO2',
  description: '細胞伸長を促進する植物ホルモン',
  bonsaiRole: '根の発達促進に活用',
  productionSite: '頂端分裂組織',
  practicalTips: '発根促進剤として活用できる',
  activationMethod: '芽に塗布する',
  effects: [
    { effectName: '細胞伸長', isPromoting: true },
    { effectName: '頂芽優勢', isPromoting: true },
    { effectName: '根の発達', isPromoting: false },
  ],
  seasonalLevels: [
    { month: 3, level: 'high' },
    { month: 6, level: 'balanced' },
    { month: 9, level: 'low' },
    { month: 12, level: 'none' },
  ],
  interactions: [
    {
      id: 'int1',
      hormoneAId: 'h1',
      hormoneAName: 'オーキシン',
      hormoneASlug: 'auxin',
      hormoneBId: 'h2',
      hormoneBName: 'サイトカイニン',
      hormoneBSlug: 'cytokinin',
      type: 'synergistic',
      description: '相乗作用',
      bonsaiRelevance: '根の発達に有効',
    },
  ],
  techniques: [
    {
      id: 't1',
      techniqueKey: 'pruning',
      techniqueNameJa: '剪定',
      techniqueNameEn: 'Pruning',
      effectType: 'promote',
      magnitude: 'moderate',
      mechanism: '頂芽優勢の解除',
    },
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

describe('GET /api/v1/hormones (一覧)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListHormones.mockResolvedValue({ hormones: mockHormones })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 配列を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones')
    const { GET } = await import('@/app/api/v1/hormones/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
  })

  it('items に { id, name, nameEn, slug, category } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones')
    const { GET } = await import('@/app/api/v1/hormones/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
      category: expect.any(String),
    })
  })

  it('ゲストユーザーも 200 を返す（rejectGuest なし）', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/hormones')
    const { GET } = await import('@/app/api/v1/hormones/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('category=major フィルタが listHormones に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones', 'category=major')
    const { GET } = await import('@/app/api/v1/hormones/route')
    await GET(req)

    expect(mockListHormones).toHaveBeenCalledWith(expect.objectContaining({ category: 'major' }))
  })

  it('category=secondary フィルタが listHormones に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones', 'category=secondary')
    const { GET } = await import('@/app/api/v1/hormones/route')
    await GET(req)

    expect(mockListHormones).toHaveBeenCalledWith(expect.objectContaining({ category: 'secondary' }))
  })

  it('不正な category → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones', 'category=INVALID_CATEGORY')
    const { GET } = await import('@/app/api/v1/hormones/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/hormones')
    const { GET } = await import('@/app/api/v1/hormones/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/hormones', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/hormones/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/hormones', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/hormones/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones')
    const { GET } = await import('@/app/api/v1/hormones/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('空配列のとき [] を返す', async () => {
    mockListHormones.mockResolvedValueOnce({ hormones: [] })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones')
    const { GET } = await import('@/app/api/v1/hormones/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body).toHaveLength(0)
  })

  it('エラーレスポンス形式が { error: { code, message, status } }', async () => {
    const req = new NextRequest('http://localhost/api/v1/hormones')
    const { GET } = await import('@/app/api/v1/hormones/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})

describe('GET /api/v1/hormones/{slug} (詳細)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetHormoneBySlug.mockResolvedValue(mockHormoneDetail)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 詳細オブジェクトを返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/auxin')
    const { GET } = await import('@/app/api/v1/hormones/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
      category: expect.any(String),
    })
  })

  it('詳細に effects 配列が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/auxin')
    const { GET } = await import('@/app/api/v1/hormones/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin' }) })

    const body = await res.json()
    expect(Array.isArray(body.effects)).toBe(true)
    expect(body.effects).toHaveLength(3)
    expect(body.effects[0]).toMatchObject({
      effectName: expect.any(String),
      isPromoting: expect.any(Boolean),
    })
  })

  it('詳細に seasonalLevels 配列が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/auxin')
    const { GET } = await import('@/app/api/v1/hormones/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin' }) })

    const body = await res.json()
    expect(Array.isArray(body.seasonalLevels)).toBe(true)
    expect(body.seasonalLevels).toHaveLength(4)
    expect(body.seasonalLevels[0]).toMatchObject({
      month: expect.any(Number),
      level: expect.any(String),
    })
  })

  it('seasonalLevels が月順（昇順）で返される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/auxin')
    const { GET } = await import('@/app/api/v1/hormones/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin' }) })

    const body = await res.json()
    const months = body.seasonalLevels.map((sl: { month: number }) => sl.month)
    expect(months).toEqual([...months].sort((a: number, b: number) => a - b))
  })

  it('詳細レスポンスに interactions 配列が含まれる（H-1/H-2 後方互換）', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/auxin')
    const { GET } = await import('@/app/api/v1/hormones/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin' }) })

    const body = await res.json()
    expect(Array.isArray(body.interactions)).toBe(true)
    expect(body.interactions).toHaveLength(1)
    expect(body.interactions[0]).toMatchObject({
      id: expect.any(String),
      hormoneAId: expect.any(String),
      hormoneAName: expect.any(String),
      hormoneASlug: expect.any(String),
      hormoneBId: expect.any(String),
      hormoneBName: expect.any(String),
      hormoneBSlug: expect.any(String),
      type: expect.any(String),
    })
  })

  it('詳細レスポンスに techniques 配列が含まれる（H-1/H-2 後方互換）', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/auxin')
    const { GET } = await import('@/app/api/v1/hormones/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin' }) })

    const body = await res.json()
    expect(Array.isArray(body.techniques)).toBe(true)
    expect(body.techniques).toHaveLength(1)
    expect(body.techniques[0]).toMatchObject({
      id: expect.any(String),
      techniqueKey: 'pruning',
      techniqueNameJa: '剪定',
      effectType: expect.any(String),
      magnitude: expect.any(String),
    })
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/hormones/auxin')
    const { GET } = await import('@/app/api/v1/hormones/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin' }) })

    expect(res.status).toBe(200)
  })

  it('不存在 slug → 404 NOT_FOUND', async () => {
    mockGetHormoneBySlug.mockResolvedValueOnce(null)
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/no-such')
    const { GET } = await import('@/app/api/v1/hormones/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-such' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/hormones/auxin')
    const { GET } = await import('@/app/api/v1/hormones/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/hormones/auxin', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/hormones/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/auxin')
    const { GET } = await import('@/app/api/v1/hormones/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin' }) })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
