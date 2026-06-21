// @vitest-environment node
/**
 * GET /api/v1/scheduled-posts および POST /api/v1/scheduled-posts のユニットテスト
 *
 * 200 / 201 / 400 / 401 / 403 ゲスト / 403 PREMIUM_REQUIRED / 429 の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const USER_ID = 'user-scheduled-test'

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
const mockListScheduledPostsV1 = vi.fn()
const mockCreateScheduledPostV1 = vi.fn()

vi.mock('@/lib/services/scheduled-post-service', () => ({
  listScheduledPostsV1: (...args: unknown[]) => mockListScheduledPostsV1(...args),
  createScheduledPostV1: (...args: unknown[]) => mockCreateScheduledPostV1(...args),
  scheduledPostCreateV1Schema: {
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
  method: 'GET' | 'POST',
  body?: unknown,
  searchParams?: Record<string, string>,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)

  const url = new URL('http://localhost/api/v1/scheduled-posts')
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

/** 1時間後のISO文字列 */
function futureISO(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString()
}

const MOCK_SP_ITEM = {
  id: 'sp-001',
  content: 'テスト予約投稿',
  scheduledAt: futureISO(),
  status: 'pending' as const,
  media: [],
  genres: [],
  publishedPostId: null,
  createdAt: new Date().toISOString(),
}

const VALID_POST_BODY = {
  content: 'テスト予約投稿内容',
  scheduledAt: futureISO(),
  genreIds: [],
  mediaUrls: [],
  mediaTypes: [],
}

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────
describe('GET /api/v1/scheduled-posts', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 10, resetTime: Date.now() + 60000 })
    mockListScheduledPostsV1.mockResolvedValue({ ok: true, items: [MOCK_SP_ITEM], nextCursor: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('プレミアムユーザーで 200 と items + nextCursor を返す', async () => {
    const req = await makeBearerRequest(USER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect('nextCursor' in body).toBe(true)
  })

  it('非プレミアム → 403 PREMIUM_REQUIRED', async () => {
    mockListScheduledPostsV1.mockResolvedValue({
      ok: false,
      error: '予約投稿は有料会員限定の機能です',
      status: 403,
    })
    const req = await makeBearerRequest(USER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('PREMIUM_REQUIRED')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/scheduled-posts', { method: 'GET' })
    const { GET } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/scheduled-posts', {
      method: 'GET',
      headers: { authorization: 'Bearer invalid.token.here' },
    })
    const { GET } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-id')
    const req = new NextRequest('http://localhost/api/v1/scheduled-posts', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: true, email: 'user@example.com' })
    const req = await makeBearerRequest(USER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンスは { error: { code, message, status } } 形式', async () => {
    mockListScheduledPostsV1.mockResolvedValue({
      ok: false,
      error: '予約投稿は有料会員限定の機能です',
      status: 403,
    })
    const req = await makeBearerRequest(USER_ID, 'GET')
    const { GET } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  it('cursor パラメータが listScheduledPostsV1 に渡る', async () => {
    const req = await makeBearerRequest(USER_ID, 'GET', undefined, { cursor: 'cursor-123' })
    const { GET } = await import('@/app/api/v1/scheduled-posts/route')
    await GET(req)
    expect(mockListScheduledPostsV1).toHaveBeenCalledWith(USER_ID, 'cursor-123', expect.any(Number))
  })
})

describe('POST /api/v1/scheduled-posts', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 5, resetTime: Date.now() + 60000 })
    mockCreateScheduledPostV1.mockResolvedValue({ ok: true, id: 'sp-new-001' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('プレミアムユーザーで 201 と { id } を返す', async () => {
    const req = await makeBearerRequest(USER_ID, 'POST', VALID_POST_BODY)
    const { POST } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(typeof body.id).toBe('string')
  })

  it('非プレミアム → 403 PREMIUM_REQUIRED', async () => {
    mockCreateScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '予約投稿は有料会員限定の機能です',
      status: 403,
    })
    const req = await makeBearerRequest(USER_ID, 'POST', VALID_POST_BODY)
    const { POST } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('PREMIUM_REQUIRED')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/scheduled-posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID_POST_BODY),
    })
    const { POST } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-id')
    const req = new NextRequest('http://localhost/api/v1/scheduled-posts', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(VALID_POST_BODY),
    })
    const { POST } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('不正な JSON ボディで 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(USER_ID)
    const req = new NextRequest('http://localhost/api/v1/scheduled-posts', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'not-json{',
    })
    const { POST } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('scheduledAt なしで 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'POST', { content: 'test' })
    const { POST } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('30日先超過 → service から 400 でルートが 400 を返す', async () => {
    mockCreateScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '予約日時は30日以内で指定してください',
      status: 400,
    })
    const req = await makeBearerRequest(USER_ID, 'POST', VALID_POST_BODY)
    const { POST } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('保留 10 件超過 → service から 400 でルートが 400 を返す', async () => {
    mockCreateScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '予約投稿は10件までです。',
      status: 400,
    })
    const req = await makeBearerRequest(USER_ID, 'POST', VALID_POST_BODY)
    const { POST } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('本文 2000 字超過 → service から 400 でルートが 400 を返す', async () => {
    mockCreateScheduledPostV1.mockResolvedValue({
      ok: false,
      error: '投稿は2000文字以内で入力してください',
      status: 400,
    })
    const req = await makeBearerRequest(USER_ID, 'POST', VALID_POST_BODY)
    const { POST } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('外部 mediaUrls → service から 400 でルートが 400 を返す', async () => {
    mockCreateScheduledPostV1.mockResolvedValue({
      ok: false,
      error: 'メディアURLが許可されていません。',
      status: 400,
    })
    const req = await makeBearerRequest(USER_ID, 'POST', {
      ...VALID_POST_BODY,
      mediaUrls: ['https://evil.example.com/spy.gif'],
      mediaTypes: ['image'],
    })
    const { POST } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, 'POST', VALID_POST_BODY)
    const { POST } = await import('@/app/api/v1/scheduled-posts/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
