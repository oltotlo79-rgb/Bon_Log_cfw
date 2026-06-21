// @vitest-environment node
/**
 * GET /api/v1/bonsai/care-logs および POST /api/v1/bonsai/care-logs のユニットテスト
 *
 * 認証（401/403 ゲスト拒否/403 停止）・正常系・バリデーション・
 * 所有者 404・enum 検証・期間検証・レート制限を網羅する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { BonsaiCareType } from '@prisma/client'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const OWNER_ID = 'user-care-owner'

// ──────────────────────────────────────────────────
// Mock: prisma（auth-guard の user.findUnique のみ）
// ──────────────────────────────────────────────────
const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
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
// Mock: bonsai-care-log-service
// ──────────────────────────────────────────────────
const mockListCareLogsV1 = vi.fn()
const mockCreateCareLogV1 = vi.fn()

vi.mock('@/lib/services/bonsai-care-log-service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/bonsai-care-log-service')>(
    '@/lib/services/bonsai-care-log-service',
  )
  return {
    ...actual,
    listCareLogsV1: (...args: unknown[]) => mockListCareLogsV1(...args),
    createCareLogV1: (...args: unknown[]) => mockCreateCareLogV1(...args),
  }
})

// ──────────────────────────────────────────────────
// Request ヘルパー
// ──────────────────────────────────────────────────
async function makeGetRequest(
  userId: string,
  email: string,
  searchParams: Record<string, string> = {},
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })

  const url = new URL('http://localhost/api/v1/bonsai/care-logs')
  Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v))

  return new NextRequest(url.toString(), {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

async function makePostRequest(
  userId: string,
  email: string,
  body: unknown,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })

  return new NextRequest('http://localhost/api/v1/bonsai/care-logs', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

const PAST_DATE = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const FAR_FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

const mockLogItem = {
  id: 'log-1',
  type: BonsaiCareType.pesticide,
  performedAt: new Date(PAST_DATE),
  note: null,
}

// ──────────────────────────────────────────────────
// Tests: GET /api/v1/bonsai/care-logs
// ──────────────────────────────────────────────────
describe('GET /api/v1/bonsai/care-logs', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListCareLogsV1.mockResolvedValue({ ok: true, items: [mockLogItem], nextCursor: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + { items, nextCursor } を返す', async () => {
    const req = await makeGetRequest(OWNER_ID, 'owner@example.com')
    const { GET } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ items: expect.any(Array), nextCursor: null })
    expect(body.items).toHaveLength(1)
  })

  it('items の performedAt が ISO 文字列として返される', async () => {
    const req = await makeGetRequest(OWNER_ID, 'owner@example.com')
    const { GET } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await GET(req)

    const body = await res.json()
    expect(typeof body.items[0].performedAt).toBe('string')
  })

  it('空の場合 items: [] を返す', async () => {
    mockListCareLogsV1.mockResolvedValue({ ok: true, items: [], nextCursor: null })
    const req = await makeGetRequest(OWNER_ID, 'owner@example.com')
    const { GET } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items).toHaveLength(0)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/bonsai/care-logs', { method: 'GET' })
    const { GET } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/bonsai/care-logs', {
      method: 'GET',
      headers: { authorization: 'Bearer invalid.jwt.token' },
    })
    const { GET } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })

    const req = new NextRequest('http://localhost/api/v1/bonsai/care-logs', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'u@example.com' })

    const req = new NextRequest('http://localhost/api/v1/bonsai/care-logs', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })

    const req = await makeGetRequest(OWNER_ID, 'owner@example.com')
    const { GET } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('from と to の期間フィルタが service に渡される', async () => {
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const to = new Date().toISOString()

    const req = await makeGetRequest(OWNER_ID, 'owner@example.com', { from, to })
    const { GET } = await import('@/app/api/v1/bonsai/care-logs/route')
    await GET(req)

    expect(mockListCareLogsV1).toHaveBeenCalledWith(
      OWNER_ID,
      expect.objectContaining({ from, to }),
    )
  })

  it('service が ok: false (400) のとき 400 VALIDATION_ERROR を返す', async () => {
    mockListCareLogsV1.mockResolvedValue({ ok: false, status: 400, error: '期間が長すぎます' })

    const req = await makeGetRequest(OWNER_ID, 'owner@example.com', {
      from: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
    })
    const { GET } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('service が ok: false (500) のとき 500 INTERNAL_ERROR を返す', async () => {
    mockListCareLogsV1.mockResolvedValue({ ok: false, status: 500, error: '内部エラー' })

    const req = await makeGetRequest(OWNER_ID, 'owner@example.com')
    const { GET } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    const req = new NextRequest('http://localhost/api/v1/bonsai/care-logs', { method: 'GET' })
    const { GET } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})

// ──────────────────────────────────────────────────
// Tests: POST /api/v1/bonsai/care-logs
// ──────────────────────────────────────────────────
describe('POST /api/v1/bonsai/care-logs', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockCreateCareLogV1.mockResolvedValue({ ok: true, id: 'new-log-id' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 201 + { id } を返す', async () => {
    const req = await makePostRequest(OWNER_ID, 'owner@example.com', {
      type: BonsaiCareType.pesticide,
      performedAt: PAST_DATE,
    })
    const { POST } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ id: 'new-log-id' })
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/bonsai/care-logs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: BonsaiCareType.other, performedAt: PAST_DATE }),
    })
    const { POST } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })

    const req = new NextRequest('http://localhost/api/v1/bonsai/care-logs', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ type: BonsaiCareType.other, performedAt: PAST_DATE }),
    })
    const { POST } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'u@example.com' })

    const req = new NextRequest('http://localhost/api/v1/bonsai/care-logs', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ type: BonsaiCareType.other, performedAt: PAST_DATE }),
    })
    const { POST } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('リクエストボディが JSON 形式でない場合 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(OWNER_ID)
    mockUserFindUnique.mockResolvedValueOnce({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })

    const req = new NextRequest('http://localhost/api/v1/bonsai/care-logs', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: 'not-json',
    })
    const { POST } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('type が不正な enum 値の場合 400 VALIDATION_ERROR', async () => {
    const req = await makePostRequest(OWNER_ID, 'owner@example.com', {
      type: 'invalid_care_type',
      performedAt: PAST_DATE,
    })
    const { POST } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('performedAt が未指定の場合 400 VALIDATION_ERROR', async () => {
    const req = await makePostRequest(OWNER_ID, 'owner@example.com', {
      type: BonsaiCareType.other,
    })
    const { POST } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('performedAt が ISO 日時形式でない場合 400 VALIDATION_ERROR', async () => {
    const req = await makePostRequest(OWNER_ID, 'owner@example.com', {
      type: BonsaiCareType.other,
      performedAt: '2024/01/15',
    })
    const { POST } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('service が ok: false (400) のとき 400 VALIDATION_ERROR を返す', async () => {
    mockCreateCareLogV1.mockResolvedValue({ ok: false, status: 400, error: '未来日は記録できません' })

    const req = await makePostRequest(OWNER_ID, 'owner@example.com', {
      type: BonsaiCareType.pesticide,
      performedAt: FAR_FUTURE_DATE,
    })
    const { POST } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('service が ok: false (500) のとき 500 INTERNAL_ERROR を返す', async () => {
    mockCreateCareLogV1.mockResolvedValue({ ok: false, status: 500, error: '内部エラー' })

    const req = await makePostRequest(OWNER_ID, 'owner@example.com', {
      type: BonsaiCareType.pesticide,
      performedAt: PAST_DATE,
    })
    const { POST } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })

    const req = await makePostRequest(OWNER_ID, 'owner@example.com', {
      type: BonsaiCareType.pesticide,
      performedAt: PAST_DATE,
    })
    const { POST } = await import('@/app/api/v1/bonsai/care-logs/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('全ての有効な BonsaiCareType で 201 を返す', async () => {
    const { POST } = await import('@/app/api/v1/bonsai/care-logs/route')
    const types: BonsaiCareType[] = [
      BonsaiCareType.pesticide,
      BonsaiCareType.solid_fertilizer,
      BonsaiCareType.liquid_fertilizer,
      BonsaiCareType.rotate,
      BonsaiCareType.shading,
      BonsaiCareType.muro_in,
      BonsaiCareType.muro_out,
      BonsaiCareType.other,
    ]

    for (const type of types) {
      vi.clearAllMocks()
      vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
      mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
      mockCreateCareLogV1.mockResolvedValue({ ok: true, id: `log-${type}` })

      const req = await makePostRequest(OWNER_ID, 'owner@example.com', {
        type,
        performedAt: PAST_DATE,
      })
      const res = await POST(req)
      expect(res.status).toBe(201)
    }
  })
})
