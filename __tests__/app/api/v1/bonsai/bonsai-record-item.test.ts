// @vitest-environment node
/**
 * PATCH /api/v1/bonsai/{id}/records/{recordId}、
 * DELETE /api/v1/bonsai/{id}/records/{recordId} のユニットテスト
 *
 * IDOR 秘匿（bonsaiId/recordId パス改ざん→404）・外部 URL 400・画像 R2 削除を網羅する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const OWNER_ID = 'user-owner'
const BONSAI_ID = 'bonsai-cjld2'
const RECORD_ID = 'record-cjld2'

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
// Mock: bonsai-record-service
// ──────────────────────────────────────────────────
const mockUpdateBonsaiRecordV1 = vi.fn()
const mockDeleteBonsaiRecordV1 = vi.fn()
vi.mock('@/lib/services/bonsai-record-service', () => ({
  listBonsaiRecordsV1: vi.fn(),
  createBonsaiRecordV1: vi.fn(),
  updateBonsaiRecordV1: (...args: unknown[]) => mockUpdateBonsaiRecordV1(...args),
  deleteBonsaiRecordV1: (...args: unknown[]) => mockDeleteBonsaiRecordV1(...args),
  updateBonsaiRecordV1Schema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>
      if (!d || typeof d !== 'object') return { success: false, error: { issues: [] } }
      // content 文字数チェック（MAX_BONSAI_DESCRIPTION_LENGTH = 2000）
      if (typeof d['content'] === 'string' && d['content'].length > 2000) {
        return { success: false, error: { issues: [{ message: 'content too long' }] } }
      }
      // mediaUrls 枚数チェック
      if (Array.isArray(d['mediaUrls']) && d['mediaUrls'].length > 4) {
        return { success: false, error: { issues: [{ message: 'too many mediaUrls' }] } }
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
  method: 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  return new NextRequest(
    `http://localhost/api/v1/bonsai/${BONSAI_ID}/records/${RECORD_ID}`,
    {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    },
  )
}

const mockRecordItem = {
  id: RECORD_ID,
  content: '更新後',
  recordAt: new Date().toISOString(),
  images: [],
}

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────
describe('PATCH /api/v1/bonsai/{id}/records/{recordId}', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockUpdateBonsaiRecordV1.mockResolvedValue({ ok: true, record: mockRecordItem })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + 更新した記録', async () => {
    const req = await makeRequest(OWNER_ID, 'PATCH', { content: '更新後' })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(RECORD_ID)
    expect(body.content).toBe('更新後')
  })

  it('所有者でない（service が 404）→ 404 NOT_FOUND（IDOR 秘匿）', async () => {
    mockUpdateBonsaiRecordV1.mockResolvedValue({ ok: false, status: 404, error: '見つかりません' })
    const req = await makeRequest(OWNER_ID, 'PATCH', { content: '更新後' })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('bonsaiId パス改ざん（service が 404）→ 404', async () => {
    mockUpdateBonsaiRecordV1.mockResolvedValue({ ok: false, status: 404, error: '見つかりません' })
    const req = await makeRequest(OWNER_ID, 'PATCH', { content: '更新後' })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await PATCH(req, {
      params: Promise.resolve({ id: 'wrong-bonsai-id', recordId: RECORD_ID }),
    })

    expect(res.status).toBe(404)
  })

  it('外部 URL（service が 400）→ 400 VALIDATION_ERROR', async () => {
    mockUpdateBonsaiRecordV1.mockResolvedValue({ ok: false, status: 400, error: '外部URLは使用できません' })
    const req = await makeRequest(OWNER_ID, 'PATCH', {
      mediaUrls: ['https://evil.example.com/spy.gif'],
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('content が 2001 文字 → 400 VALIDATION_ERROR', async () => {
    const req = await makeRequest(OWNER_ID, 'PATCH', { content: 'a'.repeat(2001) })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(mockUpdateBonsaiRecordV1).not.toHaveBeenCalled()
  })

  it('mediaUrls 5 枚超過 → 400 VALIDATION_ERROR', async () => {
    const req = await makeRequest(OWNER_ID, 'PATCH', {
      mediaUrls: [
        'https://cdn.example.com/1.webp',
        'https://cdn.example.com/2.webp',
        'https://cdn.example.com/3.webp',
        'https://cdn.example.com/4.webp',
        'https://cdn.example.com/5.webp',
      ],
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('JSON パース失敗 → 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(OWNER_ID)
    const req = new NextRequest(
      `http://localhost/api/v1/bonsai/${BONSAI_ID}/records/${RECORD_ID}`,
      {
        method: 'PATCH',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: 'invalid{json',
      },
    )
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(
      `http://localhost/api/v1/bonsai/${BONSAI_ID}/records/${RECORD_ID}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: '更新後' }),
      },
    )
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(
      `http://localhost/api/v1/bonsai/${BONSAI_ID}/records/${RECORD_ID}`,
      {
        method: 'PATCH',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ content: '更新後' }),
      },
    )
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過 → 429', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeRequest(OWNER_ID, 'PATCH', { content: '更新後' })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(429)
  })

  it('mediaUrls 指定で全置換（service が呼ばれ ok:true）', async () => {
    const req = await makeRequest(OWNER_ID, 'PATCH', {
      mediaUrls: ['https://cdn.example.com/new.webp'],
    })
    const { PATCH } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    await PATCH(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(mockUpdateBonsaiRecordV1).toHaveBeenCalledWith(
      OWNER_ID,
      BONSAI_ID,
      RECORD_ID,
      expect.objectContaining({ mediaUrls: ['https://cdn.example.com/new.webp'] }),
    )
  })
})

describe('DELETE /api/v1/bonsai/{id}/records/{recordId}', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockDeleteBonsaiRecordV1.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 { success: true }', async () => {
    const req = await makeRequest(OWNER_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('所有者でない（service が 404）→ 404 NOT_FOUND', async () => {
    mockDeleteBonsaiRecordV1.mockResolvedValue({ ok: false, status: 404, error: '見つかりません' })
    const req = await makeRequest(OWNER_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('bonsaiId パス改ざん（service が 404）→ 404', async () => {
    mockDeleteBonsaiRecordV1.mockResolvedValue({ ok: false, status: 404, error: '見つかりません' })
    const req = await makeRequest(OWNER_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await DELETE(req, {
      params: Promise.resolve({ id: 'wrong-bonsai-id', recordId: RECORD_ID }),
    })

    expect(res.status).toBe(404)
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(
      `http://localhost/api/v1/bonsai/${BONSAI_ID}/records/${RECORD_ID}`,
      { method: 'DELETE' },
    )
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(
      `http://localhost/api/v1/bonsai/${BONSAI_ID}/records/${RECORD_ID}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      },
    )
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過 → 429', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeRequest(OWNER_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(429)
  })

  it('画像 R2 削除が service 経由で呼ばれる（deleteBonsaiRecordV1 の呼び出し確認）', async () => {
    const req = await makeRequest(OWNER_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    await DELETE(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(mockDeleteBonsaiRecordV1).toHaveBeenCalledWith(OWNER_ID, BONSAI_ID, RECORD_ID)
  })

  it('service が 500 → 500 INTERNAL_ERROR', async () => {
    mockDeleteBonsaiRecordV1.mockResolvedValue({ ok: false, status: 500, error: '内部エラー' })
    const req = await makeRequest(OWNER_ID, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/bonsai/[id]/records/[recordId]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: BONSAI_ID, recordId: RECORD_ID }) })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
