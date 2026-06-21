// @vitest-environment node
/**
 * GET /api/v1/legal — 法的文章一覧（ゲスト可）
 *
 * 200 / 401 / 429 の全分岐・ゲスト可・items フィールド・
 * sections を含まないことを検証する。
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

const mockListLegalDocuments = vi.fn()
vi.mock('@/lib/services/legal-service', () => ({
  listLegalDocuments: (...args: unknown[]) => mockListLegalDocuments(...args),
  getLegalDocument: vi.fn(),
}))

const mockItems = [
  { slug: 'tokushoho', title: '特定商取引法に基づく表記', updatedAt: '2026-01-01' },
  { slug: 'terms', title: '利用規約', updatedAt: '2026-01-01' },
  { slug: 'privacy', title: 'プライバシーポリシー', updatedAt: '2026-01-01' },
]

async function makeAuthenticatedRequest(userId: string, email: string): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest('http://localhost/api/v1/legal', {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/legal', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListLegalDocuments.mockReturnValue(mockItems)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 { items } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/legal/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(3)
  })

  it('items に { slug, title, updatedAt } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/legal/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      slug: expect.any(String),
      title: expect.any(String),
      updatedAt: expect.any(String),
    })
  })

  it('items に sections が含まれない（一覧は概要のみ）', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/legal/route')
    const res = await GET(req)

    const body = await res.json()
    for (const item of body.items) {
      expect(item).not.toHaveProperty('sections')
    }
  })

  it('ゲストユーザーも 200 を返す（rejectGuest なし）', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/legal/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/legal')
    const { GET } = await import('@/app/api/v1/legal/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/legal', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/legal/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/legal', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/legal/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/legal/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } }', async () => {
    const req = new NextRequest('http://localhost/api/v1/legal')
    const { GET } = await import('@/app/api/v1/legal/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  it('POST → 405 VALIDATION_ERROR', async () => {
    const { POST } = await import('@/app/api/v1/legal/route')
    const res = await POST()

    expect(res.status).toBe(405)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
