// @vitest-environment node
/**
 * GET /api/v1/fertilizers/columns — 施肥コラム一覧（F-1）
 * GET /api/v1/fertilizers/columns/{slug} — 施肥コラム詳細（F-2）
 *
 * 200 / 400 / 401 / 404 / 429 の全分岐・ゲスト可・
 * category フィルタ（指定/未指定）・カーソルページネーション・nextCursor・
 * publishedAt フィルタ・不存在 slug → 404 を検証する。
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

const mockListFertilizerColumns = vi.fn()
const mockGetFertilizerColumnBySlug = vi.fn()
vi.mock('@/lib/services/fertilizer-read-service', () => ({
  fertilizerColumnListQuerySchema: {
    safeParse: (input: Record<string, unknown>) => {
      const limit = input.limit !== undefined ? Number(input.limit) : undefined
      if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
        return { success: false, error: { issues: [{ message: 'limit は1-100の範囲で指定してください' }] } }
      }
      return {
        success: true,
        data: {
          cursor: input.cursor,
          limit,
          category: input.category,
        },
      }
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
  listFertilizerColumns: (...args: unknown[]) => mockListFertilizerColumns(...args),
  getFertilizerColumnBySlug: (...args: unknown[]) => mockGetFertilizerColumnBySlug(...args),
  listNutrients: vi.fn().mockResolvedValue({ nutrients: [] }),
  getNutrientBySlug: vi.fn().mockResolvedValue(null),
  listFertilizerCategories: vi.fn().mockResolvedValue({ categories: [] }),
  listTreeSpecies: vi.fn().mockResolvedValue({ treeSpecies: [] }),
  getFertilizationScheduleBySlug: vi.fn().mockResolvedValue(null),
  nutrientCategoryQuerySchema: {
    safeParse: () => ({ success: true, data: {} }),
  },
  treeCategoryQuerySchema: {
    safeParse: () => ({ success: true, data: {} }),
  },
}))

const mockColumns = [
  {
    id: 'fc1',
    slug: 'basic-fertilizer',
    title: '基本の施肥ガイド',
    category: 'product_guide',
    publishedAt: '2025-01-01T00:00:00.000Z',
    sortOrder: 1,
  },
  {
    id: 'fc2',
    slug: 'trouble-shooting',
    title: '施肥のトラブル対処法',
    category: 'trouble',
    publishedAt: '2025-02-01T00:00:00.000Z',
    sortOrder: 2,
  },
]

const mockColumnDetail = {
  id: 'fc1',
  slug: 'basic-fertilizer',
  title: '基本の施肥ガイド',
  content: '盆栽の施肥は春と秋が基本です。',
  category: 'product_guide',
  publishedAt: '2025-01-01T00:00:00.000Z',
  sortOrder: 1,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-15T00:00:00.000Z',
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

// ── F-1: 施肥コラム一覧 ───────────────────────────────────────

describe('GET /api/v1/fertilizers/columns (一覧)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListFertilizerColumns.mockResolvedValue({ items: mockColumns, nextCursor: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 { items, nextCursor } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(2)
    expect(body.nextCursor).toBeNull()
  })

  it('各 item に { id, slug, title, category, publishedAt, sortOrder } がある', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      id: 'fc1',
      slug: 'basic-fertilizer',
      title: '基本の施肥ガイド',
      category: 'product_guide',
      sortOrder: 1,
    })
  })

  it('publishedAt は文字列（ISO）で返る', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/route')
    const res = await GET(req)

    const body = await res.json()
    expect(typeof body.items[0]?.publishedAt).toBe('string')
  })

  it('?category=product_guide フィルタが listFertilizerColumns に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns', 'category=product_guide')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/route')
    await GET(req)

    expect(mockListFertilizerColumns).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'product_guide' }),
    )
  })

  it('category 未指定のとき category プロパティが undefined', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/route')
    await GET(req)

    const callArgs = mockListFertilizerColumns.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArgs?.category).toBeUndefined()
  })

  it('nextCursor が設定された場合 body に nextCursor が含まれる', async () => {
    mockListFertilizerColumns.mockResolvedValueOnce({ items: [mockColumns[0]], nextCursor: 'basic-fertilizer' })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.nextCursor).toBe('basic-fertilizer')
  })

  it('ゲストユーザーも 200 を返す（rejectGuest なし）', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/fertilizers/columns')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('不正な limit → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns', 'limit=999')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/fertilizers/columns')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/fertilizers/columns', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/fertilizers/columns/route')
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
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('空リスト: 200 { items: [], nextCursor: null }', async () => {
    mockListFertilizerColumns.mockResolvedValueOnce({ items: [], nextCursor: null })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items).toHaveLength(0)
    expect(body.nextCursor).toBeNull()
  })
})

// ── F-2: 施肥コラム詳細 ───────────────────────────────────────

describe('GET /api/v1/fertilizers/columns/{slug} (詳細)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetFertilizerColumnBySlug.mockResolvedValue(mockColumnDetail)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 コラム詳細を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns/basic-fertilizer')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'basic-fertilizer' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      id: 'fc1',
      slug: 'basic-fertilizer',
      title: '基本の施肥ガイド',
    })
  })

  it('詳細に content が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns/basic-fertilizer')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'basic-fertilizer' }) })

    const body = await res.json()
    expect(typeof body.content).toBe('string')
    expect(body.content.length).toBeGreaterThan(0)
  })

  it('publishedAt / createdAt / updatedAt が文字列で返る', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns/basic-fertilizer')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'basic-fertilizer' }) })

    const body = await res.json()
    expect(typeof body.publishedAt).toBe('string')
    expect(typeof body.createdAt).toBe('string')
    expect(typeof body.updatedAt).toBe('string')
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/fertilizers/columns/basic-fertilizer')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'basic-fertilizer' }) })

    expect(res.status).toBe(200)
  })

  it('不存在 slug → 404 NOT_FOUND', async () => {
    mockGetFertilizerColumnBySlug.mockResolvedValueOnce(null)
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns/no-such')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-such' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('空スラッグ → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns/')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: '' }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/fertilizers/columns/basic-fertilizer')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'basic-fertilizer' }) })

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
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/fertilizers/columns/basic-fertilizer')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'basic-fertilizer' }) })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } }', async () => {
    const req = new NextRequest('http://localhost/api/v1/fertilizers/columns/auxin-guide')
    const { GET } = await import('@/app/api/v1/fertilizers/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin-guide' }) })

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
