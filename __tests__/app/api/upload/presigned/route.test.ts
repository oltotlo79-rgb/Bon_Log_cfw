// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn(),
  checkDailyLimit: vi.fn(),
}))

// MAX_VIDEO_SIZE を 256MB に固定したい一方で、他の制限値（MAX_IMAGE_SIZE 等）は
// errors/content.ts が依存しているため実値を維持する必要がある。
vi.mock('@/lib/constants/limits', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/constants/limits')>()
  return {
    ...actual,
    MAX_VIDEO_SIZE: 256 * 1024 * 1024,
    PRESIGNED_URL_EXPIRY_SECONDS: 3600,
  }
})

// 実装で参照するエラー定数が増えても追従する必要がないよう、実モジュールをそのまま使う。
// （限定的なモック化は実装変更時にテストが落ちる原因になっていた）
vi.mock('@/lib/constants/errors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/constants/errors')>()
  return { ...actual }
})

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}))

vi.mock('@/lib/storage/s3-sign', () => ({
  createPresignedPutUrl: vi.fn().mockReturnValue('https://presigned.example.com/upload'),
}))

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/upload/presigned', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/upload/presigned', async () => {
  const { auth } = await import('@/lib/auth')
  const { checkUserRateLimit, checkDailyLimit } = await import('@/lib/rate-limit')

  const mockAuth = auth as ReturnType<typeof vi.fn>
  const mockRateLimit = checkUserRateLimit as ReturnType<typeof vi.fn>
  const mockDailyLimit = checkDailyLimit as ReturnType<typeof vi.fn>

  const validBody = {
    contentType: 'video/mp4',
    fileSize: 10 * 1024 * 1024, // 10MB
    folder: 'posts',
  }

  const savedEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    // デフォルトで認証・制限を通過させる
    mockAuth.mockResolvedValue({ user: { id: 'user1' } })
    mockRateLimit.mockResolvedValue({ success: true })
    mockDailyLimit.mockResolvedValue({ allowed: true, count: 1, limit: 50 })

    // R2環境変数を設定
    process.env.R2_ACCOUNT_ID = 'test-account'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET_NAME = 'test-bucket'
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com'
  })

  afterEach(() => {
    process.env = { ...savedEnv }
  })

  it('未認証の場合401を返す', async () => {
    mockAuth.mockResolvedValue(null)

    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest(validBody))

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('認証が必要です')
  })

  it('レートリミット超過時に429を返す', async () => {
    mockRateLimit.mockResolvedValue({ success: false })

    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest(validBody))

    expect(response.status).toBe(429)
    const data = await response.json()
    expect(data.error).toContain('アップロードが多すぎます')
  })

  it('日次制限超過時に429を返し ERR_DAILY_UPLOAD_LIMIT のテンプレ形式エラーを返す', async () => {
    mockDailyLimit.mockResolvedValue({ allowed: false, count: 50, limit: 50 })

    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest(validBody))

    expect(response.status).toBe(429)
    const data = await response.json()
    // テンプレートに limit 値（50）が埋め込まれていることを確認
    expect(data.error).toContain('1日のアップロード上限')
    expect(data.error).toContain('50')
  })

  it('不正な contentType で400を返す', async () => {
    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest({
      ...validBody,
      contentType: 'application/pdf',
    }))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('許可されていない')
  })

  it('不正な folder で400を返す', async () => {
    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest({
      ...validBody,
      folder: '../etc/passwd',
    }))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('無効なフォルダ')
  })

  it('contentType または fileSize 未指定で400を返す', async () => {
    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest({ folder: 'posts' }))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('contentType')
  })

  it('ファイルサイズ超過で400を返す', async () => {
    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest({
      ...validBody,
      fileSize: 300 * 1024 * 1024, // 300MB > 256MB
    }))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('MB以下')
  })

  it('R2環境変数未設定で500を返す', async () => {
    delete process.env.R2_ACCOUNT_ID
    delete process.env.R2_ACCESS_KEY_ID
    delete process.env.R2_SECRET_ACCESS_KEY

    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest(validBody))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toContain('ストレージが設定されていません')
  })

  it('ACCESS_KEY_IDのみ未設定でも500を返す', async () => {
    delete process.env.R2_ACCESS_KEY_ID

    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest(validBody))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toContain('ストレージが設定されていません')
  })

  it('SECRET_ACCESS_KEYのみ未設定でも500を返す', async () => {
    delete process.env.R2_SECRET_ACCESS_KEY

    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest(validBody))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toContain('ストレージが設定されていません')
  })

  it('正常にpresigned URLを返す', async () => {
    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest(validBody))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.presignedUrl).toBe('https://presigned.example.com/upload')
    expect(data.fileUrl).toMatch(/^https:\/\/cdn\.example\.com\/posts\//)
    expect(data.key).toMatch(/^posts\//)
  })

  it('R2_PUBLIC_URL 未設定時はデフォルトURLを生成する', async () => {
    delete process.env.R2_PUBLIC_URL

    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest(validBody))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.fileUrl).toMatch(/^https:\/\/test-bucket\.test-account\.r2\.dev\/posts\//)
  })

  it('video/quicktime は .mov 拡張子を使う', async () => {
    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest({
      ...validBody,
      contentType: 'video/quicktime',
    }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.key).toMatch(/\.mov$/)
  })

  it('video/webm は .webm 拡張子を使う', async () => {
    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest({
      ...validBody,
      contentType: 'video/webm',
    }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.key).toMatch(/\.webm$/)
  })

  it('folder パラメータ省略時はデフォルト posts を使う', async () => {
    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest({
      contentType: 'video/mp4',
      fileSize: 10 * 1024 * 1024,
    }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.key).toMatch(/^posts\//)
  })

  it('許可されたフォルダ avatars を受け入れる', async () => {
    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest({
      ...validBody,
      folder: 'avatars',
    }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.key).toMatch(/^avatars\//)
  })

  it('JSON パース失敗（不正な body）で 500 を返し ERR_PRESIGNED_URL_FAILED を返す', async () => {
    // request.json() を例外にするカスタム Request を渡し catch 節を実行させる
    const badRequest = {
      json: () => Promise.reject(new Error('invalid JSON')),
    } as unknown as NextRequest

    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(badRequest)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('署名付きURLの生成に失敗しました')
  })

  it('createPresignedPutUrl が例外を投げた場合は 500 と ERR_PRESIGNED_URL_FAILED を返す', async () => {
    const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
    vi.mocked(createPresignedPutUrl).mockImplementationOnce(() => {
      throw new Error('signing failed')
    })

    const { POST } = await import('@/app/api/upload/presigned/route')
    const response = await POST(createRequest(validBody))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('署名付きURLの生成に失敗しました')
  })
})
