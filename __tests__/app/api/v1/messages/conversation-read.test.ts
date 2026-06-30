// @vitest-environment node
/**
 * POST /api/v1/messages/conversations/[id]/read — 会話既読化
 *
 * 200 / 401 / 403 / 429 / 500 の全分岐と非参加者排除を検証する。
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

const mockMarkConversationRead = vi.fn()
vi.mock('@/lib/services/message-service', () => ({
  listConversations: vi.fn(),
  startConversation: vi.fn(),
  listConversationMessages: vi.fn(),
  sendDirectMessage: vi.fn(),
  deleteDirectMessage: vi.fn(),
  markConversationRead: (...args: unknown[]) => mockMarkConversationRead(...args),
}))

const USER_ID = 'cjld2cjxh0001qzrmn831i7rn'
const CONV_ID = 'conv-cjld2cjxh0003qzrmn831i7rn'

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  convId = CONV_ID,
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const req = new NextRequest(
    `http://localhost/api/v1/messages/conversations/${convId}/read`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    },
  )
  return [req, { params: Promise.resolve({ id: convId }) }]
}

describe('POST /api/v1/messages/conversations/[id]/read', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 })
    mockMarkConversationRead.mockResolvedValue({ ok: true, data: undefined })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 と { success: true } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/read/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('markConversationRead に userId と conversationId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/read/route')
    await POST(req, params)

    expect(mockMarkConversationRead).toHaveBeenCalledWith(USER_ID, CONV_ID)
  })

  it('非参加者（FORBIDDEN from service）→ 403', async () => {
    mockMarkConversationRead.mockResolvedValueOnce({
      ok: false,
      code: 'FORBIDDEN',
      message: 'この会話へのアクセス権がありません',
    })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/read/route')
    const res = await POST(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('service が INTERNAL_ERROR を返す → 500', async () => {
    mockMarkConversationRead.mockResolvedValueOnce({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'DB エラー',
    })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/read/route')
    const res = await POST(req, params)

    expect(res.status).toBe(500)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(
      `http://localhost/api/v1/messages/conversations/${CONV_ID}/read`,
      { method: 'POST' },
    )
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/read/route')
    const res = await POST(req, { params: Promise.resolve({ id: CONV_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/read/route')
    const res = await POST(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest(
      `http://localhost/api/v1/messages/conversations/${CONV_ID}/read`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      },
    )
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/read/route')
    const res = await POST(req, { params: Promise.resolve({ id: CONV_ID }) })

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
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/read/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    const req = new NextRequest(
      `http://localhost/api/v1/messages/conversations/${CONV_ID}/read`,
      { method: 'POST' },
    )
    const { POST } = await import('@/app/api/v1/messages/conversations/[id]/read/route')
    const res = await POST(req, { params: Promise.resolve({ id: CONV_ID }) })

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
