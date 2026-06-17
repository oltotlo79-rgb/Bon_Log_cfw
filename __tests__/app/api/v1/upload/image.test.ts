// @vitest-environment node
/**
 * POST /api/v1/upload/image のユニットテスト
 *
 * 200（成功）/ 400（バリデーション・マジックバイト・サイズ超過）/ 401 / 403 ゲスト /
 * 403 停止 / 429 レート / 500 の全分岐を検証する。
 * storage の uploadFile をモックし、EXIF 除去経路（呼び出し確認）を検証する。
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
// Mock: rate-limit
// ──────────────────────────────────────────────────
const mockCheckUserRateLimit = vi.fn()
const mockCheckDailyLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  checkDailyLimit: (...args: unknown[]) => mockCheckDailyLimit(...args),
}))

// ──────────────────────────────────────────────────
// Mock: storage（uploadFile でアップロード＋EXIF除去）
// ──────────────────────────────────────────────────
const mockUploadFile = vi.fn()
vi.mock('@/lib/storage', () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
}))

// ──────────────────────────────────────────────────
// Mock: file-validation（validateImageFile）
// ──────────────────────────────────────────────────
const mockValidateImageFile = vi.fn()
vi.mock('@/lib/file-validation', () => ({
  validateImageFile: (...args: unknown[]) => mockValidateImageFile(...args),
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
const USER_ID = 'user-image-upload'
const FAKE_URL = 'https://cdn.example.com/post-images/test-file.jpg'

/**
 * JPEG マジックバイト（FFD8FFE0 = JFIF ヘッダー）を持つ最小バイト列
 * 実際のファイルバイトの代わりに使用する。
 */
const JPEG_MAGIC_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])

/**
 * PNG マジックバイト（89504E47 = PNG シグネチャ）
 */
const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * 偽装バイト列：Content-Type は image/jpeg を宣言しているが実際は PNG マジックバイト
 */
const PNG_BYTES_DISGUISED_AS_JPEG = PNG_MAGIC_BYTES

async function makeBearerRequestWithFile(
  userId: string,
  file: File,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const formData = new FormData()
  formData.append('file', file)
  return new NextRequest('http://localhost/api/v1/upload/image', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: formData,
  })
}

