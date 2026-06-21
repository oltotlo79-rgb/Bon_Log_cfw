// @vitest-environment node
/**
 * GET /api/v1/bonsai/{id}/records、POST /api/v1/bonsai/{id}/records のユニットテスト
 *
 * 所有者 404・ゲスト 403・401・mediaUrls 検証・枚数上限・recordAt 必須を網羅する。
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
const mockListBonsaiRecordsV1 = vi.fn()
const mockCreateBonsaiRecordV1 = vi.fn()
vi.mock('@/lib/services/bonsai-record-service', () => ({
  listBonsaiRecordsV1: (...args: unknown[]) => mockListBonsaiRecordsV1(...args),
  createBonsaiRecordV1: (...args: unknown[]) => mockCreateBonsaiRecordV1(...args),
  // updateBonsaiRecordV1 / deleteBonsaiRecordV1 はこのファイルで使わない
  updateBonsaiRecordV1: vi.fn(),
  deleteBonsaiRecordV1: vi.fn(),
  createBonsaiRecordV1Schema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>
      if (!d || typeof d !== 'object') return { success: false, error: { issues: [] } }
      if (!d['recordAt']) return { success: false, error: { issues: [{ message: 'recordAt is required' }] } }
      // mediaUrls 枚数チェック（MAX_BONSAI_RECORD_IMAGES = 4）
      const urls = d['mediaUrls']
      if (Array.isArray(urls) && urls.length > 4) {
        return { success: false, error: { issues: [{ message: 'too many mediaUrls' }] } }
      }
      return {
        success: true,
        data: {
          recordAt: d['recordAt'] as string,
          content: d['content'],
          mediaUrls: Array.isArray(urls) ? urls : [],
        },
      }
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

  const url = new URL(`http://localhost/api/v1/bonsai/${BONSAI_ID}/records`)
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

const mockRecordItem = {
  id: RECORD_ID,
  content: 'テスト記録',
  recordAt: new Date().toISOString(),
  images: [],
}

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────
describe('GET /api/v1/bonsai/{id}/records', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListBonsaiRecordsV1.mockResolvedValue({ ok: true, items: [mockRecordItem], nextCursor: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + { items: [{id, content, recordAt, images}], nextCursor }', async () => {
    const req = await makeRequest(OWNER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await GET(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ items: expect.any(Array), nextCursor: null })
    expect(body.items[0]).toMatchObject({ id: RECORD_ID, content: 'テスト記録', images: [] })
  })

  it('他人 bonsai（service が 404）→ 404 NOT_FOUND', async () => {
    mockListBonsaiRecordsV1.mockResolvedValue({ ok: false, status: 404, error: '見つかりません' })
    const req = await makeRequest(OWNER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await GET(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/bonsai/${BONSAI_ID}/records`, { method: 'GET' })
    const { GET } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await GET(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(`http://localhost/api/v1/bonsai/${BONSAI_ID}/records`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await GET(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('cursor/limit クエリパラメータが service に渡される', async () => {
    const req = await makeRequest(OWNER_ID, 'GET', undefined, { cursor: 'cur-abc', limit: '5' })
    const { GET } = await import('@/app/api/v1/bonsai/[id]/records/route')
    await GET(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(mockListBonsaiRecordsV1).toHaveBeenCalledWith(OWNER_ID, BONSAI_ID, 'cur-abc', 5)
  })

  it('レート制限超過 → 429', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeRequest(OWNER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await GET(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(429)
  })

  it('service が 500 → 500 INTERNAL_ERROR', async () => {
    mockListBonsaiRecordsV1.mockResolvedValue({ ok: false, status: 500, error: '内部エラー' })
    const req = await makeRequest(OWNER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await GET(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

describe('POST /api/v1/bonsai/{id}/records', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockCreateBonsaiRecordV1.mockResolvedValue({ ok: true, record: mockRecordItem })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 201 + 作成した記録', async () => {
    const req = await makeRequest(OWNER_ID, 'POST', {
      recordAt: '2024-03-01T00:00:00.000Z',
      mediaUrls: [],
    })
    const { POST } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await POST(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(RECORD_ID)
  })

  it('recordAt が未指定 → 400 VALIDATION_ERROR', async () => {
    const req = await makeRequest(OWNER_ID, 'POST', { content: 'テスト', mediaUrls: [] })
    const { POST } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await POST(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(mockCreateBonsaiRecordV1).not.toHaveBeenCalled()
  })

  it('mediaUrls 5 枚超過 → 400 VALIDATION_ERROR', async () => {
    const req = await makeRequest(OWNER_ID, 'POST', {
      recordAt: '2024-03-01T00:00:00.000Z',
      mediaUrls: [
        'https://cdn.example.com/1.webp',
        'https://cdn.example.com/2.webp',
        'https://cdn.example.com/3.webp',
        'https://cdn.example.com/4.webp',
        'https://cdn.example.com/5.webp',
      ],
    })
    const { POST } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await POST(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('他人 bonsai（service が 404）→ 404 NOT_FOUND', async () => {
    mockCreateBonsaiRecordV1.mockResolvedValue({ ok: false, status: 404, error: '見つかりません' })
    const req = await makeRequest(OWNER_ID, 'POST', {
      recordAt: '2024-03-01T00:00:00.000Z',
      mediaUrls: [],
    })
    const { POST } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await POST(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('外部 URL（service が 400）→ 400 VALIDATION_ERROR', async () => {
    mockCreateBonsaiRecordV1.mockResolvedValue({ ok: false, status: 400, error: '外部URLは使用できません' })
    const req = await makeRequest(OWNER_ID, 'POST', {
      recordAt: '2024-03-01T00:00:00.000Z',
      mediaUrls: ['https://evil.example.com/spy.gif'],
    })
    const { POST } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await POST(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/bonsai/${BONSAI_ID}/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recordAt: '2024-03-01T00:00:00.000Z', mediaUrls: [] }),
    })
    const { POST } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await POST(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(`http://localhost/api/v1/bonsai/${BONSAI_ID}/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ recordAt: '2024-03-01T00:00:00.000Z', mediaUrls: [] }),
    })
    const { POST } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await POST(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過 → 429', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeRequest(OWNER_ID, 'POST', {
      recordAt: '2024-03-01T00:00:00.000Z',
      mediaUrls: [],
    })
    const { POST } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await POST(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(429)
  })

  it('JSON パース失敗 → 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(OWNER_ID)
    const req = new NextRequest(`http://localhost/api/v1/bonsai/${BONSAI_ID}/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'invalid{json',
    })
    const { POST } = await import('@/app/api/v1/bonsai/[id]/records/route')
    const res = await POST(req, { params: Promise.resolve({ id: BONSAI_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
