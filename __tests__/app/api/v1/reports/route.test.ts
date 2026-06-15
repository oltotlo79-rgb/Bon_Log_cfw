// @vitest-environment node
/**
 * POST /api/v1/reports — 通報作成
 *
 * 200 / 400 / 401 / 403 / 404 / 409 / 429 の全分岐・
 * バリデーション・自己通報拒否・重複通報・対象不在を検証する。
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

const mockCreateReportService = vi.fn()
vi.mock('@/lib/services/report-service', () => ({
  createReportService: (...args: unknown[]) => mockCreateReportService(...args),
}))

const validBody = {
  targetType: 'post',
  targetId: 'clpost1234567890abcdef',
  reason: 'spam',
}

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  body: unknown = validBody,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest('http://localhost/api/v1/reports', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/v1/reports', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockCreateReportService.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常通報で 200 { success: true } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('createReportService に正しい引数が渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      targetType: 'comment',
      targetId: 'cl-comment-id',
      reason: 'harassment',
      description: '詳細説明',
    })
    const { POST } = await import('@/app/api/v1/reports/route')
    await POST(req)

    expect(mockCreateReportService).toHaveBeenCalledWith({
      reporterId: 'user-1',
      targetType: 'comment',
      targetId: 'cl-comment-id',
      reason: 'harassment',
      description: '詳細説明',
    })
  })

  it('description なしでも 200 { success: true } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      targetType: 'user',
      targetId: 'cl-user-id',
      reason: 'inappropriate',
    })
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('targetType が enum 外で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      targetType: 'invalid_type',
      targetId: 'cl-some-id',
      reason: 'spam',
    })
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('reason が enum 外で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      targetType: 'post',
      targetId: 'cl-post-id',
      reason: 'invalid_reason',
    })
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('targetId が空文字で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      targetType: 'post',
      targetId: '',
      reason: 'spam',
    })
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('description が 1000 文字超で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      targetType: 'post',
      targetId: 'cl-post-id',
      reason: 'spam',
      description: 'a'.repeat(1001),
    })
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('description が 1000 文字ちょうどで通過する（境界値）', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      targetType: 'post',
      targetId: 'cl-post-id',
      reason: 'spam',
      description: 'a'.repeat(1000),
    })
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  it('不正 JSON ボディで 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-1')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: false, email: 'user@example.com' })
    const req = new NextRequest('http://localhost/api/v1/reports', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: 'not-valid-json',
    })
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('自己通報でサービスが self を返し 400 VALIDATION_ERROR', async () => {
    mockCreateReportService.mockResolvedValueOnce({ ok: false, reason: 'self' })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('対象が存在しない（not_found）で 404 NOT_FOUND', async () => {
    mockCreateReportService.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('重複通報（already_reported）で 409 CONFLICT', async () => {
    mockCreateReportService.mockResolvedValueOnce({ ok: false, reason: 'already_reported' })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/reports', {
      method: 'POST',
      headers: {
        authorization: 'Bearer invalid.token',
        'content-type': 'application/json',
      },
      body: JSON.stringify(validBody),
    })
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/reports', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(validBody),
    })
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

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
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } } であること', async () => {
    const req = new NextRequest('http://localhost/api/v1/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const { POST } = await import('@/app/api/v1/reports/route')
    const res = await POST(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  it('Zod バリデーション通過後にレート制限を実行する（不正入力でレート消費しない）', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      targetType: 'invalid',
      targetId: 'cl-post-id',
      reason: 'spam',
    })
    const { POST } = await import('@/app/api/v1/reports/route')
    await POST(req)

    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })

  it('全ての targetType を受け付ける', async () => {
    const targetTypes = ['post', 'comment', 'event', 'shop', 'review', 'user'] as const
    for (const targetType of targetTypes) {
      vi.clearAllMocks()
      mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
      mockCreateReportService.mockResolvedValue({ ok: true })
      const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
        targetType,
        targetId: 'cl-some-id',
        reason: 'spam',
      })
      const { POST } = await import('@/app/api/v1/reports/route')
      const res = await POST(req)
      expect(res.status).toBe(200)
    }
  })

  it('全ての reason を受け付ける', async () => {
    const reasons = ['spam', 'inappropriate', 'harassment', 'copyright', 'other'] as const
    for (const reason of reasons) {
      vi.clearAllMocks()
      mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
      mockCreateReportService.mockResolvedValue({ ok: true })
      const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
        targetType: 'post',
        targetId: 'cl-post-id',
        reason,
      })
      const { POST } = await import('@/app/api/v1/reports/route')
      const res = await POST(req)
      expect(res.status).toBe(200)
    }
  })
})
