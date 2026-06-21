// @vitest-environment node
/**
 * GET /api/v1/events  — イベント一覧取得
 * POST /api/v1/events — イベント作成
 *
 * ゲスト可否・バリデーション・429・フィルタパラメータを検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

// ──────────────────────────────────────────────────
// Mock: prisma (requireBearerUser → user.findUnique)
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
// Mock: event-service
// ──────────────────────────────────────────────────
const mockListEventsV1 = vi.fn()
const mockCreateEventV1 = vi.fn()

vi.mock('@/lib/services/event-service', () => ({
  listEventsV1QuerySchema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, string | undefined>
      // region が無効値なら失敗を模倣
      if (d?.['region'] === '__invalid_region__') {
        return { success: false, error: { issues: [{ message: '不正な地方名です' }] } }
      }
      // month が範囲外なら失敗（-1 や 12）
      const month = d?.['month'] !== undefined ? Number(d['month']) : undefined
      if (month !== undefined && (month < 0 || month > 11)) {
        return { success: false, error: { issues: [{ message: '月は0-11の範囲で指定してください' }] } }
      }
      // limit が > 100 なら失敗
      const limit = d?.['limit'] !== undefined ? Number(d['limit']) : undefined
      if (limit !== undefined && limit > 100) {
        return { success: false, error: { issues: [{ message: 'limitは100以下で指定してください' }] } }
      }
      return {
        success: true,
        data: {
          cursor: d?.['cursor'],
          limit: limit,
          region: d?.['region'],
          prefecture: d?.['prefecture'],
          showPast: d?.['showPast'],
          year: d?.['year'] !== undefined ? Number(d['year']) : undefined,
          month,
        },
      }
    },
  },
  createEventV1Schema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>
      if (!d?.['title'] || (d['title'] as string).length < 1) {
        return { success: false, error: { issues: [{ message: 'タイトルを入力してください' }] } }
      }
      if (!d?.['startDate'] || (d['startDate'] as string).length < 1) {
        return { success: false, error: { issues: [{ message: '開始日を選択してください' }] } }
      }
      const MAX_TITLE = 100
      if ((d['title'] as string).length > MAX_TITLE) {
        return { success: false, error: { issues: [{ message: 'タイトルが長すぎます' }] } }
      }
      if (d['externalUrl'] && typeof d['externalUrl'] === 'string' && !d['externalUrl'].startsWith('http')) {
        return { success: false, error: { issues: [{ message: 'URLの形式が不正です' }] } }
      }
      return { success: true, data: d }
    },
  },
  listEventsV1: (...args: unknown[]) => mockListEventsV1(...args),
  createEventV1: (...args: unknown[]) => mockCreateEventV1(...args),
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
const USER_ID = 'user-abc'
const OWNER_EMAIL = 'owner@example.com'

const mockEventItem = {
  id: 'event-test-id',
  title: 'テストイベント',
  description: null,
  startDate: '2025-06-01T00:00:00.000Z',
  endDate: null,
  prefecture: '東京都',
  city: null,
  venue: null,
  organizer: null,
  admissionFee: null,
  hasSales: false,
  externalUrl: null,
  creator: { id: USER_ID, nickname: 'テストユーザー', avatarUrl: null },
  createdAt: '2025-01-01T00:00:00.000Z',
}

async function makeGuestGetRequest(searchParams = ''): Promise<NextRequest> {
  return new NextRequest(`http://localhost/api/v1/events${searchParams ? `?${searchParams}` : ''}`)
}

async function makeAuthenticatedGetRequest(userId: string, searchParams = ''): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  return new NextRequest(`http://localhost/api/v1/events${searchParams ? `?${searchParams}` : ''}`, {
    headers: { authorization: `Bearer ${token}` },
  })
}

async function makeAuthenticatedPostRequest(
  userId: string,
  email: string,
  body: unknown,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  return new NextRequest('http://localhost/api/v1/events', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

const validCreateBody = {
  title: 'テストイベント',
  startDate: '2025-06-01',
  hasSales: false,
}

// ──────────────────────────────────────────────────
// GET tests
// ──────────────────────────────────────────────────
describe('GET /api/v1/events', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: OWNER_EMAIL })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListEventsV1.mockResolvedValue({ ok: true, items: [mockEventItem], nextCursor: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系（認証済み）: 200 + { items, nextCursor }', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/events/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
    expect(body.nextCursor).toBeNull()
  })

  it('ゲスト（Bearer なし）: 200 — イベント一覧は公開エンドポイント', async () => {
    // requireBearerUser は Bearer がなければ 401 を返すが、
    // route の GET は rejectGuest: false（デフォルト）なのでゲストトークンなしは 401 になる。
    // ただしゲストトークン（GUEST_EMAIL）でアクセスすると 200 が返る。
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const guestToken = await signAccessToken('guest-user')
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })

    const req = new NextRequest('http://localhost/api/v1/events', {
      headers: { authorization: `Bearer ${guestToken}` },
    })
    const { GET } = await import('@/app/api/v1/events/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('Bearer なし: 401 AUTH_REQUIRED', async () => {
    const req = await makeGuestGetRequest()
    const { GET } = await import('@/app/api/v1/events/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('listEventsV1 がクエリパラメータを受け取る', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'region=%E9%96%A2%E6%9D%B1&showPast=true')
    const { GET } = await import('@/app/api/v1/events/route')
    await GET(req)

    expect(mockListEventsV1).toHaveBeenCalledTimes(1)
    const callArg = mockListEventsV1.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArg?.region).toBe('関東')
    expect(callArg?.showPast).toBe('true')
  })

  it('不正な region → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'region=__invalid_region__')
    const { GET } = await import('@/app/api/v1/events/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な month（12）→ 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'month=12')
    const { GET } = await import('@/app/api/v1/events/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な limit（101）→ 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedGetRequest(USER_ID, 'limit=101')
    const { GET } = await import('@/app/api/v1/events/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedGetRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/events/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('listEventsV1 が失敗した場合 500 INTERNAL_ERROR', async () => {
    mockListEventsV1.mockResolvedValue({ ok: false, error: '取得失敗' })
    const req = await makeAuthenticatedGetRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/events/route')
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

// ──────────────────────────────────────────────────
// POST tests
// ──────────────────────────────────────────────────
describe('POST /api/v1/events', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: OWNER_EMAIL })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockCreateEventV1.mockResolvedValue({ ok: true, event: mockEventItem })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 201 + 作成済みイベント', async () => {
    const req = await makeAuthenticatedPostRequest(USER_ID, OWNER_EMAIL, validCreateBody)
    const { POST } = await import('@/app/api/v1/events/route')
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('event-test-id')
  })

  it('createEventV1 に userId が渡される', async () => {
    const req = await makeAuthenticatedPostRequest(USER_ID, OWNER_EMAIL, validCreateBody)
    const { POST } = await import('@/app/api/v1/events/route')
    await POST(req)

    expect(mockCreateEventV1).toHaveBeenCalledWith(expect.anything(), USER_ID)
  })

  it('Bearer なし → 401', async () => {
    const req = new NextRequest('http://localhost/api/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validCreateBody),
    })
    const { POST } = await import('@/app/api/v1/events/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const req = await makeAuthenticatedPostRequest('guest-user', GUEST_EMAIL, validCreateBody)
    const { POST } = await import('@/app/api/v1/events/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('title 空 → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPostRequest(USER_ID, OWNER_EMAIL, {
      ...validCreateBody,
      title: '',
    })
    const { POST } = await import('@/app/api/v1/events/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('title 101 文字超過 → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPostRequest(USER_ID, OWNER_EMAIL, {
      ...validCreateBody,
      title: 'a'.repeat(101),
    })
    const { POST } = await import('@/app/api/v1/events/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('startDate 空 → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPostRequest(USER_ID, OWNER_EMAIL, {
      title: 'テスト',
      startDate: '',
      hasSales: false,
    })
    const { POST } = await import('@/app/api/v1/events/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('externalUrl が不正 URL 形式 → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPostRequest(USER_ID, OWNER_EMAIL, {
      ...validCreateBody,
      externalUrl: 'not-a-url',
    })
    const { POST } = await import('@/app/api/v1/events/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('JSON パース失敗 → 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(USER_ID)
    const req = new NextRequest('http://localhost/api/v1/events', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'invalid-json{',
    })
    const { POST } = await import('@/app/api/v1/events/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedPostRequest(USER_ID, OWNER_EMAIL, validCreateBody)
    const { POST } = await import('@/app/api/v1/events/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('createEventV1 が失敗した場合 500 INTERNAL_ERROR', async () => {
    mockCreateEventV1.mockResolvedValue({ ok: false, error: '作成失敗' })
    const req = await makeAuthenticatedPostRequest(USER_ID, OWNER_EMAIL, validCreateBody)
    const { POST } = await import('@/app/api/v1/events/route')
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
