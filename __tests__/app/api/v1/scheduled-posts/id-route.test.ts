// @vitest-environment node
/**
 * GET /api/v1/scheduled-posts/[id] / PATCH / DELETE のユニットテスト
 *
 * 所有者チェック・状態制約・プレミアム判定・ゲスト403・401 の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const USER_ID = 'user-sp-item-test'
const SP_ID = 'sp-item-001'

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
const mockGetScheduledPostV1 = vi.fn()
const mockUpdateScheduledPostV1 = vi.fn()
const mockDeleteScheduledPostV1 = vi.fn()

vi.mock('@/lib/services/scheduled-post-service', () => ({
  getScheduledPostV1: (...args: unknown[]) => mockGetScheduledPostV1(...args),
  updateScheduledPostV1: (...args: unknown[]) => mockUpdateScheduledPostV1(...args),
  deleteScheduledPostV1: (...args: unknown[]) => mockDeleteScheduledPostV1(...args),
  scheduledPostUpdateV1Schema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>
      if (!d || typeof d !== 'object') return { success: false, error: { issues: [{ message: 'invalid' }] } }
      if (!d['scheduledAt']) {
        return { success: false, error: { issues: [{ message: '予約日時を指定してください' }] } }
      }
      return {
        success: true,
        data: {
          content: d['content'] ?? '',
          scheduledAt: d['scheduledAt'],
          genreIds: d['genreIds'] ?? [],
          mediaUrls: d['mediaUrls'] ?? [],
          mediaTypes: d['mediaTypes'] ?? [],
        },
      }
    },
  },
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
async function makeBearerRequest(
  userId: string,
  method: 'GET' | 'PATCH' | 'DELETE',
  id: string,
  body?: unknown,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)

  return new NextRequest(`http://localhost/api/v1/scheduled-posts/${id}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

function futureISO(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString()
}

const MOCK_SP_ITEM = {
  id: SP_ID,
  content: 'テスト予約投稿',
  scheduledAt: futureISO(),
  status: 'pending' as const,
  media: [],
  genres: [],
  publishedPostId: null,
  createdAt: new Date().toISOString(),
}

const VALID_PATCH_BODY = {
  content: '更新内容',
  scheduledAt: futureISO(),
  genreIds: [],
  mediaUrls: [],
  mediaTypes: [],
}

async function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ──────────────────────────────────────────────────
// GET /api/v1/scheduled-posts/[id]
// ──────────────────────────────────────────────────
describe('GET /api/v1/scheduled-posts/[id]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 10, resetTime: Date.now() + 60000 })
    mockGetScheduledPostV1.mockResolvedValue({ ok: true, item: MOCK_SP_ITEM })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('所有者プレミアムユーザーで 200 と ScheduledPostItem を返す', async () => {
    const req = await makeBearerRequest(USER_ID, 'GET', SP_ID)
    const params = await makeParams(SP_ID)
    const { GET } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(SP_ID)
  })

  it('非プレミアム → 403 PREMIUM_REQUIRED', async () => {
    mockGetScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '予約投稿は有料会員限定の機能です',
      status: 403,
    })
    const req = await makeBearerRequest(USER_ID, 'GET', SP_ID)
    const params = await makeParams(SP_ID)
    const { GET } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('PREMIUM_REQUIRED')
  })

  it('他人/不存在 → 404 NOT_FOUND', async () => {
    mockGetScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '予約投稿が見つかりません',
      status: 404,
    })
    const req = await makeBearerRequest(USER_ID, 'GET', SP_ID)
    const params = await makeParams(SP_ID)
    const { GET } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/scheduled-posts/${SP_ID}`, { method: 'GET' })
    const params = await makeParams(SP_ID)
    const { GET } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-id')
    const req = new NextRequest(`http://localhost/api/v1/scheduled-posts/${SP_ID}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    const params = await makeParams(SP_ID)
    const { GET } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, 'GET', SP_ID)
    const params = await makeParams(SP_ID)
    const { GET } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})

// ──────────────────────────────────────────────────
// PATCH /api/v1/scheduled-posts/[id]
// ──────────────────────────────────────────────────
describe('PATCH /api/v1/scheduled-posts/[id]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 10, resetTime: Date.now() + 60000 })
    mockUpdateScheduledPostV1.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('pending 投稿の更新で 200 { success: true }', async () => {
    const req = await makeBearerRequest(USER_ID, 'PATCH', SP_ID, VALID_PATCH_BODY)
    const params = await makeParams(SP_ID)
    const { PATCH } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('非プレミアム → 403 PREMIUM_REQUIRED', async () => {
    mockUpdateScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '予約投稿は有料会員限定の機能です',
      status: 403,
    })
    const req = await makeBearerRequest(USER_ID, 'PATCH', SP_ID, VALID_PATCH_BODY)
    const params = await makeParams(SP_ID)
    const { PATCH } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('PREMIUM_REQUIRED')
  })

  it('他人/不存在 → 404 NOT_FOUND', async () => {
    mockUpdateScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '更新権限がありません',
      status: 404,
    })
    const req = await makeBearerRequest(USER_ID, 'PATCH', SP_ID, VALID_PATCH_BODY)
    const params = await makeParams(SP_ID)
    const { PATCH } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('published 状態 → 400 VALIDATION_ERROR', async () => {
    mockUpdateScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '公開済みまたはキャンセル済みの予約投稿は編集できません',
      status: 400,
    })
    const req = await makeBearerRequest(USER_ID, 'PATCH', SP_ID, VALID_PATCH_BODY)
    const params = await makeParams(SP_ID)
    const { PATCH } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('cancelled 状態 → 400 VALIDATION_ERROR', async () => {
    mockUpdateScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '公開済みまたはキャンセル済みの予約投稿は編集できません',
      status: 400,
    })
    const req = await makeBearerRequest(USER_ID, 'PATCH', SP_ID, VALID_PATCH_BODY)
    const params = await makeParams(SP_ID)
    const { PATCH } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(400)
  })

  it('failed 状態 → 400 VALIDATION_ERROR', async () => {
    mockUpdateScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '公開済みまたはキャンセル済みの予約投稿は編集できません',
      status: 400,
    })
    const req = await makeBearerRequest(USER_ID, 'PATCH', SP_ID, VALID_PATCH_BODY)
    const params = await makeParams(SP_ID)
    const { PATCH } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(400)
  })

  it('不正な JSON ボディで 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(USER_ID)
    const req = new NextRequest(`http://localhost/api/v1/scheduled-posts/${SP_ID}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'not-json{',
    })
    const params = await makeParams(SP_ID)
    const { PATCH } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('scheduledAt なしで 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'PATCH', SP_ID, { content: 'test' })
    const params = await makeParams(SP_ID)
    const { PATCH } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/scheduled-posts/${SP_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID_PATCH_BODY),
    })
    const params = await makeParams(SP_ID)
    const { PATCH } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(401)
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-id')
    const req = new NextRequest(`http://localhost/api/v1/scheduled-posts/${SP_ID}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(VALID_PATCH_BODY),
    })
    const params = await makeParams(SP_ID)
    const { PATCH } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, 'PATCH', SP_ID, VALID_PATCH_BODY)
    const params = await makeParams(SP_ID)
    const { PATCH } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(429)
  })
})

// ──────────────────────────────────────────────────
// DELETE /api/v1/scheduled-posts/[id]
// ──────────────────────────────────────────────────
describe('DELETE /api/v1/scheduled-posts/[id]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 10, resetTime: Date.now() + 60000 })
    mockDeleteScheduledPostV1.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系で 200 { success: true }', async () => {
    const req = await makeBearerRequest(USER_ID, 'DELETE', SP_ID)
    const params = await makeParams(SP_ID)
    const { DELETE } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('他人/不存在 → 404 NOT_FOUND', async () => {
    mockDeleteScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '予約投稿が見つかりません',
      status: 404,
    })
    const req = await makeBearerRequest(USER_ID, 'DELETE', SP_ID)
    const params = await makeParams(SP_ID)
    const { DELETE } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('published 状態は削除不可 → 400 VALIDATION_ERROR', async () => {
    mockDeleteScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '公開済みの予約投稿は削除できません',
      status: 400,
    })
    const req = await makeBearerRequest(USER_ID, 'DELETE', SP_ID)
    const params = await makeParams(SP_ID)
    const { DELETE } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/scheduled-posts/${SP_ID}`, {
      method: 'DELETE',
    })
    const params = await makeParams(SP_ID)
    const { DELETE } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(401)
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-id')
    const req = new NextRequest(`http://localhost/api/v1/scheduled-posts/${SP_ID}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    const params = await makeParams(SP_ID)
    const { DELETE } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, 'DELETE', SP_ID)
    const params = await makeParams(SP_ID)
    const { DELETE } = await import('@/app/api/v1/scheduled-posts/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(429)
  })
})
