// @vitest-environment node
/**
 * GET  /api/v1/messages/conversations — 会話一覧取得
 * POST /api/v1/messages/conversations — 会話開始（取得または新規作成）
 *
 * 200 / 400 / 401 / 403 / 404 / 429 / 500 の全分岐と
 * 未読フラグ・nextCursor・ブロック拒否・自己 DM 拒否を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

const mockListConversations = vi.fn()
const mockStartConversation = vi.fn()
vi.mock('@/lib/services/message-service', () => ({
  listConversations: (...args: unknown[]) => mockListConversations(...args),
  startConversation: (...args: unknown[]) => mockStartConversation(...args),
  listConversationMessages: vi.fn(),
  sendDirectMessage: vi.fn(),
  deleteDirectMessage: vi.fn(),
  markConversationRead: vi.fn(),
}))

const USER_ID = 'cjld2cjxh0001qzrmn831i7rn'
const OTHER_USER_ID = 'cjld2cjxh0002qzrmn831i7rn'
const CONV_ID = 'conv-cjld2cjxh0003qzrmn831i7rn'

const mockConversationItem = {
  id: CONV_ID,
  updatedAt: new Date('2024-01-01T10:00:00Z'),
  otherUser: { id: OTHER_USER_ID, nickname: '相手ユーザー', avatarUrl: null },
  lastMessage: {
    id: 'msg-1',
    content: 'こんにちは',
    senderId: OTHER_USER_ID,
    createdAt: new Date('2024-01-01T09:59:00Z'),
  },
  hasUnread: true,
}

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
  query = '',
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const url = `http://localhost/api/v1/messages/conversations${query ? `?${query}` : ''}`
  return new NextRequest(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

// ─── GET /api/v1/messages/conversations ───────────────────────────────────────

describe('GET /api/v1/messages/conversations', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListConversations.mockResolvedValue({
      ok: true,
      data: { items: [mockConversationItem], nextCursor: null },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 と会話一覧を返す', async () => {
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(1)
  })

  it('会話の updatedAt が ISO 文字列で返される', async () => {
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/route')
    const res = await GET(req)

    const body = await res.json()
    expect(typeof body.items[0].updatedAt).toBe('string')
    expect(body.items[0].updatedAt).toBe('2024-01-01T10:00:00.000Z')
  })

  it('lastMessage の createdAt が ISO 文字列で返される', async () => {
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/route')
    const res = await GET(req)

    const body = await res.json()
    expect(typeof body.items[0].lastMessage.createdAt).toBe('string')
  })

  it('hasUnread が true のとき正しく返される', async () => {
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0].hasUnread).toBe(true)
  })

  it('nextCursor が null のとき null を返す', async () => {
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.nextCursor).toBeNull()
  })

  it('nextCursor が存在するとき文字列を返す', async () => {
    mockListConversations.mockResolvedValueOnce({
      ok: true,
      data: { items: [mockConversationItem], nextCursor: CONV_ID },
    })
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.nextCursor).toBe(CONV_ID)
  })

  it('listConversations に userId・cursor・limit が渡される', async () => {
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com', 'GET', undefined, 'cursor=abc&limit=10')
    const { GET } = await import('@/app/api/v1/messages/conversations/route')
    await GET(req)

    expect(mockListConversations).toHaveBeenCalledWith(USER_ID, 'abc', 10)
  })

  it('service がエラーを返したとき 500 INTERNAL_ERROR', async () => {
    mockListConversations.mockResolvedValueOnce({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'DB エラー',
    })
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/route')
    const res = await GET(req)

    expect(res.status).toBe(500)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/messages/conversations')
    const { GET } = await import('@/app/api/v1/messages/conversations/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/messages/conversations/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest('http://localhost/api/v1/messages/conversations', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/messages/conversations/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})

// ─── POST /api/v1/messages/conversations ──────────────────────────────────────

describe('POST /api/v1/messages/conversations', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 })
    mockStartConversation.mockResolvedValue({ ok: true, data: { conversationId: CONV_ID } })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 と { conversationId } を返す', async () => {
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com', 'POST', { targetUserId: OTHER_USER_ID })
    const { POST } = await import('@/app/api/v1/messages/conversations/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.conversationId).toBe(CONV_ID)
  })

  it('startConversation に userId と targetUserId が渡される', async () => {
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com', 'POST', { targetUserId: OTHER_USER_ID })
    const { POST } = await import('@/app/api/v1/messages/conversations/route')
    await POST(req)

    expect(mockStartConversation).toHaveBeenCalledWith(USER_ID, OTHER_USER_ID)
  })

  it('ブロック関係でサービスが FORBIDDEN を返す → 403', async () => {
    mockStartConversation.mockResolvedValueOnce({ ok: false, code: 'FORBIDDEN', message: 'ブロックされています' })
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com', 'POST', { targetUserId: OTHER_USER_ID })
    const { POST } = await import('@/app/api/v1/messages/conversations/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('相手ユーザーが存在しない（NOT_FOUND from service）→ 404', async () => {
    mockStartConversation.mockResolvedValueOnce({ ok: false, code: 'NOT_FOUND', message: 'ユーザーが見つかりません' })
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com', 'POST', { targetUserId: 'ghost-user' })
    const { POST } = await import('@/app/api/v1/messages/conversations/route')
    const res = await POST(req)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('自己 DM（VALIDATION_ERROR from service）→ 400', async () => {
    mockStartConversation.mockResolvedValueOnce({ ok: false, code: 'VALIDATION_ERROR', message: '自分自身にメッセージは送れません' })
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com', 'POST', { targetUserId: USER_ID })
    const { POST } = await import('@/app/api/v1/messages/conversations/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('targetUserId が欠落している → 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com', 'POST', {})
    const { POST } = await import('@/app/api/v1/messages/conversations/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('JSON パース失敗 → 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(USER_ID)
    mockUserFindUnique.mockResolvedValueOnce({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    const req = new NextRequest('http://localhost/api/v1/messages/conversations', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'bad-json{',
    })
    const { POST } = await import('@/app/api/v1/messages/conversations/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/messages/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetUserId: OTHER_USER_ID }),
    })
    const { POST } = await import('@/app/api/v1/messages/conversations/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, 'POST', { targetUserId: OTHER_USER_ID })
    const { POST } = await import('@/app/api/v1/messages/conversations/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const req = await makeAuthenticatedRequest(USER_ID, 'user@example.com', 'POST', { targetUserId: OTHER_USER_ID })
    const { POST } = await import('@/app/api/v1/messages/conversations/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })
})
