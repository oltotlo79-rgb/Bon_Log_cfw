// @vitest-environment node
/**
 * GET /api/v1/bonsai/{id}、PATCH /api/v1/bonsai/{id}、DELETE /api/v1/bonsai/{id} のユニットテスト
 *
 * 所有者 404・ゲスト 403・401・バリデーション・acquiredAt:null クリアを網羅する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const OWNER_ID = 'user-owner'
const BONSAI_ID = 'bonsai-cjld2'

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
const mockGetBonsaiV1 = vi.fn()
const mockUpdateBonsaiV1 = vi.fn()
const mockDeleteBonsaiV1 = vi.fn()
vi.mock('@/lib/services/bonsai-service', () => ({
  getBonsaiV1: (...args: unknown[]) => mockGetBonsaiV1(...args),
  updateBonsaiV1: (...args: unknown[]) => mockUpdateBonsaiV1(...args),
  deleteBonsaiV1: (...args: unknown[]) => mockDeleteBonsaiV1(...args),
  updateBonsaiV1Schema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>
      if (!d || typeof d !== 'object') return { success: false, error: { issues: [] } }
      if (typeof d['name'] === 'string' && d['name'].length > 100) {
        return { success: false, error: { issues: [{ message: 'name too long' }] } }
      }
      return { success: true, data: d }
    },
  },
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
async function makeRequest(
  userId: string,
  method: 'GET' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  return new NextRequest(`http://localhost/api/v1/bonsai/${BONSAI_ID}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

const mockBonsaiDetail = {
  id: BONSAI_ID,
  name: '黒松',
  species: '黒松',
  acquiredAt: null,
  description: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  recordCount: 3,
}

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────
describe('GET /api/v1/bonsai/{id}', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetBonsaiV1.mockResolvedValue({ ok: true, bonsai: mockBonsaiDetail })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + 盆栽詳細', async () => {
    const req = await makeRequest(OWNER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(BONSAI_ID)
    expect(body.name).toBe('黒松')
  })

  it('他人の盆栽（service が 404）→ 404 NOT_FOUND', async () => {
    mockGetBonsaiV1.mockResolvedValue({ ok: false, status: 404, error: '見つかりません' })
    const req = await makeRequest(OWNER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/bonsai/${BONSAI_ID}`, { method: 'GET' })
    const { GET } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(`http://localhost/api/v1/bonsai/${BONSAI_ID}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過 → 429', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeRequest(OWNER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(429)
  })

  it('service が 500 → 500 INTERNAL_ERROR', async () => {
    mockGetBonsaiV1.mockResolvedValue({ ok: false, status: 500, error: '内部エラー' })
    const req = await makeRequest(OWNER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('パスパラメータ id が空文字 → 400 バリデーションエラー（service 未呼び出し）', async () => {
    const req = await makeRequest(OWNER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: '' }) })

    expect(res.status).toBe(400)
    expect(mockGetBonsaiV1).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/v1/bonsai/{id}', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockUpdateBonsaiV1.mockResolvedValue({ ok: true, bonsai: { ...mockBonsaiDetail, name: '更新後' } })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + 更新した盆栽', async () => {
    const req = await makeRequest(OWNER_ID, 'PATCH', { name: '更新後' })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('更新後')
  })

  it('acquiredAt: null を渡す → service に null が届く', async () => {
    const req = await makeRequest(OWNER_ID, 'PATCH', { acquiredAt: null })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/route')
    await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(mockUpdateBonsaiV1).toHaveBeenCalledWith(
      OWNER_ID,
      BONSAI_ID,
      expect.objectContaining({ acquiredAt: null }),
    )
  })

  it('name が 101 文字 → 400 VALIDATION_ERROR', async () => {
    const req = await makeRequest(OWNER_ID, 'PATCH', { name: 'a'.repeat(101) })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(mockUpdateBonsaiV1).not.toHaveBeenCalled()
  })

  it('JSON パース失敗 → 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(OWNER_ID)
    const req = new NextRequest(`http://localhost/api/v1/bonsai/${BONSAI_ID}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'invalid{json',
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('他人の盆栽（service が 404）→ 404 NOT_FOUND', async () => {
    mockUpdateBonsaiV1.mockResolvedValue({ ok: false, status: 404, error: '見つかりません' })
    const req = await makeRequest(OWNER_ID, 'PATCH', { name: '更新後' })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/bonsai/${BONSAI_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '更新後' }),
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(`http://localhost/api/v1/bonsai/${BONSAI_ID}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: '更新後' }),
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過 → 429', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeRequest(OWNER_ID, 'PATCH', { name: '更新後' })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(429)
  })

  it('パスパラメータ id が空文字 → 400 バリデーションエラー（service 未呼び出し）', async () => {
    const req = await makeRequest(OWNER_ID, 'PATCH', { name: '更新後' })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: '' }) })

    expect(res.status).toBe(400)
    expect(mockUpdateBonsaiV1).not.toHaveBeenCalled()
  })

  it('service が 400 を返す → 400 VALIDATION_ERROR（サービス層のドメイン検証失敗）', async () => {
    mockUpdateBonsaiV1.mockResolvedValue({ ok: false, status: 400, error: 'ドメイン検証エラー' })
    const req = await makeRequest(OWNER_ID, 'PATCH', { name: '更新後' })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('service が 500 を返す → 500 INTERNAL_ERROR', async () => {
    mockUpdateBonsaiV1.mockResolvedValue({ ok: false, status: 500, error: '内部エラー' })
    const req = await makeRequest(OWNER_ID, 'PATCH', { name: '更新後' })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

describe('DELETE /api/v1/bonsai/{id}', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockDeleteBonsaiV1.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 { success: true }', async () => {
    const req = await makeRequest(OWNER_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('他人の盆栽（service が 404）→ 404 NOT_FOUND', async () => {
    mockDeleteBonsaiV1.mockResolvedValue({ ok: false, status: 404, error: '見つかりません' })
    const req = await makeRequest(OWNER_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/bonsai/${BONSAI_ID}`, { method: 'DELETE' })
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(`http://localhost/api/v1/bonsai/${BONSAI_ID}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過 → 429', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeRequest(OWNER_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(429)
  })

  it('deleteMediaFiles（カスケード）が呼ばれたことを service 越しに検証', async () => {
    const req = await makeRequest(OWNER_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/route')
    await DELETE(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(mockDeleteBonsaiV1).toHaveBeenCalledWith(OWNER_ID, BONSAI_ID)
  })

  it('パスパラメータ id が空文字 → 400 バリデーションエラー（service 未呼び出し）', async () => {
    const req = await makeRequest(OWNER_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: '' }) })

    expect(res.status).toBe(400)
    expect(mockDeleteBonsaiV1).not.toHaveBeenCalled()
  })

  it('service が 500 を返す → 500 INTERNAL_ERROR', async () => {
    mockDeleteBonsaiV1.mockResolvedValue({ ok: false, status: 500, error: '内部エラー' })
    const req = await makeRequest(OWNER_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
