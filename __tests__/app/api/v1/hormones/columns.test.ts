// @vitest-environment node
/**
 * GET /api/v1/hormones/columns — ホルモンコラム一覧（H-6）
 * GET /api/v1/hormones/columns/{slug} — ホルモンコラム詳細（H-7）
 *
 * 200 / 400 / 401 / 404 / 429 の全分岐・ゲスト可・
 * カーソルページネーション・nextCursor・publishedAt フィルタ・
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

const mockListHormoneColumns = vi.fn()
const mockGetHormoneColumnBySlug = vi.fn()
vi.mock('@/lib/services/hormone-read-service', () => ({
  hormoneColumnListQuerySchema: {
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
  listHormoneColumns: (...args: unknown[]) => mockListHormoneColumns(...args),
  getHormoneColumnBySlug: (...args: unknown[]) => mockGetHormoneColumnBySlug(...args),
}))

const mockColumns = [
  {
    id: 'col1',
    slug: 'auxin-guide',
    title: 'オーキシンガイド',
    category: 'hormone_guide',
    publishedAt: '2025-01-01T00:00:00.000Z',
    sortOrder: 1,
  },
  {
    id: 'col2',
    slug: 'cytokinin-guide',
    title: 'サイトカイニンガイド',
    category: 'hormone_guide',
    publishedAt: '2025-02-01T00:00:00.000Z',
    sortOrder: 2,
  },
]

const mockColumnDetail = {
  id: 'col1',
  slug: 'auxin-guide',
  title: 'オーキシンガイド',
  content: 'オーキシンは細胞伸長を促進します。',
  category: 'hormone_guide',
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

// ── H-6: コラム一覧 ───────────────────────────────────────────

describe('GET /api/v1/hormones/columns (一覧)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListHormoneColumns.mockResolvedValue({ items: mockColumns, nextCursor: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 { items, nextCursor } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/columns')
    const { GET } = await import('@/app/api/v1/hormones/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(2)
    expect(body.nextCursor).toBeNull()
  })

  it('各 item に { id, slug, title, category, publishedAt, sortOrder } がある', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/columns')
    const { GET } = await import('@/app/api/v1/hormones/columns/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      id: 'col1',
      slug: 'auxin-guide',
      title: 'オーキシンガイド',
      category: 'hormone_guide',
      sortOrder: 1,
    })
  })

  it('publishedAt は文字列（ISO）で返る', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/columns')
    const { GET } = await import('@/app/api/v1/hormones/columns/route')
    const res = await GET(req)

    const body = await res.json()
    expect(typeof body.items[0]?.publishedAt).toBe('string')
  })

  it('nextCursor が設定された場合 body に nextCursor が含まれる', async () => {
    mockListHormoneColumns.mockResolvedValueOnce({ items: [mockColumns[0]], nextCursor: 'auxin-guide' })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/columns')
    const { GET } = await import('@/app/api/v1/hormones/columns/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.nextCursor).toBe('auxin-guide')
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/hormones/columns')
    const { GET } = await import('@/app/api/v1/hormones/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('不正な limit → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/columns', 'limit=999')
    const { GET } = await import('@/app/api/v1/hormones/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/hormones/columns')
    const { GET } = await import('@/app/api/v1/hormones/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/hormones/columns', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/hormones/columns/route')
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
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/columns')
    const { GET } = await import('@/app/api/v1/hormones/columns/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('空リスト: 200 { items: [], nextCursor: null }', async () => {
    mockListHormoneColumns.mockResolvedValueOnce({ items: [], nextCursor: null })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/columns')
    const { GET } = await import('@/app/api/v1/hormones/columns/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items).toHaveLength(0)
    expect(body.nextCursor).toBeNull()
  })
})

// ── H-7: コラム詳細 ───────────────────────────────────────────

describe('GET /api/v1/hormones/columns/{slug} (詳細)', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetHormoneColumnBySlug.mockResolvedValue(mockColumnDetail)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 コラム詳細を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/columns/auxin-guide')
    const { GET } = await import('@/app/api/v1/hormones/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin-guide' }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      id: 'col1',
      slug: 'auxin-guide',
      title: 'オーキシンガイド',
    })
  })

  it('詳細に content が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/columns/auxin-guide')
    const { GET } = await import('@/app/api/v1/hormones/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin-guide' }) })

    const body = await res.json()
    expect(typeof body.content).toBe('string')
    expect(body.content.length).toBeGreaterThan(0)
  })

  it('publishedAt / createdAt / updatedAt が文字列で返る', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/columns/auxin-guide')
    const { GET } = await import('@/app/api/v1/hormones/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin-guide' }) })

    const body = await res.json()
    expect(typeof body.publishedAt).toBe('string')
    expect(typeof body.createdAt).toBe('string')
    expect(typeof body.updatedAt).toBe('string')
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, '/api/v1/hormones/columns/auxin-guide')
    const { GET } = await import('@/app/api/v1/hormones/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin-guide' }) })

    expect(res.status).toBe(200)
  })

  it('不存在 slug → 404 NOT_FOUND', async () => {
    mockGetHormoneColumnBySlug.mockResolvedValueOnce(null)
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/columns/no-such')
    const { GET } = await import('@/app/api/v1/hormones/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'no-such' }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('空スラッグ → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/columns/')
    const { GET } = await import('@/app/api/v1/hormones/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: '' }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/hormones/columns/auxin-guide')
    const { GET } = await import('@/app/api/v1/hormones/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin-guide' }) })

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
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '/api/v1/hormones/columns/auxin-guide')
    const { GET } = await import('@/app/api/v1/hormones/columns/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'auxin-guide' }) })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
