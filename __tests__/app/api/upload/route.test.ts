// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn(),
  checkDailyLimit: vi.fn(),
}))

vi.mock('@/lib/file-validation', () => ({
  validateImageFile: vi.fn(),
  validateVideoFile: vi.fn(),
  generateSafeFileName: vi.fn(),
}))

vi.mock('@/lib/storage', () => ({
  uploadFile: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

function createMockRequest(file?: File) {
  const formData = new FormData()
  if (file) {
    formData.append('file', file)
  }
  return {
    formData: () => Promise.resolve(formData),
  } as unknown as import('next/server').NextRequest
}

describe('Upload API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('未認証で401を返す', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue(null)

    const { POST } = await import('@/app/api/upload/route')
    const response = await POST(createMockRequest())
    expect(response.status).toBe(401)
  })

  it('レート制限超過で429を返す', async () => {
    // 監査 P0 対応で auth → file 検証 → rate-limit → daily-limit の順序になったため、
    // rate-limit を確認するには valid file (実 JPEG マジックバイト) を渡す必要がある
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      expires: '2099-01-01',
    })

    const { validateImageFile } = await import('@/lib/file-validation')
    vi.mocked(validateImageFile).mockReturnValue({ valid: true })

    const { checkUserRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkUserRateLimit).mockResolvedValue({ success: false, remaining: 0 })

    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
    const file = new File([jpegHeader], 'a.jpg', { type: 'image/jpeg' })
    const { POST } = await import('@/app/api/upload/route')
    const response = await POST(createMockRequest(file))
    expect(response.status).toBe(429)
  })

  it('日次制限超過で429を返す', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      expires: '2099-01-01',
    })

    const { validateImageFile } = await import('@/lib/file-validation')
    vi.mocked(validateImageFile).mockReturnValue({ valid: true })

    const { checkUserRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkUserRateLimit).mockResolvedValue({ success: true, remaining: 4 })

    const { checkDailyLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkDailyLimit).mockResolvedValue({ allowed: false, limit: 50 })

    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
    const file = new File([jpegHeader], 'a.jpg', { type: 'image/jpeg' })
    const { POST } = await import('@/app/api/upload/route')
    const response = await POST(createMockRequest(file))
    expect(response.status).toBe(429)
  })

  it('ファイル未選択で400を返す', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      expires: '2099-01-01',
    })

    const { checkUserRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkUserRateLimit).mockResolvedValue({ success: true, remaining: 4 })

    const { checkDailyLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkDailyLimit).mockResolvedValue({ allowed: true, limit: 50 })

    const { POST } = await import('@/app/api/upload/route')
    const response = await POST(createMockRequest())
    expect(response.status).toBe(400)
  })

  it('不正なファイルタイプで400を返す', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      expires: '2099-01-01',
    })

    const { checkUserRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkUserRateLimit).mockResolvedValue({ success: true, remaining: 4 })

    const { checkDailyLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkDailyLimit).mockResolvedValue({ allowed: true, limit: 50 })

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })

    const { POST } = await import('@/app/api/upload/route')
    const response = await POST(createMockRequest(file))
    expect(response.status).toBe(400)
  })

  it('サイズ超過の画像で400を返す', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      expires: '2099-01-01',
    })

    const { checkUserRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkUserRateLimit).mockResolvedValue({ success: true, remaining: 4 })

    const { checkDailyLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkDailyLimit).mockResolvedValue({ allowed: true, limit: 50 })

    const file = new File([Buffer.alloc(5 * 1024 * 1024)], 'test.jpg', { type: 'image/jpeg' })

    const { POST } = await import('@/app/api/upload/route')
    const response = await POST(createMockRequest(file))
    expect(response.status).toBe(400)
  })

  it('画像バリデーション失敗で400を返す', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      expires: '2099-01-01',
    })

    const { checkUserRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkUserRateLimit).mockResolvedValue({ success: true, remaining: 4 })

    const { checkDailyLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkDailyLimit).mockResolvedValue({ allowed: true, limit: 50 })

    const { validateImageFile } = await import('@/lib/file-validation')
    vi.mocked(validateImageFile).mockReturnValue({ valid: false, error: '無効な画像ファイル' } as ReturnType<typeof validateImageFile>)

    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })

    const { POST } = await import('@/app/api/upload/route')
    const response = await POST(createMockRequest(file))
    expect(response.status).toBe(400)
  })

  it('動画バリデーション失敗で400を返す', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      expires: '2099-01-01',
    })

    const { checkUserRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkUserRateLimit).mockResolvedValue({ success: true, remaining: 4 })

    const { checkDailyLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkDailyLimit).mockResolvedValue({ allowed: true, limit: 50 })

    const { validateVideoFile } = await import('@/lib/file-validation')
    vi.mocked(validateVideoFile).mockReturnValue({ valid: false, error: '無効な動画ファイル' } as ReturnType<typeof validateVideoFile>)

    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' })

    const { POST } = await import('@/app/api/upload/route')
    const response = await POST(createMockRequest(file))
    expect(response.status).toBe(400)
  })

  it('アップロード失敗で500を返す', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      expires: '2099-01-01',
    })

    const { checkUserRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkUserRateLimit).mockResolvedValue({ success: true, remaining: 4 })

    const { checkDailyLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkDailyLimit).mockResolvedValue({ allowed: true, limit: 50 })

    const { validateImageFile } = await import('@/lib/file-validation')
    vi.mocked(validateImageFile).mockReturnValue({ valid: true } as ReturnType<typeof validateImageFile>)

    const { uploadFile } = await import('@/lib/storage')
    vi.mocked(uploadFile).mockResolvedValue({ success: false, error: 'Storage error' })

    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })

    const { POST } = await import('@/app/api/upload/route')
    const response = await POST(createMockRequest(file))
    expect(response.status).toBe(500)
  })

  it('アップロード結果にURLがない場合500を返す', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      expires: '2099-01-01',
    })

    const { checkUserRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkUserRateLimit).mockResolvedValue({ success: true, remaining: 4 })

    const { checkDailyLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkDailyLimit).mockResolvedValue({ allowed: true, limit: 50 })

    const { validateImageFile } = await import('@/lib/file-validation')
    vi.mocked(validateImageFile).mockReturnValue({ valid: true } as ReturnType<typeof validateImageFile>)

    const { uploadFile } = await import('@/lib/storage')
    vi.mocked(uploadFile).mockResolvedValue({ success: true, url: null as unknown as string })

    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })

    const { POST } = await import('@/app/api/upload/route')
    const response = await POST(createMockRequest(file))
    expect(response.status).toBe(500)
  })

  it('画像アップロード成功', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      expires: '2099-01-01',
    })

    const { checkUserRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkUserRateLimit).mockResolvedValue({ success: true, remaining: 4 })

    const { checkDailyLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkDailyLimit).mockResolvedValue({ allowed: true, limit: 50 })

    const { validateImageFile } = await import('@/lib/file-validation')
    vi.mocked(validateImageFile).mockReturnValue({ valid: true } as ReturnType<typeof validateImageFile>)

    const { generateSafeFileName } = await import('@/lib/file-validation')
    vi.mocked(generateSafeFileName).mockReturnValue('safe-file.jpg')

    const { uploadFile } = await import('@/lib/storage')
    vi.mocked(uploadFile).mockResolvedValue({ success: true, url: 'https://cdn.example.com/img.jpg' })

    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })

    const { POST } = await import('@/app/api/upload/route')
    const response = await POST(createMockRequest(file))
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.url).toBe('https://cdn.example.com/img.jpg')
    expect(data.type).toBe('image')
  })

  it('動画アップロード成功', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      expires: '2099-01-01',
    })

    const { checkUserRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkUserRateLimit).mockResolvedValue({ success: true, remaining: 4 })

    const { checkDailyLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkDailyLimit).mockResolvedValue({ allowed: true, limit: 50 })

    const { validateVideoFile } = await import('@/lib/file-validation')
    vi.mocked(validateVideoFile).mockReturnValue({ valid: true } as ReturnType<typeof validateVideoFile>)

    const { generateSafeFileName } = await import('@/lib/file-validation')
    vi.mocked(generateSafeFileName).mockReturnValue('safe-file.mp4')

    const { uploadFile } = await import('@/lib/storage')
    vi.mocked(uploadFile).mockResolvedValue({ success: true, url: 'https://cdn.example.com/vid.mp4' })

    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' })

    const { POST } = await import('@/app/api/upload/route')
    const response = await POST(createMockRequest(file))
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.type).toBe('video')
  })
})
