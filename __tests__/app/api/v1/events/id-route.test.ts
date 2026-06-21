// @vitest-environment node
/**
 * GET    /api/v1/events/{id} — イベント詳細取得（ゲスト可）
 * PATCH  /api/v1/events/{id} — イベント更新（作成者のみ）
 * DELETE /api/v1/events/{id} — イベント削除（作成者のみ・204 ボディなし）
 *
 * 所有権チェック・403/404 区別・DELETE 204・ゲスト可否を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

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
// Mock: event-service
// ──────────────────────────────────────────────────
const mockGetEventV1 = vi.fn()
const mockUpdateEventV1 = vi.fn()
const mockDeleteEventV1 = vi.fn()

vi.mock('@/lib/services/event-service', () => ({
  updateEventV1Schema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>
      if (d?.['externalUrl'] && typeof d['externalUrl'] === 'string' && !d['externalUrl'].startsWith('http')) {
        return { success: false, error: { issues: [{ message: 'URLの形式が不正です' }] } }
      }
      return { success: true, data: d }
    },
  },
  getEventV1: (...args: unknown[]) => mockGetEventV1(...args),
  updateEventV1: (...args: unknown[]) => mockUpdateEventV1(...args),
  deleteEventV1: (...args: unknown[]) => mockDeleteEventV1(...args),
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
const OWNER_ID = 'user-owner'
const OTHER_ID = 'user-other'
const VALID_EVENT_ID = 'event-cjld2cyuq001'

const mockEventDetail = {
  id: VALID_EVENT_ID,
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
  creator: { id: OWNER_ID, nickname: 'オーナー', avatarUrl: null },
  createdAt: '2025-01-01T00:00:00.000Z',
}

async function makeAuthenticatedGetRequest(
  userId: string,
  eventId: string,
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const req = new NextRequest(`http://localhost/api/v1/events/${eventId}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ id: eventId }) }]
}

async function makeAuthenticatedPatchRequest(
  userId: string,
  eventId: string,
  body: unknown,
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const req = new NextRequest(`http://localhost/api/v1/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return [req, { params: Promise.resolve({ id: eventId }) }]
}

async function makeAuthenticatedDeleteRequest(
  userId: string,
  eventId: string,
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const req = new NextRequest(`http://localhost/api/v1/events/${eventId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ id: eventId }) }]
}

// ──────────────────────────────────────────────────
// GET /api/v1/events/{id}
// ──────────────────────────────────────────────────
describe('GET /api/v1/events/[id]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetEventV1.mockResolvedValue({ ok: true, event: mockEventDetail })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + イベント詳細（creator 付き）', async () => {
    const [req, params] = await makeAuthenticatedGetRequest(OWNER_ID, VALID_EVENT_ID)
    const { GET } = await import('@/app/api/v1/events/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(VALID_EVENT_ID)
    expect(body.creator).toBeTruthy()
    expect(body.creator.id).toBe(OWNER_ID)
  })

  it('ゲストトークンでもアクセス可（イベント詳細は公開）', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const guestToken = await signAccessToken('guest-user')
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })

    const req = new NextRequest(`http://localhost/api/v1/events/${VALID_EVENT_ID}`, {
      headers: { authorization: `Bearer ${guestToken}` },
    })
    const { GET } = await import('@/app/api/v1/events/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: VALID_EVENT_ID }) })

    expect(res.status).toBe(200)
  })

  it('Bearer なし → 401', async () => {
    const req = new NextRequest(`http://localhost/api/v1/events/${VALID_EVENT_ID}`)
    const { GET } = await import('@/app/api/v1/events/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: VALID_EVENT_ID }) })

    expect(res.status).toBe(401)
  })

  it('isHidden または不存在 → 404 NOT_FOUND', async () => {
    mockGetEventV1.mockResolvedValue({ ok: false, error: 'イベントが見つかりません' })
    const [req, params] = await makeAuthenticatedGetRequest(OWNER_ID, 'nonexistent-event')
    const { GET } = await import('@/app/api/v1/events/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const [req, params] = await makeAuthenticatedGetRequest(OWNER_ID, VALID_EVENT_ID)
    const { GET } = await import('@/app/api/v1/events/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('getEventV1 に正しい eventId が渡される', async () => {
    const [req, params] = await makeAuthenticatedGetRequest(OWNER_ID, VALID_EVENT_ID)
    const { GET } = await import('@/app/api/v1/events/[id]/route')
    await GET(req, params)

    expect(mockGetEventV1).toHaveBeenCalledWith(VALID_EVENT_ID)
  })
})

// ──────────────────────────────────────────────────
// PATCH /api/v1/events/{id}
// ──────────────────────────────────────────────────
describe('PATCH /api/v1/events/[id]', () => {
  const validPatchBody = { title: '更新後タイトル' }

  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockUpdateEventV1.mockResolvedValue({ ok: true, event: { ...mockEventDetail, title: '更新後タイトル' } })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + 更新済みイベント', async () => {
    const [req, params] = await makeAuthenticatedPatchRequest(OWNER_ID, VALID_EVENT_ID, validPatchBody)
    const { PATCH } = await import('@/app/api/v1/events/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('更新後タイトル')
  })

  it('Bearer なし → 401', async () => {
    const req = new NextRequest(`http://localhost/api/v1/events/${VALID_EVENT_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPatchBody),
    })
    const { PATCH } = await import('@/app/api/v1/events/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: VALID_EVENT_ID }) })

    expect(res.status).toBe(401)
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(`http://localhost/api/v1/events/${VALID_EVENT_ID}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(validPatchBody),
    })
    const { PATCH } = await import('@/app/api/v1/events/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: VALID_EVENT_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('他人のイベント → 403（ERR_EDIT_PERMISSION_DENIED）', async () => {
    const { ERR_EDIT_PERMISSION_DENIED } = await import('@/lib/constants/errors')
    mockUpdateEventV1.mockResolvedValue({ ok: false, error: ERR_EDIT_PERMISSION_DENIED })

    const [req, params] = await makeAuthenticatedPatchRequest(OTHER_ID, VALID_EVENT_ID, validPatchBody)
    mockUserFindUnique.mockResolvedValue({ id: OTHER_ID, isSuspended: false, email: 'other@example.com' })
    const { PATCH } = await import('@/app/api/v1/events/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(403)
  })

  it('不存在イベント → 404 NOT_FOUND', async () => {
    const { ERR_EVENT_NOT_FOUND } = await import('@/lib/constants/errors')
    mockUpdateEventV1.mockResolvedValue({ ok: false, error: ERR_EVENT_NOT_FOUND })

    const [req, params] = await makeAuthenticatedPatchRequest(OWNER_ID, 'nonexistent', validPatchBody)
    const { PATCH } = await import('@/app/api/v1/events/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('403 と 404 が区別される（ERR_EDIT_PERMISSION_DENIED vs ERR_EVENT_NOT_FOUND）', async () => {
    const { ERR_EDIT_PERMISSION_DENIED, ERR_EVENT_NOT_FOUND } = await import('@/lib/constants/errors')
    const { PATCH } = await import('@/app/api/v1/events/[id]/route')

    // 他人 → 403
    mockUpdateEventV1.mockResolvedValue({ ok: false, error: ERR_EDIT_PERMISSION_DENIED })
    const [reqA, paramsA] = await makeAuthenticatedPatchRequest(OTHER_ID, VALID_EVENT_ID, validPatchBody)
    mockUserFindUnique.mockResolvedValue({ id: OTHER_ID, isSuspended: false, email: 'other@example.com' })
    const res403 = await PATCH(reqA, paramsA)
    expect(res403.status).toBe(403)

    // 不存在 → 404
    mockUpdateEventV1.mockResolvedValue({ ok: false, error: ERR_EVENT_NOT_FOUND })
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    const [reqB, paramsB] = await makeAuthenticatedPatchRequest(OWNER_ID, 'nonexistent', validPatchBody)
    const res404 = await PATCH(reqB, paramsB)
    expect(res404.status).toBe(404)
  })

  it('バリデーションエラー（updateEventV1 が他エラー）→ 400', async () => {
    mockUpdateEventV1.mockResolvedValue({ ok: false, error: '終了日は開始日以降を選択してください' })

    const [req, params] = await makeAuthenticatedPatchRequest(OWNER_ID, VALID_EVENT_ID, validPatchBody)
    const { PATCH } = await import('@/app/api/v1/events/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('JSON パース失敗 → 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(OWNER_ID)
    const req = new NextRequest(`http://localhost/api/v1/events/${VALID_EVENT_ID}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'invalid-json{',
    })
    const { PATCH } = await import('@/app/api/v1/events/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: VALID_EVENT_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const [req, params] = await makeAuthenticatedPatchRequest(OWNER_ID, VALID_EVENT_ID, validPatchBody)
    const { PATCH } = await import('@/app/api/v1/events/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('updateEventV1 に正しい eventId と userId が渡される', async () => {
    const [req, params] = await makeAuthenticatedPatchRequest(OWNER_ID, VALID_EVENT_ID, validPatchBody)
    const { PATCH } = await import('@/app/api/v1/events/[id]/route')
    await PATCH(req, params)

    expect(mockUpdateEventV1).toHaveBeenCalledWith(
      VALID_EVENT_ID,
      expect.anything(),
      OWNER_ID,
    )
  })
})

// ──────────────────────────────────────────────────
// DELETE /api/v1/events/{id}
// ──────────────────────────────────────────────────
describe('DELETE /api/v1/events/[id]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockDeleteEventV1.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 204 ボディなし', async () => {
    const [req, params] = await makeAuthenticatedDeleteRequest(OWNER_ID, VALID_EVENT_ID)
    const { DELETE } = await import('@/app/api/v1/events/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(204)
    // 204 はボディなし
    const text = await res.text()
    expect(text).toBe('')
  })

  it('deleteEventV1 に正しい eventId と userId が渡される', async () => {
    const [req, params] = await makeAuthenticatedDeleteRequest(OWNER_ID, VALID_EVENT_ID)
    const { DELETE } = await import('@/app/api/v1/events/[id]/route')
    await DELETE(req, params)

    expect(mockDeleteEventV1).toHaveBeenCalledWith(VALID_EVENT_ID, OWNER_ID)
  })

  it('Bearer なし → 401', async () => {
    const req = new NextRequest(`http://localhost/api/v1/events/${VALID_EVENT_ID}`, {
      method: 'DELETE',
    })
    const { DELETE } = await import('@/app/api/v1/events/[id]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: VALID_EVENT_ID }) })

    expect(res.status).toBe(401)
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(`http://localhost/api/v1/events/${VALID_EVENT_ID}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    const { DELETE } = await import('@/app/api/v1/events/[id]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: VALID_EVENT_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('他人のイベント → 403（ERR_PERMISSION_DENIED）', async () => {
    const { ERR_PERMISSION_DENIED } = await import('@/lib/constants/errors')
    mockDeleteEventV1.mockResolvedValue({ ok: false, error: ERR_PERMISSION_DENIED })

    mockUserFindUnique.mockResolvedValue({ id: OTHER_ID, isSuspended: false, email: 'other@example.com' })
    const [req, params] = await makeAuthenticatedDeleteRequest(OTHER_ID, VALID_EVENT_ID)
    const { DELETE } = await import('@/app/api/v1/events/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(403)
  })

  it('不存在イベント → 404 NOT_FOUND', async () => {
    const { ERR_EVENT_NOT_FOUND } = await import('@/lib/constants/errors')
    mockDeleteEventV1.mockResolvedValue({ ok: false, error: ERR_EVENT_NOT_FOUND })

    const [req, params] = await makeAuthenticatedDeleteRequest(OWNER_ID, 'nonexistent')
    const { DELETE } = await import('@/app/api/v1/events/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('403 と 404 が区別される（ERR_PERMISSION_DENIED vs ERR_EVENT_NOT_FOUND）', async () => {
    const { ERR_PERMISSION_DENIED, ERR_EVENT_NOT_FOUND } = await import('@/lib/constants/errors')
    const { DELETE } = await import('@/app/api/v1/events/[id]/route')

    // 他人 → 403
    mockDeleteEventV1.mockResolvedValue({ ok: false, error: ERR_PERMISSION_DENIED })
    mockUserFindUnique.mockResolvedValue({ id: OTHER_ID, isSuspended: false, email: 'other@example.com' })
    const [reqA, paramsA] = await makeAuthenticatedDeleteRequest(OTHER_ID, VALID_EVENT_ID)
    const res403 = await DELETE(reqA, paramsA)
    expect(res403.status).toBe(403)

    // 不存在 → 404
    mockDeleteEventV1.mockResolvedValue({ ok: false, error: ERR_EVENT_NOT_FOUND })
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    const [reqB, paramsB] = await makeAuthenticatedDeleteRequest(OWNER_ID, 'nonexistent')
    const res404 = await DELETE(reqB, paramsB)
    expect(res404.status).toBe(404)
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const [req, params] = await makeAuthenticatedDeleteRequest(OWNER_ID, VALID_EVENT_ID)
    const { DELETE } = await import('@/app/api/v1/events/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('deleteEventV1 が他エラーを返した場合 500 INTERNAL_ERROR', async () => {
    mockDeleteEventV1.mockResolvedValue({ ok: false, error: '操作に失敗しました' })

    const [req, params] = await makeAuthenticatedDeleteRequest(OWNER_ID, VALID_EVENT_ID)
    const { DELETE } = await import('@/app/api/v1/events/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
