// @vitest-environment node
/**
 * GET /api/v1/hormones/interactions — 全ホルモン相互作用一覧（H-3）
 *
 * 200 / 401 / 429 の全分岐・ゲスト可・要素形・空状態を検証する。
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

const mockListHormoneInteractions = vi.fn()
vi.mock('@/lib/services/hormone-read-service', () => ({
  listHormoneInteractions: (...args: unknown[]) => mockListHormoneInteractions(...args),
}))

const mockInteractions = [
  {
    id: 'int1',
    hormoneAId: 'h1',
    hormoneAName: 'オーキシン',
    hormoneASlug: 'auxin',
    hormoneBId: 'h2',
    hormoneBName: 'サイトカイニン',
    hormoneBSlug: 'cytokinin',
    type: 'synergistic',
    description: '相乗作用の説明',
    bonsaiRelevance: '根の発達に有効',
  },
  {
    id: 'int2',
    hormoneAId: 'h1',
    hormoneAName: 'オーキシン',
    hormoneASlug: 'auxin',
    hormoneBId: 'h3',
    hormoneBName: 'アブシシン酸',
    hormoneBSlug: 'abscisic-acid',
    type: 'antagonistic',
    description: null,
    bonsaiRelevance: null,
  },
]

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest('http://localhost/api/v1/hormones/interactions', {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/hormones/interactions', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListHormoneInteractions.mockResolvedValue({ items: mockInteractions })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 { items } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/interactions/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(2)
  })

  it('各 item に { id, hormoneAId, hormoneAName, hormoneASlug, hormoneBId, hormoneBName, hormoneBSlug, type } がある', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/interactions/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      id: 'int1',
      hormoneAId: expect.any(String),
      hormoneAName: expect.any(String),
      hormoneASlug: expect.any(String),
      hormoneBId: expect.any(String),
      hormoneBName: expect.any(String),
      hormoneBSlug: expect.any(String),
      type: expect.any(String),
    })
  })

  it('description/bonsaiRelevance が null のとき null のまま返る', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/interactions/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[1]?.description).toBeNull()
    expect(body.items[1]?.bonsaiRelevance).toBeNull()
  })

  it('ゲストユーザーも 200 を返す（rejectGuest なし）', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/hormones/interactions/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('空リスト: 200 { items: [] }', async () => {
    mockListHormoneInteractions.mockResolvedValueOnce({ items: [] })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/interactions/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(0)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/hormones/interactions')
    const { GET } = await import('@/app/api/v1/hormones/interactions/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/hormones/interactions', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/hormones/interactions/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/hormones/interactions', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/hormones/interactions/route')
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
    const { GET } = await import('@/app/api/v1/hormones/interactions/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } }', async () => {
    const req = new NextRequest('http://localhost/api/v1/hormones/interactions')
    const { GET } = await import('@/app/api/v1/hormones/interactions/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