function makeJpegFile(
  sizeBytes: number = JPEG_MAGIC_BYTES.length,
  name = 'test.jpg',
): File {
  const bytes = sizeBytes <= JPEG_MAGIC_BYTES.length
    ? JPEG_MAGIC_BYTES.slice(0, sizeBytes)
    : Buffer.concat([JPEG_MAGIC_BYTES, Buffer.alloc(sizeBytes - JPEG_MAGIC_BYTES.length)])
  return new File([bytes], name, { type: 'image/jpeg' })
}

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────
describe('POST /api/v1/upload/image', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()

    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockCheckDailyLimit.mockResolvedValue({ allowed: true, count: 1, limit: 50 })
    mockValidateImageFile.mockReturnValue({ valid: true, detectedType: 'image/jpeg' })
    mockUploadFile.mockResolvedValue({ success: true, url: FAKE_URL })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ── 正常系 ──

  it('有効な JPEG ファイルで 200 と url を返す', async () => {
    const file = makeJpegFile()
    const req = await makeBearerRequestWithFile(USER_ID, file)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe(FAKE_URL)
  })

  it('uploadFile（storage）が呼ばれることを確認（EXIF 除去経路）', async () => {
    const file = makeJpegFile()
    const req = await makeBearerRequestWithFile(USER_ID, file)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    await POST(req)

    expect(mockUploadFile).toHaveBeenCalledOnce()
    const [buffer, filename, mimeType, folder] = mockUploadFile.mock.calls[0] as [Buffer, string, string, string]
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(typeof filename).toBe('string')
    expect(mimeType).toBe('image/jpeg')
    expect(typeof folder).toBe('string')
  })

  it('uploadFile の戻り値 url がレスポンスに含まれる', async () => {
    mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://cdn.example.com/image.jpg' })
    const file = makeJpegFile()
    const req = await makeBearerRequestWithFile(USER_ID, file)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    const body = await res.json()
    expect(body.url).toBe('https://cdn.example.com/image.jpg')
  })

  it('validateImageFile が PNG を検出した場合は mimeType が image/png になる', async () => {
    mockValidateImageFile.mockReturnValueOnce({ valid: true, detectedType: 'image/png' })
    const pngFile = new File([PNG_MAGIC_BYTES], 'test.png', { type: 'image/png' })
    const req = await makeBearerRequestWithFile(USER_ID, pngFile)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    await POST(req)

    const [, , mimeType] = mockUploadFile.mock.calls[0] as [Buffer, string, string, string]
    expect(mimeType).toBe('image/png')
  })

  // ── 認証エラー ──

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const formData = new FormData()
    formData.append('file', makeJpegFile())
    const req = new NextRequest('http://localhost/api/v1/upload/image', {
      method: 'POST',
      body: formData,
    })
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const formData = new FormData()
    formData.append('file', makeJpegFile())
    const req = new NextRequest('http://localhost/api/v1/upload/image', {
      method: 'POST',
      headers: { authorization: 'Bearer invalid.jwt.token' },
      body: formData,
    })
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: USER_ID, isSuspended: true, email: 'user@example.com' })
    const file = makeJpegFile()
    const req = await makeBearerRequestWithFile(USER_ID, file)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ゲストアカウントで 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'guest-id', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-id')
    const formData = new FormData()
    formData.append('file', makeJpegFile())
    const req = new NextRequest('http://localhost/api/v1/upload/image', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: formData,
    })
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  // ── バリデーション・マジックバイト検証 ──

  it('ファイルフィールドがない（ファイル未選択）で 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(USER_ID)
    const formData = new FormData()
    // file フィールドなし
    const req = new NextRequest('http://localhost/api/v1/upload/image', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: formData,
    })
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('ファイルサイズが MAX_IMAGE_SIZE（4MB）を超えると 400 VALIDATION_ERROR', async () => {
    const oversizedBytes = 4 * 1024 * 1024 + 1
    const oversizedFile = new File([Buffer.alloc(oversizedBytes, 0xff)], 'large.jpg', { type: 'image/jpeg' })
    const req = await makeBearerRequestWithFile(USER_ID, oversizedFile)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('MIME 偽装（Content-Type は image/jpeg、実バイトは PNG）で 400 VALIDATION_ERROR', async () => {
    // validateImageFile が MIME 不一致を検出して invalid を返す
    mockValidateImageFile.mockReturnValueOnce({ valid: false, error: '許可されていない画像形式です' })

    const disguisedFile = new File([PNG_BYTES_DISGUISED_AS_JPEG], 'fake.jpg', { type: 'image/jpeg' })
    const req = await makeBearerRequestWithFile(USER_ID, disguisedFile)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('マジックバイト検出不可で 400 VALIDATION_ERROR', async () => {
    mockValidateImageFile.mockReturnValueOnce({ valid: false, error: 'ファイル形式を判別できません' })

    const unknownBytes = Buffer.from([0x00, 0x01, 0x02, 0x03])
    const unknownFile = new File([unknownBytes], 'unknown.jpg', { type: 'image/jpeg' })
    const req = await makeBearerRequestWithFile(USER_ID, unknownFile)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('許可されていない MIME タイプ（image/gif）で 400 VALIDATION_ERROR', async () => {
    // validateImageFile が gif を弾く
    mockValidateImageFile.mockReturnValueOnce({ valid: false, error: '許可されていない形式です' })

    const gifBytes = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    const gifFile = new File([gifBytes], 'test.gif', { type: 'image/gif' })
    const req = await makeBearerRequestWithFile(USER_ID, gifFile)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  // ── レート制限 ──

  it('checkUserRateLimit 超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const file = makeJpegFile()
    const req = await makeBearerRequestWithFile(USER_ID, file)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('checkDailyLimit 超過で 429 RATE_LIMITED', async () => {
    mockCheckDailyLimit.mockResolvedValueOnce({ allowed: false, count: 51, limit: 50 })
    const file = makeJpegFile()
    const req = await makeBearerRequestWithFile(USER_ID, file)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  // ── ストレージエラー ──

  it('uploadFile が success:false を返すと 500 INTERNAL_ERROR', async () => {
    mockUploadFile.mockResolvedValueOnce({ success: false, error: 'upload failed' })
    const file = makeJpegFile()
    const req = await makeBearerRequestWithFile(USER_ID, file)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('uploadFile が url を返さない場合も 500 INTERNAL_ERROR', async () => {
    mockUploadFile.mockResolvedValueOnce({ success: true, url: undefined })
    const file = makeJpegFile()
    const req = await makeBearerRequestWithFile(USER_ID, file)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('uploadFile が throw すると 500 INTERNAL_ERROR', async () => {
    mockUploadFile.mockRejectedValueOnce(new Error('unexpected failure'))
    const file = makeJpegFile()
    const req = await makeBearerRequestWithFile(USER_ID, file)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  // ── エラーレスポンス形式 ──

  it('エラーレスポンスは { error: { code, message, status } } 形式', async () => {
    const req = new NextRequest('http://localhost/api/v1/upload/image', {
      method: 'POST',
      body: new FormData(),
    })
    const { POST } = await import('@/app/api/v1/upload/image/route')
    const res = await POST(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  // ── バリデーション実行順序の確認（不正入力でレート制限を消費しない）──

  it('サイズ超過はレート制限より先にチェックされる（レート制限モックが呼ばれない）', async () => {
    const oversizedBytes = 4 * 1024 * 1024 + 1
    const oversizedFile = new File([Buffer.alloc(oversizedBytes, 0x00)], 'large.jpg', { type: 'image/jpeg' })
    const req = await makeBearerRequestWithFile(USER_ID, oversizedFile)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    await POST(req)

    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })

  it('マジックバイト検証失敗はレート制限より先にチェックされる（レート制限モックが呼ばれない）', async () => {
    mockValidateImageFile.mockReturnValueOnce({ valid: false, error: '形式不正' })
    const file = makeJpegFile()
    const req = await makeBearerRequestWithFile(USER_ID, file)
    const { POST } = await import('@/app/api/v1/upload/image/route')
    await POST(req)

    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })
})
