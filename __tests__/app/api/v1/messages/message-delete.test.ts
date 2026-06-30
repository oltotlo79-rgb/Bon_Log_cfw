// @vitest-environment node
/**
 * DELETE /api/v1/messages/conversations/[id]/messages/[messageId] — メッセージ削除
 *
 * 200 / 401 / 403 / 404 / 429 の全分岐、送信者以外の削除拒否を検証する。
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

const mockDeleteDirectMessage = vi.fn()
vi.mock('@/lib/services/message-service', () => ({
  listConversations: vi.fn(),
  startConversation: vi.fn(),
  listConversationMessages: vi.fn(),
  sendDirectMessage: vi.fn(),
  deleteDirectMessage: (...args: unknown[]) => mockDeleteDirectMessage(...args),
  markConversationRead: vi.fn(),
}))

const USER_ID = 'cjld2cjxh0001qzrmn831i7rn'
const CONV_ID = 'conv-cjld2cjxh0003qzrmn831i7rn'
const MSG_ID = 'msg-cjld2cjxh0004qzrmn831i7rn'

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  convId = CONV_ID,
  messageId = MSG_ID,
): Promise<[NextRequest, { params: Promise<{ id: string; messageId: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const req = new NextRequest(
    `http://localhost/api/v1/messages/conversations/${convId}/messages/${messageId}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    },
  )
  return [req, { params: Promise.resolve({ id: convId, messageId }) }]
}

describe('DELETE /api/v1/messages/conversations/[id]/messages/[messageId]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 })
    mockDeleteDirectMessage.mockResolvedValue({ ok: true, data: undefined })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 と { success: true } を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { DELETE } = await import('@/app/api/v1/messages/conversations/[id]/messages/[messageId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('deleteDirectMessage に userId と messageId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { DELETE } = await import('@/app/api/v1/messages/conversations/[id]/messages/[messageId]/route')
    await DELETE(req, params)

    expect(mockDeleteDirectMessage).toHaveBeenCalledWith(USER_ID, MSG_ID)
  })

  it('メッセージが存在しない（NOT_FOUND from service）→ 404', async () => {
    mockDeleteDirectMessage.mockResolvedValueOnce({
      ok: false,
      code: 'NOT_FOUND',
      message: 'メッセージが見つかりません',
    })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { DELETE } = await import('@/app/api/v1/messages/conversations/[id]/messages/[messageId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('送信者以外が削除しようとした場合（FORBIDDEN from service）→ 403', async () => {
    mockDeleteDirectMessage.mockResolvedValueOnce({
      ok: false,
      code: 'FORBIDDEN',
      message: '他のユーザーのメッセージは削除できません',
    })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { DELETE } = await import('@/app/api/v1/messages/conversations/[id]/messages/[messageId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('service が INTERNAL_ERROR を返す → 500', async () => {
    mockDeleteDirectMessage.mockResolvedValueOnce({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'DB エラー',
    })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { DELETE } = await import('@/app/api/v1/messages/conversations/[id]/messages/[messageId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(500)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(
      `http://localhost/api/v1/messages/conversations/${CONV_ID}/messages/${MSG_ID}`,
      { method: 'DELETE' },
    )
    const { DELETE } = await import('@/app/api/v1/messages/conversations/[id]/messages/[messageId]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: CONV_ID, messageId: MSG_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { DELETE } = await import('@/app/api/v1/messages/conversations/[id]/messages/[messageId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest(
      `http://localhost/api/v1/messages/conversations/${CONV_ID}/messages/${MSG_ID}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      },
    )
    const { DELETE } = await import('@/app/api/v1/messages/conversations/[id]/messages/[messageId]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: CONV_ID, messageId: MSG_ID }) })

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
    const { DELETE } = await import('@/app/api/v1/messages/conversations/[id]/messages/[messageId]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    const req = new NextRequest(
      `http://localhost/api/v1/messages/conversations/${CONV_ID}/messages/${MSG_ID}`,
      { method: 'DELETE' },
    )
    const { DELETE } = await import('@/app/api/v1/messages/conversations/[id]/messages/[messageId]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: CONV_ID, messageId: MSG_ID }) })

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
