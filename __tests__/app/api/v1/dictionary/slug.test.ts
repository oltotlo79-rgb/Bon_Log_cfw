// @vitest-environment node
/**
 * GET /api/v1/dictionary/{slug} — 盆栽用語辞典詳細
 *
 * 200 / 401 / 404 / 429 の全分岐・ゲスト可・description 含む・
 * prev/next/related を含む・不存在 slug → 404 を検証する。
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

const mockGetDictionaryTermBySlug = vi.fn()
vi.mock('@/lib/services/dictionary-read-service', () => ({
  dictionarySlugSchema: {
    safeParse: (input: unknown) => {
      if (typeof input !== 'string' || input.length === 0 || input.length > 100) {
        return { success: false, error: { issues: [{ message: '無効なスラッグです' }] } }
      }
      return { success: true, data: input }
    },
  },
  getDictionaryTermBySlug: (...args: unknown[]) => mockGetDictionaryTermBySlug(...args),
}))

const mockTermDetail = {
  term: {
    id: 't1',
    slug: 'bunjingi',
    term: '文人木',
    reading: 'ぶんじんぎ',
    description: '細く直立した幹が特徴の樹形',
    category: '樹形',
  },
  prev: { id: 't0', slug: 'bankan', term: '蟠幹', reading: 'ばんかん', category: '樹形' },
  next: { id: 't2', slug: 'chokkan', term: '直幹', reading: 'ちょっかん', category: '樹形' },
  related: [
    { id: 't3', slug: 'shakan', term: '斜幹', reading: 'しゃかん', category: '樹形' },
  ],
}

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  slug = 'bunjingi',
): Promise<[NextRequest, { params: Promise<{ slug: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const url = `http://localhost/api/v1/dictionary/${slug}`
  const req = new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
  const params = Promise.resolve({ slug })
  return [req, { params }]
}

describe('GET /api/v1/dictionary/{slug}', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetDictionaryTermBySlug.mockResolvedValue(mockTermDetail)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 { term, prev, next, related } を返す', async () => {
    const [req, ctx] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/dictionary/[slug]/route')
    const res = await GET(req, ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.term).toBeDefined()
    expect(body.prev).toBeDefined()
    expect(body.next).toBeDefined()
    expect(Array.isArray(body.related)).toBe(true)
  })

  it('term に description が含まれる', async () => {
    const [req, ctx] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/dictionary/[slug]/route')
    const res = await GET(req, ctx)

    const body = await res.json()
    expect(body.term).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      term: expect.any(String),
      reading: expect.any(String),
      description: expect.any(String),
      category: expect.any(String),
    })
  })

  it('related は配列として返される', async () => {
    const [req, ctx] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/dictionary/[slug]/route')
    const res = await GET(req, ctx)

    const body = await res.json()
    expect(Array.isArray(body.related)).toBe(true)
    expect(body.related).toHaveLength(1)
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const [req, ctx] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/dictionary/[slug]/route')
    const res = await GET(req, ctx)

    expect(res.status).toBe(200)
  })

  it('不存在 slug → 404 NOT_FOUND', async () => {
    mockGetDictionaryTermBySlug.mockResolvedValueOnce({ term: null, prev: null, next: null, related: [] })
    const [req, ctx] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'no-such-term')
    const { GET } = await import('@/app/api/v1/dictionary/[slug]/route')
    const res = await GET(req, ctx)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/dictionary/bunjingi')
    const { GET } = await import('@/app/api/v1/dictionary/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'bunjingi' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/dictionary/bunjingi', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/dictionary/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'bunjingi' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/dictionary/bunjingi', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/dictionary/[slug]/route')
    const res = await GET(req, { params: Promise.resolve({ slug: 'bunjingi' }) })

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
    const [req, ctx] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/dictionary/[slug]/route')
    const res = await GET(req, ctx)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
