// @vitest-environment node
 
import { vi } from 'vitest'
export {};

// File system mocks
const mockMkdir = vi.fn()
const mockWriteFile = vi.fn()
const mockUnlink = vi.fn()

vi.mock('fs/promises', () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}))

// Logger mock
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// s3-sign mock
const mockS3Send = vi.fn()

vi.mock('@/lib/storage/s3-sign', () => ({
  putObject: (...args: unknown[]) => mockS3Send(...args),
  deleteObject: (...args: unknown[]) => mockS3Send(...args),
}))

// Global fetch mock
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Storage Module', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    // 環境変数をリセット
    delete process.env.STORAGE_PROVIDER
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_STORAGE_BUCKET
    delete process.env.R2_ACCOUNT_ID
    delete process.env.R2_ACCESS_KEY_ID
    delete process.env.R2_SECRET_ACCESS_KEY
    delete process.env.R2_BUCKET_NAME
    delete process.env.R2_PUBLIC_URL
  })

  describe('Local Storage Provider', async () => {
    beforeEach(() => {
      process.env.STORAGE_PROVIDER = 'local'
    })

    it('ファイルをローカルストレージにアップロードできる', async () => {
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toMatch(/^\/uploads\/avatars\/\d+-[a-f0-9]+\.jpg$/)
      expect(mockMkdir).toHaveBeenCalled()
      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('ファイルをローカルストレージから削除できる', async () => {
      mockUnlink.mockResolvedValue(undefined)

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('/uploads/avatars/test.jpg')

      expect(result.success).toBe(true)
      expect(mockUnlink).toHaveBeenCalled()
    })

    it('ディレクトリ作成エラー時はエラーを返す', async () => {
      mockMkdir.mockRejectedValue(new Error('Permission denied'))

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Permission denied')
    })

    it('ファイル書き込みエラー時はエラーを返す', async () => {
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockRejectedValue(new Error('Disk full'))

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'posts'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Disk full')
    })

    it('削除エラー時はエラーを返す', async () => {
      mockUnlink.mockRejectedValue(new Error('File not found'))

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('/uploads/avatars/notexist.jpg')

      expect(result.success).toBe(false)
      expect(result.error).toBe('File not found')
    })

    it('PNG画像の拡張子を正しく処理する', async () => {
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.png',
        'image/png',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toMatch(/\.png$/)
    })

    it('WebP画像の拡張子を正しく処理する', async () => {
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.webp',
        'image/webp',
        'posts'
      )

      expect(result.success).toBe(true)
      expect(result.url).toMatch(/\.webp$/)
    })

    it('GIF画像の拡張子を正しく処理する', async () => {
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.gif',
        'image/gif',
        'posts'
      )

      expect(result.success).toBe(true)
      expect(result.url).toMatch(/\.gif$/)
    })

    it('不明なMIMEタイプはjpgにフォールバック', async () => {
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.unknown',
        'application/octet-stream',
        'posts'
      )

      expect(result.success).toBe(true)
      expect(result.url).toMatch(/\.jpg$/)
    })
  })

  describe('Supabase Storage Provider', async () => {
    beforeEach(() => {
      process.env.STORAGE_PROVIDER = 'supabase'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
      process.env.SUPABASE_STORAGE_BUCKET = 'testbucket'
    })

    it('ファイルをSupabase Storageにアップロードできる', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toContain('supabase.co')
    })

    it('ファイルをSupabase Storageから削除できる', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
      })

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile(
        'https://test.supabase.co/storage/v1/object/public/testbucket/avatars/test.jpg'
      )

      expect(result.success).toBe(true)
    })

    it('認証情報が未設定の場合はエラーを返す', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('credentials')
    })

    it('アップロード失敗時はエラーを返す', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Upload failed'),
      })

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Upload failed')
    })

    it('無効なURLの削除はエラーを返す', async () => {
      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('https://invalid.url/path/file.jpg')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid')
    })

    it('削除失敗時はエラーを返す', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Delete failed'),
      })

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile(
        'https://test.supabase.co/storage/v1/object/public/testbucket/avatars/test.jpg'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Delete failed')
    })
  })

  describe('Cloudflare R2 Storage Provider', async () => {
    beforeEach(() => {
      process.env.STORAGE_PROVIDER = 'r2'
      process.env.R2_ACCOUNT_ID = 'test-account-id'
      process.env.R2_ACCESS_KEY_ID = 'test-access-key'
      process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key'
      process.env.R2_BUCKET_NAME = 'testbucket'
      process.env.R2_PUBLIC_URL = 'https://cdn.example.com'
    })

    it('ファイルをCloudflare R2にアップロードできる', async () => {
      mockS3Send.mockResolvedValue({})

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toContain('cdn.example.com')
    })

    it('公開URLが未設定の場合はデフォルトURLを使用', async () => {
      delete process.env.R2_PUBLIC_URL
      mockS3Send.mockResolvedValue({})

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toContain('r2.dev')
    })

    it('ファイルをCloudflare R2から削除できる', async () => {
      mockS3Send.mockResolvedValue({})

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('https://cdn.example.com/avatars/test.jpg')

      expect(result.success).toBe(true)
    })

    it('認証情報が未設定の場合はエラーを返す', async () => {
      delete process.env.R2_ACCESS_KEY_ID

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('credentials')
    })

    it('アップロードエラー時はエラーを返す', async () => {
      mockS3Send.mockRejectedValue(new Error('R2 error'))

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('R2 error')
    })

    it('削除エラー時はエラーを返す', async () => {
      mockS3Send.mockRejectedValue(new Error('Delete error'))

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('https://cdn.example.com/avatars/test.jpg')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Delete error')
    })
  })

  describe('Provider Selection', async () => {
    it('未設定の場合はローカルプロバイダーを使用', async () => {
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toMatch(/^\/uploads\//)
    })

    it('不明なプロバイダー名の場合はローカルにフォールバック', async () => {
      process.env.STORAGE_PROVIDER = 'unknown'
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(true)
      expect(result.url).toMatch(/^\/uploads\//)
    })
  })

  describe('本番環境では内部エラーを返さない', () => {
    function setNodeEnv(value: string) {
      ;(process.env as { NODE_ENV: string }).NODE_ENV = value
    }

    afterEach(() => {
      setNodeEnv('test')
    })

    it('NODE_ENV=production のときアップロード失敗は汎用メッセージを返す', async () => {
      setNodeEnv('production')
      process.env.STORAGE_PROVIDER = 'local'
      mockMkdir.mockResolvedValue(undefined)
      mockWriteFile.mockRejectedValue(new Error('Internal disk error'))

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatars'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('アップロードに失敗しました')
    })

    it('NODE_ENV=production のとき削除失敗は汎用メッセージを返す', async () => {
      setNodeEnv('production')
      process.env.STORAGE_PROVIDER = 'local'
      mockUnlink.mockRejectedValue(new Error('Internal delete error'))

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('/uploads/avatars/file.jpg')

      expect(result.success).toBe(false)
      expect(result.error).toBe('削除に失敗しました')
    })
  })
})
