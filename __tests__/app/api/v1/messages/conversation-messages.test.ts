// @vitest-environment node
/**
 * GET  /api/v1/messages/conversations/[id]/messages — メッセージ一覧
 * POST /api/v1/messages/conversations/[id]/messages — メッセージ送信
 *
 * 200 / 201 / 400 / 401 / 403 / 429 / 500 の全分岐と
 * 非参加者排除・ブロック拒否・日次上限・空コンテンツを検証する。
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

const mockListConversationMessages = vi.fn()
const mockSendDirectMessage = vi.fn()
vi.mock('@/lib/services/message-service', () => ({
  listConversations: vi.fn(),
  startConversation: vi.fn(),
  listConversationMessages: (...args: unknown[]) => mockListConversationMessages(...args),
  sendDirectMessage: (...args: unknown[]) => mockSendDirectMessage(...args),
  deleteDirectMessage: vi.fn(),
  markConversationRead: vi.fn(),
}))

const USER_ID = 'cjld2cjxh0001qzrmn831i7rn'
const CONV_ID = 'conv-cjld2cjxh0003qzrmn831i7rn'
const MSG_ID = 'msg-cjld2cjxh0004qzrmn831i7rn'

const mockMessage = {
  id: MSG_ID,
  conversationId: CONV_ID,
  content: 'こんにちは！',
  senderId: USER_ID,
  sender: { id: USER_ID, nickname: '自分', avatarUrl: null },
  createdAt: new Date('2024-01-01T10:00:00Z'),
}

async function makeGetRequest(
  userId: string,
  email: string,
  convId = CONV_ID,
  query = '',
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const req = new NextRequest(
    `http://localhost/api/v1/messages/conversations/${convId}/messages${query ? `?${query}` : ''}`,
    { headers: { authorization: `Bearer ${token}` } },
  )
  return [req, { params: Promise.resolve({ id: convId }) }]
}

async function makePostRequest(
  userId: string,
  email: string,
  convId = CONV_ID,
  body: unknown = { content: 'こんにちは！' },
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const req = new NextRequest(
    `http://localhost/api/v1/messages/conversations/${convId}/messages`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
  return [req, { params: Promise.resolve({ id: convId }) }]
}

// ─── GET /api/v1/messages/conversations/[id]/messages ─────────────────────────

describe('GET /api/v1/messages/conversations/[id]/messages', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListConversationMessages.mockResolvedValue({
      ok: true,
      data: { items: [mockMessage], nextCursor: null },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 とメッセージ一覧を返す', async () => {
    const [req, params] = await makeGetRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(1)
  })

  it('メッセージの createdAt が ISO 文字列で返される', async () => {
    const [req, params] = await makeGetRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(typeof body.items[0].createdAt).toBe('string')
    expect(body.items[0].createdAt).toBe('2024-01-01T10:00:00.000Z')
  })

  it('nextCursor が null のとき null を返す', async () => {
    const [req, params] = await makeGetRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.nextCursor).toBeNull()
  })

  it('listConversationMessages に userId と conversationId が渡される', async () => {
    const [req, params] = await makeGetRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    await GET(req, params)

    expect(mockListConversationMessages).toHaveBeenCalledWith(USER_ID, CONV_ID, undefined, undefined)
  })

  it('非参加者（FORBIDDEN from service）→ 403', async () => {
    mockListConversationMessages.mockResolvedValueOnce({
      ok: false,
      code: 'FORBIDDEN',
      message: 'この会話へのアクセス権がありません',
    })
    const [req, params] = await makeGetRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await GET(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('service が INTERNAL_ERROR を返す → 500', async () => {
    mockListConversationMessages.mockResolvedValueOnce({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'DB エラー',
    })
    const [req, params] = await makeGetRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await GET(req, params)

    expect(res.status).toBe(500)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/messages/conversations/${CONV_ID}/messages`)
    const { GET } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await GET(req, { params: Promise.resolve({ id: CONV_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeGetRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await GET(req, params)

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
    const [req, params] = await makeGetRequest(USER_ID, 'user@example.com')
    const { GET } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })
})

// ─── POST /api/v1/messages/conversations/[id]/messages ───────────────────────

describe('POST /api/v1/messages/conversations/[id]/messages', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 19, resetTime: Date.now() + 60000 })
    mockSendDirectMessage.mockResolvedValue({ ok: true, data: { message: mockMessage } })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 201 とメッセージを返す', async () => {
    const [req, params] = await makePostRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await POST(req, params)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(MSG_ID)
    expect(body.content).toBe('こんにちは！')
  })

  it('送信メッセージの createdAt が ISO 文字列で返される', async () => {
    const [req, params] = await makePostRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await POST(req, params)

    const body = await res.json()
    expect(typeof body.createdAt).toBe('string')
    expect(body.createdAt).toBe('2024-01-01T10:00:00.000Z')
  })

  it('sendDirectMessage に userId・conversationId・content が渡される', async () => {
    const [req, params] = await makePostRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    await POST(req, params)

    expect(mockSendDirectMessage).toHaveBeenCalledWith(USER_ID, CONV_ID, 'こんにちは！')
  })

  it('空コンテンツ → 400 VALIDATION_ERROR（Zod レベル）', async () => {
    const [req, params] = await makePostRequest(USER_ID, 'user@example.com', CONV_ID, { content: '' })
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('空白のみのコンテンツ → 400 VALIDATION_ERROR（Zod refine）', async () => {
    const [req, params] = await makePostRequest(USER_ID, 'user@example.com', CONV_ID, { content: '   ' })
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('非参加者（FORBIDDEN from service）→ 403', async () => {
    mockSendDirectMessage.mockResolvedValueOnce({
      ok: false,
      code: 'FORBIDDEN',
      message: 'この会話へのアクセス権がありません',
    })
    const [req, params] = await makePostRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await POST(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('日次上限超過（VALIDATION_ERROR from service）→ 400', async () => {
    mockSendDirectMessage.mockResolvedValueOnce({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: '1日のメッセージ送信上限に達しました',
    })
    const [req, params] = await makePostRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('ブロックされた相手へ送信（FORBIDDEN from service）→ 403', async () => {
    mockSendDirectMessage.mockResolvedValueOnce({
      ok: false,
      code: 'FORBIDDEN',
      message: 'ブロックされています',
    })
    const [req, params] = await makePostRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await POST(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('JSON パース失敗 → 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(USER_ID)
    mockUserFindUnique.mockResolvedValueOnce({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    const req = new NextRequest(
      `http://localhost/api/v1/messages/conversations/${CONV_ID}/messages`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: 'bad-json{',
      },
    )
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await POST(req, { params: Promise.resolve({ id: CONV_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(
      `http://localhost/api/v1/messages/conversations/${CONV_ID}/messages`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'hello' }),
      },
    )
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await POST(req, { params: Promise.resolve({ id: CONV_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makePostRequest('guest-id', GUEST_EMAIL)
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await POST(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const [req, params] = await makePostRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    const req = new NextRequest(
      `http://localhost/api/v1/messages/conversations/${CONV_ID}/messages`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'hello' }),
      },
    )
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/messages/route')
    const res = await POST(req, { params: Promise.resolve({ id: CONV_ID }) })

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
