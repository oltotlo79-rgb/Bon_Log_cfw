// @vitest-environment node
/**
 * POST /api/v1/upload/presigned のユニットテスト
 *
 * 200（成功）/ 400（バリデーション）/ 401 / 403 ゲスト / 403 プレミアム未加入 /
 * 403 停止 / 429 レート / 500 / 503 R2 未設定 の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

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
// Mock: premium チェック
// ──────────────────────────────────────────────────
const mockIsPremiumUser = vi.fn()
vi.mock('@/lib/premium', () => ({
  isPremiumUser: (...args: unknown[]) => mockIsPremiumUser(...args),
}))

// ──────────────────────────────────────────────────
// Mock: rate-limit（checkUserRateLimit・checkDailyLimit）
// ──────────────────────────────────────────────────
const mockCheckUserRateLimit = vi.fn()
const mockCheckDailyLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  checkDailyLimit: (...args: unknown[]) => mockCheckDailyLimit(...args),
}))

// ──────────────────────────────────────────────────
// Mock: s3-sign（createPresignedPutUrl）
// ──────────────────────────────────────────────────
const mockCreatePresignedPutUrl = vi.fn()
vi.mock('@/lib/storage/s3-sign', () => ({
  createPresignedPutUrl: (...args: unknown[]) => mockCreatePresignedPutUrl(...args),
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
const USER_ID = 'user-presigned'
const FAKE_PRESIGNED_URL = 'https://account.r2.cloudflarestorage.com/uploads/key?X-Amz-Signature=sig'
const FAKE_PUBLIC_URL = 'https://cdn.example.com'

async function makeBearerRequest(
  userId: string,
  body: unknown,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  return new NextRequest('http://localhost/api/v1/upload/presigned', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = {
  contentType: 'video/mp4',
  fileSize: 1024 * 1024, // 1 MB
}

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────
describe('POST /api/v1/upload/presigned', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.stubEnv('R2_ACCOUNT_ID', 'test-account')
    vi.stubEnv('R2_ACCESS_KEY_ID', 'test-key-id')
    vi.stubEnv('R2_SECRET_ACCESS_KEY', 'test-secret')
    vi.stubEnv('R2_BUCKET_NAME', 'test-bucket')
    vi.stubEnv('R2_PUBLIC_URL', FAKE_PUBLIC_URL)
    vi.clearAllMocks()

    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    mockIsPremiumUser.mockResolvedValue(true)
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockCheckDailyLimit.mockResolvedValue({ allowed: true, count: 1, limit: 50 })
    mockCreatePresignedPutUrl.mockReturnValue(FAKE_PRESIGNED_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ── 正常系 ──

  it('プレミアムユーザーが有効な video/mp4 を送ると 200 と presigned URL を返す', async () => {
    const req = await makeBearerRequest(USER_ID, VALID_BODY)
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.uploadUrl).toBe('string')
    expect(typeof body.fileUrl).toBe('string')
    expect(typeof body.key).toBe('string')
    expect(body.contentLength).toBe(VALID_BODY.fileSize)
  })

  it('fileUrl が R2_PUBLIC_URL を基底とした URL である', async () => {
    const req = await makeBearerRequest(USER_ID, VALID_BODY)
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    const body = await res.json()
    expect(body.fileUrl).toContain(FAKE_PUBLIC_URL)
  })

  it('R2_PUBLIC_URL 未設定時は r2.dev ドメインを使った fileUrl を返す', async () => {
    vi.stubEnv('R2_PUBLIC_URL', '')
    const req = await makeBearerRequest(USER_ID, VALID_BODY)
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    const body = await res.json()
    expect(body.fileUrl).toContain('r2.dev')
  })

  it('video/quicktime で 200 を返す', async () => {
    const req = await makeBearerRequest(USER_ID, { contentType: 'video/quicktime', fileSize: 1024 })
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  it('video/webm で 200 を返す', async () => {
    const req = await makeBearerRequest(USER_ID, { contentType: 'video/webm', fileSize: 1024 })
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  it('createPresignedPutUrl が呼ばれて uploadUrl に返り値が格納される', async () => {
    const req = await makeBearerRequest(USER_ID, VALID_BODY)
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(mockCreatePresignedPutUrl).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(body.uploadUrl).toBe(FAKE_PRESIGNED_URL)
  })

  // ── 認証エラー ──

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/upload/presigned', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/upload/presigned', {
      method: 'POST',
      headers: { authorization: 'Bearer invalid.token.here', 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: USER_ID, isSuspended: true, email: 'user@example.com' })
    const req = await makeBearerRequest(USER_ID, VALID_BODY)
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-id')
    const req = new NextRequest('http://localhost/api/v1/upload/presigned', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  // ── プレミアム制限 ──

  it('非プレミアムユーザーで 403 PREMIUM_REQUIRED', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(false)
    const req = await makeBearerRequest(USER_ID, VALID_BODY)
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('PREMIUM_REQUIRED')
  })

  it('プレミアムユーザーは PREMIUM_REQUIRED にならない', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(true)
    const req = await makeBearerRequest(USER_ID, VALID_BODY)
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  // ── バリデーションエラー ──

  it('不正な JSON ボディで 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(USER_ID)
    const req = new NextRequest('http://localhost/api/v1/upload/presigned', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'not-json{',
    })
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('許可されていない contentType（image/jpeg）で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, { contentType: 'image/jpeg', fileSize: 1024 })
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('fileSize がゼロで 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, { contentType: 'video/mp4', fileSize: 0 })
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('fileSize が MAX_VIDEO_SIZE 超過で 400 VALIDATION_ERROR', async () => {
    const oversized = 80 * 1024 * 1024 + 1 // 80MB + 1byte
    const req = await makeBearerRequest(USER_ID, { contentType: 'video/mp4', fileSize: oversized })
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な folder 値で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, {
      contentType: 'video/mp4',
      fileSize: 1024,
      folder: '../malicious',
    })
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  // ── レート制限 ──

  it('checkUserRateLimit 超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeBearerRequest(USER_ID, VALID_BODY)
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('checkDailyLimit 超過で 429 RATE_LIMITED', async () => {
    mockCheckDailyLimit.mockResolvedValueOnce({ allowed: false, count: 51, limit: 50 })
    const req = await makeBearerRequest(USER_ID, VALID_BODY)
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  // ── R2 未設定 ──

  it('R2_ACCOUNT_ID 未設定で 503 SERVER_MISCONFIGURED', async () => {
    vi.stubEnv('R2_ACCOUNT_ID', '')
    const req = await makeBearerRequest(USER_ID, VALID_BODY)
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SERVER_MISCONFIGURED')
  })

  it('R2_ACCESS_KEY_ID 未設定で 503 SERVER_MISCONFIGURED', async () => {
    vi.stubEnv('R2_ACCESS_KEY_ID', '')
    const req = await makeBearerRequest(USER_ID, VALID_BODY)
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SERVER_MISCONFIGURED')
  })

  it('R2_SECRET_ACCESS_KEY 未設定で 503 SERVER_MISCONFIGURED', async () => {
    vi.stubEnv('R2_SECRET_ACCESS_KEY', '')
    const req = await makeBearerRequest(USER_ID, VALID_BODY)
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SERVER_MISCONFIGURED')
  })

  it('createPresignedPutUrl が throw すると 500 INTERNAL_ERROR', async () => {
    mockCreatePresignedPutUrl.mockImplementationOnce(() => { throw new Error('sign failed') })
    const req = await makeBearerRequest(USER_ID, VALID_BODY)
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  // ── エラーレスポンス形式 ──

  it('エラーレスポンスは { error: { code, message, status } } 形式', async () => {
    mockIsPremiumUser.mockResolvedValueOnce(false)
    const req = await makeBearerRequest(USER_ID, VALID_BODY)
    const { POST } = await import('@/app/api/v1/upload/presigned/route')
    const res = await POST(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
