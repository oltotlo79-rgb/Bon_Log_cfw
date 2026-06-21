// @vitest-environment node
/**
 * POST /api/v1/scheduled-posts/[id]/cancel のユニットテスト
 *
 * ソフトキャンセル（status→cancelled）・pending 以外→400・他人→404・ゲスト403・401 を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const USER_ID = 'user-cancel-test'
const SP_ID = 'sp-cancel-001'

// ──────────────────────────────────────────────────
// Mock: prisma（requireBearerUser が user テーブルを参照する）
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
// Mock: scheduled-post-service
// ──────────────────────────────────────────────────
const mockCancelScheduledPostV1 = vi.fn()
vi.mock('@/lib/services/scheduled-post-service', () => ({
  cancelScheduledPostV1: (...args: unknown[]) => mockCancelScheduledPostV1(...args),
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
async function makeBearerRequest(userId: string, id: string): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)

  return new NextRequest(`http://localhost/api/v1/scheduled-posts/${id}/cancel`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  })
}

async function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────
describe('POST /api/v1/scheduled-posts/[id]/cancel', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 10, resetTime: Date.now() + 60000 })
    mockCancelScheduledPostV1.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('pending 投稿のキャンセルで 200 { success: true }', async () => {
    const req = await makeBearerRequest(USER_ID, SP_ID)
    const params = await makeParams(SP_ID)
    const { POST } = await import('@/app/api/v1/scheduled-posts/[id]/cancel/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('他人/不存在 → 404 NOT_FOUND', async () => {
    mockCancelScheduledPostV1.mockResolvedValue({
      ok: false,
      error: 'キャンセル権限がありません',
      status: 404,
    })
    const req = await makeBearerRequest(USER_ID, SP_ID)
    const params = await makeParams(SP_ID)
    const { POST } = await import('@/app/api/v1/scheduled-posts/[id]/cancel/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('published 状態はキャンセル不可 → 400 VALIDATION_ERROR', async () => {
    mockCancelScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '予約中の投稿のみキャンセルできます',
      status: 400,
    })
    const req = await makeBearerRequest(USER_ID, SP_ID)
    const params = await makeParams(SP_ID)
    const { POST } = await import('@/app/api/v1/scheduled-posts/[id]/cancel/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('cancelled 状態はキャンセル不可 → 400 VALIDATION_ERROR', async () => {
    mockCancelScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '予約中の投稿のみキャンセルできます',
      status: 400,
    })
    const req = await makeBearerRequest(USER_ID, SP_ID)
    const params = await makeParams(SP_ID)
    const { POST } = await import('@/app/api/v1/scheduled-posts/[id]/cancel/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
  })

  it('failed 状態はキャンセル不可 → 400 VALIDATION_ERROR', async () => {
    mockCancelScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '予約中の投稿のみキャンセルできます',
      status: 400,
    })
    const req = await makeBearerRequest(USER_ID, SP_ID)
    const params = await makeParams(SP_ID)
    const { POST } = await import('@/app/api/v1/scheduled-posts/[id]/cancel/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/scheduled-posts/${SP_ID}/cancel`, {
      method: 'POST',
    })
    const params = await makeParams(SP_ID)
    const { POST } = await import('@/app/api/v1/scheduled-posts/[id]/cancel/route')
    const res = await POST(req, params)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest(`http://localhost/api/v1/scheduled-posts/${SP_ID}/cancel`, {
      method: 'POST',
      headers: { authorization: 'Bearer invalid.token.here' },
    })
    const params = await makeParams(SP_ID)
    const { POST } = await import('@/app/api/v1/scheduled-posts/[id]/cancel/route')
    const res = await POST(req, params)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-id')
    const req = new NextRequest(`http://localhost/api/v1/scheduled-posts/${SP_ID}/cancel`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    const params = await makeParams(SP_ID)
    const { POST } = await import('@/app/api/v1/scheduled-posts/[id]/cancel/route')
    const res = await POST(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: true, email: 'user@example.com' })
    const req = await makeBearerRequest(USER_ID, SP_ID)
    const params = await makeParams(SP_ID)
    const { POST } = await import('@/app/api/v1/scheduled-posts/[id]/cancel/route')
    const res = await POST(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, SP_ID)
    const params = await makeParams(SP_ID)
    const { POST } = await import('@/app/api/v1/scheduled-posts/[id]/cancel/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('存在しない ID は 404 NOT_FOUND', async () => {
    mockCancelScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '予約投稿が見つかりません',
      status: 404,
    })
    const req = await makeBearerRequest(USER_ID, 'nonexistent-id')
    const params = await makeParams('nonexistent-id')
    const { POST } = await import('@/app/api/v1/scheduled-posts/[id]/cancel/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
  })

  it('エラーレスポンスは { error: { code, message, status } } 形式', async () => {
    mockCancelScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '予約中の投稿のみキャンセルできます',
      status: 400,
    })
    const req = await makeBearerRequest(USER_ID, SP_ID)
    const params = await makeParams(SP_ID)
    const { POST } = await import('@/app/api/v1/scheduled-posts/[id]/cancel/route')
    const res = await POST(req, params)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  it('cancelScheduledPostV1 に正しい userId と id が渡る', async () => {
    const req = await makeBearerRequest(USER_ID, SP_ID)
    const params = await makeParams(SP_ID)
    const { POST } = await import('@/app/api/v1/scheduled-posts/[id]/cancel/route')
    await POST(req, params)
    expect(mockCancelScheduledPostV1).toHaveBeenCalledWith(USER_ID, SP_ID)
  })
})
