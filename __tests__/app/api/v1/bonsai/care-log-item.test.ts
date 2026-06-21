// @vitest-environment node
/**
 * PATCH /api/v1/bonsai/care-logs/[logId] および
 * DELETE /api/v1/bonsai/care-logs/[logId] のユニットテスト
 *
 * 所有者チェック（404）・ゲスト拒否（403）・認証エラー（401）・
 * バリデーション（400）・レート制限（429）・正常系（200）を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { BonsaiCareType } from '@prisma/client'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const OWNER_ID = 'user-care-owner-2'
const LOG_ID = 'log-target-abc'

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
const mockUpdateCareLogV1 = vi.fn()
const mockDeleteCareLogV1 = vi.fn()

vi.mock('@/lib/services/bonsai-care-log-service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/bonsai-care-log-service')>(
    '@/lib/services/bonsai-care-log-service',
  )
  return {
    ...actual,
    updateCareLogV1: (...args: unknown[]) => mockUpdateCareLogV1(...args),
    deleteCareLogV1: (...args: unknown[]) => mockDeleteCareLogV1(...args),
  }
})

// ──────────────────────────────────────────────────
// Request ヘルパー
// ──────────────────────────────────────────────────
const ROUTE_PARAMS = { params: Promise.resolve({ logId: LOG_ID }) }

async function makePatchRequest(
  userId: string,
  email: string,
  logId: string,
  body: unknown,
): Promise<[NextRequest, typeof ROUTE_PARAMS]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })

  const req = new NextRequest(`http://localhost/api/v1/bonsai/care-logs/${logId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return [req, { params: Promise.resolve({ logId }) }]
}

async function makeDeleteRequest(
  userId: string,
  email: string,
  logId: string,
): Promise<[NextRequest, typeof ROUTE_PARAMS]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })

  const req = new NextRequest(`http://localhost/api/v1/bonsai/care-logs/${logId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ logId }) }]
}

const FAR_FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

// ──────────────────────────────────────────────────
// Tests: PATCH /api/v1/bonsai/care-logs/[logId]
// ──────────────────────────────────────────────────
describe('PATCH /api/v1/bonsai/care-logs/[logId]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockUpdateCareLogV1.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + { success: true } を返す', async () => {
    const [req, params] = await makePatchRequest(OWNER_ID, 'owner@example.com', LOG_ID, {
      type: BonsaiCareType.solid_fertilizer,
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true })
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/bonsai/care-logs/${LOG_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: BonsaiCareType.other }),
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await PATCH(req, ROUTE_PARAMS)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })

    const req = new NextRequest(`http://localhost/api/v1/bonsai/care-logs/${LOG_ID}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ type: BonsaiCareType.other }),
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await PATCH(req, ROUTE_PARAMS)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'u@example.com' })

    const req = new NextRequest(`http://localhost/api/v1/bonsai/care-logs/${LOG_ID}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ type: BonsaiCareType.other }),
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await PATCH(req, ROUTE_PARAMS)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('リクエストボディが JSON 形式でない場合 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(OWNER_ID)
    mockUserFindUnique.mockResolvedValueOnce({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })

    const req = new NextRequest(`http://localhost/api/v1/bonsai/care-logs/${LOG_ID}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: 'not-json-body',
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await PATCH(req, ROUTE_PARAMS)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な type 値で 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makePatchRequest(OWNER_ID, 'owner@example.com', LOG_ID, {
      type: 'invalid_type',
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('service が ok: false (404) のとき 404 NOT_FOUND を返す（他人/不存在の logId）', async () => {
    mockUpdateCareLogV1.mockResolvedValue({ ok: false, status: 404, error: '手入れ記録が見つかりません' })

    const [req, params] = await makePatchRequest(OWNER_ID, 'owner@example.com', 'other-log', {
      type: BonsaiCareType.other,
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('service が ok: false (400) のとき 400 VALIDATION_ERROR を返す（未来日）', async () => {
    mockUpdateCareLogV1.mockResolvedValue({ ok: false, status: 400, error: '未来日は記録できません' })

    const [req, params] = await makePatchRequest(OWNER_ID, 'owner@example.com', LOG_ID, {
      performedAt: FAR_FUTURE_DATE,
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('service が ok: false (500) のとき 500 INTERNAL_ERROR を返す', async () => {
    mockUpdateCareLogV1.mockResolvedValue({ ok: false, status: 500, error: '内部エラー' })

    const [req, params] = await makePatchRequest(OWNER_ID, 'owner@example.com', LOG_ID, {
      type: BonsaiCareType.other,
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await PATCH(req, params)

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

    const [req, params] = await makePatchRequest(OWNER_ID, 'owner@example.com', LOG_ID, {
      note: '更新メモ',
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('logId が service に渡される', async () => {
    const [req, params] = await makePatchRequest(OWNER_ID, 'owner@example.com', LOG_ID, {
      type: BonsaiCareType.shading,
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    await PATCH(req, params)

    expect(mockUpdateCareLogV1).toHaveBeenCalledWith(
      OWNER_ID,
      LOG_ID,
      expect.any(Object),
    )
  })

  it('note を null に更新できる', async () => {
    const [req, params] = await makePatchRequest(OWNER_ID, 'owner@example.com', LOG_ID, {
      note: null,
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(200)
  })
})

// ──────────────────────────────────────────────────
// Tests: DELETE /api/v1/bonsai/care-logs/[logId]
// ──────────────────────────────────────────────────
describe('DELETE /api/v1/bonsai/care-logs/[logId]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockDeleteCareLogV1.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + { success: true } を返す', async () => {
    const [req, params] = await makeDeleteRequest(OWNER_ID, 'owner@example.com', LOG_ID)
    const { DELETE } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true })
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/bonsai/care-logs/${LOG_ID}`, {
      method: 'DELETE',
    })
    const { DELETE } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await DELETE(req, ROUTE_PARAMS)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })

    const req = new NextRequest(`http://localhost/api/v1/bonsai/care-logs/${LOG_ID}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    const { DELETE } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await DELETE(req, ROUTE_PARAMS)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'u@example.com' })

    const req = new NextRequest(`http://localhost/api/v1/bonsai/care-logs/${LOG_ID}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    const { DELETE } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await DELETE(req, ROUTE_PARAMS)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('service が ok: false (404) のとき 404 NOT_FOUND を返す（他人/不存在の logId）', async () => {
    mockDeleteCareLogV1.mockResolvedValue({ ok: false, status: 404, error: '手入れ記録が見つかりません' })

    const [req, params] = await makeDeleteRequest(OWNER_ID, 'owner@example.com', 'other-log-id')
    const { DELETE } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('service が ok: false (500) のとき 500 INTERNAL_ERROR を返す', async () => {
    mockDeleteCareLogV1.mockResolvedValue({ ok: false, status: 500, error: '内部エラー' })

    const [req, params] = await makeDeleteRequest(OWNER_ID, 'owner@example.com', LOG_ID)
    const { DELETE } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await DELETE(req, params)

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

    const [req, params] = await makeDeleteRequest(OWNER_ID, 'owner@example.com', LOG_ID)
    const { DELETE } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('logId が service に渡される', async () => {
    const [req, params] = await makeDeleteRequest(OWNER_ID, 'owner@example.com', LOG_ID)
    const { DELETE } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    await DELETE(req, params)

    expect(mockDeleteCareLogV1).toHaveBeenCalledWith(OWNER_ID, LOG_ID)
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    const req = new NextRequest(`http://localhost/api/v1/bonsai/care-logs/${LOG_ID}`, {
      method: 'DELETE',
    })
    const { DELETE } = await import('@/app/api/v1/bonsai/care-logs/[logId]/route')
    const res = await DELETE(req, ROUTE_PARAMS)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
