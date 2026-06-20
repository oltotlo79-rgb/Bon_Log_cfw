// @vitest-environment node
/**
 * GET /api/v1/dictionary — 盆栽用語辞典一覧
 *
 * 200 / 400 / 401 / 429 の全分岐・ゲスト可・search/category/row フィルタ・
 * cursor/limit パラメータ・description 省略を検証する。
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

const mockListDictionaryTerms = vi.fn()
vi.mock('@/lib/services/dictionary-read-service', () => ({
  dictionaryListQuerySchema: {
    safeParse: (input: Record<string, unknown>) => {
      const validCategories = ['樹形', '技術・作業', '管理・育成', '道具・用品', '盆器・鉢', '用土・肥料', '展示・鑑賞']
      const validRows = ['あ行', 'か行', 'さ行', 'た行', 'な行', 'は行', 'ま行', 'や行', 'ら行', 'わ行']

      if (input.category !== undefined && !validCategories.includes(input.category as string)) {
        return { success: false, error: { issues: [{ message: '無効なカテゴリです' }] } }
      }
      if (input.row !== undefined && !validRows.includes(input.row as string)) {
        return { success: false, error: { issues: [{ message: '無効な行フィルタです' }] } }
      }
      const limit = input.limit !== undefined ? Number(input.limit) : 20
      if (Number.isNaN(limit) || limit < 1 || limit > 100) {
        return { success: false, error: { issues: [{ message: 'limitは1以上100以下' }] } }
      }
      return {
        success: true,
        data: {
          cursor: input.cursor,
          limit,
          search: input.search,
          category: input.category,
          row: input.row,
        },
      }
    },
  },
  listDictionaryTerms: (...args: unknown[]) => mockListDictionaryTerms(...args),
}))

const mockTerms = [
  { id: 't1', slug: 'bunjingi', term: '文人木', reading: 'ぶんじんぎ', category: '樹形' },
  { id: 't2', slug: 'chokkan', term: '直幹', reading: 'ちょっかん', category: '樹形' },
]

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  searchParams = '',
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const url = `http://localhost/api/v1/dictionary${searchParams ? `?${searchParams}` : ''}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/dictionary', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListDictionaryTerms.mockResolvedValue({ items: mockTerms, nextCursor: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 { items, nextCursor } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(2)
    expect(body.nextCursor).toBeNull()
  })

  it('items に { id, slug, term, reading, category } が含まれ description を含まない', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    const body = await res.json()
    const item = body.items[0]
    expect(item).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      term: expect.any(String),
      reading: expect.any(String),
      category: expect.any(String),
    })
    expect(item).not.toHaveProperty('description')
  })

  it('ゲストユーザーも 200 を返す（rejectGuest なし）', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('search クエリパラメータが listDictionaryTerms に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'search=黒松')
    const { GET } = await import('@/app/api/v1/dictionary/route')
    await GET(req)

    expect(mockListDictionaryTerms).toHaveBeenCalledWith(
      expect.objectContaining({ search: '黒松' }),
    )
  })

  it('category クエリパラメータが listDictionaryTerms に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'category=樹形')
    const { GET } = await import('@/app/api/v1/dictionary/route')
    await GET(req)

    expect(mockListDictionaryTerms).toHaveBeenCalledWith(
      expect.objectContaining({ category: '樹形' }),
    )
  })

  it('row クエリパラメータが listDictionaryTerms に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'row=あ行')
    const { GET } = await import('@/app/api/v1/dictionary/route')
    await GET(req)

    expect(mockListDictionaryTerms).toHaveBeenCalledWith(
      expect.objectContaining({ row: 'あ行' }),
    )
  })

  it('nextCursor が存在するとき値を返す', async () => {
    mockListDictionaryTerms.mockResolvedValueOnce({ items: mockTerms, nextCursor: 'chokkan' })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.nextCursor).toBe('chokkan')
  })

  it('不正な category → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'category=INVALID_CAT')
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な row → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'row=ぱ行')
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('limit=0 → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'limit=0')
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('limit=101 → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'limit=101')
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/dictionary')
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/dictionary', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/dictionary', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/dictionary/route')
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
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } }', async () => {
    const req = new NextRequest('http://localhost/api/v1/dictionary')
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
