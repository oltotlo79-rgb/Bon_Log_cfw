// @vitest-environment node
/**
 * GET /api/v1/bonsai、POST /api/v1/bonsai のユニットテスト
 *
 * 認証（401/403 ゲスト/403 停止）・正常系・バリデーション・レート制限を網羅する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const OWNER_ID = 'user-owner'

// ──────────────────────────────────────────────────
// Mock: prisma
// ──────────────────────────────────────────────────
const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

// ──────────────────────────────────────────────────
// Mock: rate-limit
// ──────────────────────────────────────────────────
const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

// ──────────────────────────────────────────────────
// Mock: bonsai-service
// ──────────────────────────────────────────────────
const mockListBonsaiV1 = vi.fn()
const mockCreateBonsaiV1 = vi.fn()
vi.mock('@/lib/services/bonsai-service', () => ({
  listBonsaiV1: (...args: unknown[]) => mockListBonsaiV1(...args),
  createBonsaiV1: (...args: unknown[]) => mockCreateBonsaiV1(...args),
  createBonsaiV1Schema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>
      if (!d || typeof d['name'] !== 'string' || d['name'].length === 0) {
        return { success: false, error: { issues: [{ message: 'name is required' }] } }
      }
      if (typeof d['name'] === 'string' && d['name'].length > 100) {
        return { success: false, error: { issues: [{ message: 'name too long' }] } }
      }
      return { success: true, data: { name: d['name'], species: d['species'], description: d['description'] } }
    },
  },
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
async function makeRequest(
  userId: string,
  method: 'GET' | 'POST',
  body?: unknown,
  searchParams?: Record<string, string>,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)

  const url = new URL('http://localhost/api/v1/bonsai')
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  return new NextRequest(url.toString(), {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

const mockBonsaiItem = {
  id: 'bonsai-1',
  name: '黒松',
  species: '黒松',
  acquiredAt: null,
  description: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  recordCount: 0,
  latestRecord: null,
}

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────
describe('GET /api/v1/bonsai', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListBonsaiV1.mockResolvedValue({ ok: true, items: [mockBonsaiItem], nextCursor: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + { items, nextCursor }', async () => {
    const req = await makeRequest(OWNER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/bonsai/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ items: expect.any(Array), nextCursor: null })
    expect(body.items).toHaveLength(1)
  })

  it('cursor/limit クエリパラメータが service に渡される', async () => {
    const req = await makeRequest(OWNER_ID, 'GET', undefined, { cursor: 'cur-abc', limit: '5' })
    const { GET } = await import('@/app/api/v1/bonsai/route')
    await GET(req)

    expect(mockListBonsaiV1).toHaveBeenCalledWith(OWNER_ID, 'cur-abc', 5)
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/bonsai', { method: 'GET' })
    const { GET } = await import('@/app/api/v1/bonsai/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest('http://localhost/api/v1/bonsai', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/bonsai/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウント → 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: true, email: 'owner@example.com' })
    const req = await makeRequest(OWNER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/bonsai/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過 → 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeRequest(OWNER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/bonsai/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('service が ok: false → 500 INTERNAL_ERROR', async () => {
    mockListBonsaiV1.mockResolvedValue({ ok: false, status: 500, error: '内部エラー' })
    const req = await makeRequest(OWNER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/bonsai/route')
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    const req = new NextRequest('http://localhost/api/v1/bonsai', { method: 'GET' })
    const { GET } = await import('@/app/api/v1/bonsai/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})

describe('POST /api/v1/bonsai', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockCreateBonsaiV1.mockResolvedValue({
      ok: true,
      bonsai: {
        id: 'bonsai-new',
        name: '黒松',
        species: null,
        acquiredAt: null,
        description: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recordCount: 0,
      },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 201 + 作成した盆栽', async () => {
    const req = await makeRequest(OWNER_ID, 'POST', { name: '黒松' })
    const { POST } = await import('@/app/api/v1/bonsai/route')
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('bonsai-new')
    expect(body.name).toBe('黒松')
  })

  it('name が空文字 → 400 VALIDATION_ERROR', async () => {
    const req = await makeRequest(OWNER_ID, 'POST', { name: '' })
    const { POST } = await import('@/app/api/v1/bonsai/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('name が 101 文字 → 400 VALIDATION_ERROR', async () => {
    const req = await makeRequest(OWNER_ID, 'POST', { name: 'a'.repeat(101) })
    const { POST } = await import('@/app/api/v1/bonsai/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('JSON パース失敗 → 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(OWNER_ID)
    const req = new NextRequest('http://localhost/api/v1/bonsai', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'invalid-json{',
    })
    const { POST } = await import('@/app/api/v1/bonsai/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/bonsai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '黒松' }),
    })
    const { POST } = await import('@/app/api/v1/bonsai/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest('http://localhost/api/v1/bonsai', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: '黒松' }),
    })
    const { POST } = await import('@/app/api/v1/bonsai/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過 → 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeRequest(OWNER_ID, 'POST', { name: '黒松' })
    const { POST } = await import('@/app/api/v1/bonsai/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('service が ok: false / status 400 → 400 VALIDATION_ERROR', async () => {
    mockCreateBonsaiV1.mockResolvedValue({ ok: false, status: 400, error: 'バリデーションエラー' })
    const req = await makeRequest(OWNER_ID, 'POST', { name: '黒松' })
    const { POST } = await import('@/app/api/v1/bonsai/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('service が ok: false / status 500 → 500 INTERNAL_ERROR', async () => {
    mockCreateBonsaiV1.mockResolvedValue({ ok: false, status: 500, error: '内部エラー' })
    const req = await makeRequest(OWNER_ID, 'POST', { name: '黒松' })
    const { POST } = await import('@/app/api/v1/bonsai/route')
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
