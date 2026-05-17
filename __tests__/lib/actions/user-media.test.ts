// @vitest-environment node
import { vi } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// ロガーモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}))

// next/cacheモック
const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
}))

// ストレージモック
const mockUploadFile = vi.fn()
vi.mock('@/lib/storage', () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
}))

// ファイル検証モック
const mockValidateImageFile = vi.fn()
const mockGenerateSafeFileName = vi.fn()
vi.mock('@/lib/file-validation', () => ({
  validateImageFile: (...args: unknown[]) => mockValidateImageFile(...args),
  generateSafeFileName: (...args: unknown[]) => mockGenerateSafeFileName(...args),
}))

describe('User Media Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id, email: mockUser.email } })
    mockValidateImageFile.mockReturnValue({ valid: true, detectedType: 'image/jpeg' })
    mockGenerateSafeFileName.mockReturnValue('mock-uuid.jpg')
  })

  // ============================================================
  // uploadAvatar
  // ============================================================

  describe('uploadAvatar', async () => {
    it('アバター画像を正常にアップロードできる', async () => {
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/avatar.jpg' })
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, avatarUrl: 'https://example.com/avatar.jpg' })

      const { uploadAvatar } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test-image'], 'avatar.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadAvatar(formData)

      expect(result).toMatchObject({ success: true, data: { url: 'https://example.com/avatar.jpg' } })
    })

    it('アップロード後にuserテーブルのavatarUrlを更新する', async () => {
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/new-avatar.jpg' })
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, avatarUrl: 'https://example.com/new-avatar.jpg' })

      const { uploadAvatar } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      await uploadAvatar(formData)

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { avatarUrl: 'https://example.com/new-avatar.jpg' },
      })
    })

    it('アップロード後にrevalidatePathを呼び出す', async () => {
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/avatar.jpg' })
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser })

      const { uploadAvatar } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      await uploadAvatar(formData)

      expect(mockRevalidatePath).toHaveBeenCalledWith(`/users/${mockUser.id}`)
      expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/profile')
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { uploadAvatar } = await import('@/lib/actions/user-media')
      const formData = new FormData()
      const result = await uploadAvatar(formData)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ゲストの場合、エラーを返す', async () => {
      const { GUEST_EMAIL } = await import('@/lib/constants/guest')
      const { ERR_GUEST_CANNOT_CREATE } = await import('@/lib/constants/errors')
      mockAuth.mockResolvedValue({ user: { id: 'guest-id', email: GUEST_EMAIL } })

      const { uploadAvatar } = await import('@/lib/actions/user-media')
      const formData = new FormData()
      const result = await uploadAvatar(formData)

      expect(result).toMatchObject({ error: ERR_GUEST_CANNOT_CREATE })
    })

    it('ファイルが選択されていない場合、エラーを返す', async () => {
      const { uploadAvatar } = await import('@/lib/actions/user-media')
      const formData = new FormData()
      const result = await uploadAvatar(formData)

      expect(result).toMatchObject({ error: 'ファイルが選択されていません' })
    })

    it('ファイルサイズが上限を超える場合、エラーを返す', async () => {
      const { uploadAvatar } = await import('@/lib/actions/user-media')

      // 5MB超のファイルをモック
      const largeContent = 'a'.repeat(5 * 1024 * 1024 + 1)
      const mockFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadAvatar(formData)

      expect('error' in result && result.error).toBeTruthy()
    })

    it('許可されていないファイル形式の場合（validateImageFile失敗）、エラーを返す', async () => {
      mockValidateImageFile.mockReturnValueOnce({ valid: false, error: '無効な画像ファイルです' })

      const { uploadAvatar } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test'], 'file.bmp', { type: 'image/bmp' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadAvatar(formData)

      expect('error' in result).toBe(true)
    })

    it('ファイル形式がALLOWED_PROFILE_IMAGE_TYPESに含まれない場合、エラーを返す', async () => {
      // validateImageFileは通過するが、file.typeが許可リストにない場合
      mockValidateImageFile.mockReturnValueOnce({ valid: true, detectedType: 'image/gif' })

      const { uploadAvatar } = await import('@/lib/actions/user-media')

      const mockFile = new File(['GIF89a'], 'image.gif', { type: 'image/gif' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadAvatar(formData)

      expect(result).toMatchObject({ error: 'JPEG、PNG、WebP形式のみ対応しています' })
    })

    it('ストレージアップロードが失敗した場合、エラーを返す', async () => {
      mockUploadFile.mockResolvedValueOnce({ success: false, error: 'Storage error' })

      const { uploadAvatar } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadAvatar(formData)

      expect(result).toMatchObject({ error: 'アップロードに失敗しました' })
    })

    it('ストレージアップロードでurlがない場合、エラーを返す', async () => {
      mockUploadFile.mockResolvedValueOnce({ success: true, url: null })

      const { uploadAvatar } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadAvatar(formData)

      expect(result).toMatchObject({ error: 'アップロードに失敗しました' })
    })

    it('generateSafeFileNameを使用してファイル名を生成する', async () => {
      mockGenerateSafeFileName.mockReturnValueOnce('generated-safe-name.jpg')
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/avatar.jpg' })
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser })

      const { uploadAvatar } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test'], 'original-name.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      await uploadAvatar(formData)

      expect(mockGenerateSafeFileName).toHaveBeenCalledWith('original-name.jpg', 'image/jpeg')
    })

    it('PNG形式もアップロードできる', async () => {
      mockValidateImageFile.mockReturnValueOnce({ valid: true, detectedType: 'image/png' })
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/avatar.png' })
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser })

      const { uploadAvatar } = await import('@/lib/actions/user-media')

      const mockFile = new File(['png-data'], 'avatar.png', { type: 'image/png' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadAvatar(formData)

      expect(result.success).toBe(true)
    })

    it('WebP形式もアップロードできる', async () => {
      mockValidateImageFile.mockReturnValueOnce({ valid: true, detectedType: 'image/webp' })
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/avatar.webp' })
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser })

      const { uploadAvatar } = await import('@/lib/actions/user-media')

      const mockFile = new File(['webp-data'], 'avatar.webp', { type: 'image/webp' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadAvatar(formData)

      expect(result.success).toBe(true)
    })
  })

  // ============================================================
  // uploadHeader
  // ============================================================

  describe('uploadHeader', async () => {
    it('ヘッダー画像を正常にアップロードできる', async () => {
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/header.jpg' })
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, headerUrl: 'https://example.com/header.jpg' })

      const { uploadHeader } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test-image'], 'header.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadHeader(formData)

      expect(result).toMatchObject({ success: true, data: { url: 'https://example.com/header.jpg' } })
    })

    it('アップロード後にuserテーブルのheaderUrlを更新する', async () => {
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/new-header.jpg' })
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, headerUrl: 'https://example.com/new-header.jpg' })

      const { uploadHeader } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test'], 'header.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      await uploadHeader(formData)

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { headerUrl: 'https://example.com/new-header.jpg' },
      })
    })

    it('アップロード後にrevalidatePathを呼び出す', async () => {
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/header.jpg' })
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser })

      const { uploadHeader } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test'], 'header.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      await uploadHeader(formData)

      expect(mockRevalidatePath).toHaveBeenCalledWith(`/users/${mockUser.id}`)
      expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/profile')
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { uploadHeader } = await import('@/lib/actions/user-media')
      const formData = new FormData()
      const result = await uploadHeader(formData)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ゲストの場合、エラーを返す', async () => {
      const { GUEST_EMAIL } = await import('@/lib/constants/guest')
      const { ERR_GUEST_CANNOT_CREATE } = await import('@/lib/constants/errors')
      mockAuth.mockResolvedValue({ user: { id: 'guest-id', email: GUEST_EMAIL } })

      const { uploadHeader } = await import('@/lib/actions/user-media')
      const formData = new FormData()
      const result = await uploadHeader(formData)

      expect(result).toMatchObject({ error: ERR_GUEST_CANNOT_CREATE })
    })

    it('ファイルが選択されていない場合、エラーを返す', async () => {
      const { uploadHeader } = await import('@/lib/actions/user-media')
      const formData = new FormData()
      const result = await uploadHeader(formData)

      expect(result).toMatchObject({ error: 'ファイルが選択されていません' })
    })

    it('ファイルサイズが上限を超える場合、エラーを返す', async () => {
      const { uploadHeader } = await import('@/lib/actions/user-media')

      // 5MB超のファイルをモック
      const largeContent = 'a'.repeat(5 * 1024 * 1024 + 1)
      const mockFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadHeader(formData)

      expect('error' in result && result.error).toBeTruthy()
    })

    it('許可されていないファイル形式の場合（validateImageFile失敗）、エラーを返す', async () => {
      mockValidateImageFile.mockReturnValueOnce({ valid: false, error: '許可されていないファイル形式です' })

      const { uploadHeader } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test'], 'image.bmp', { type: 'image/bmp' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadHeader(formData)

      expect('error' in result).toBe(true)
    })

    it('ファイル形式がALLOWED_PROFILE_IMAGE_TYPESに含まれない場合、エラーを返す', async () => {
      mockValidateImageFile.mockReturnValueOnce({ valid: true, detectedType: 'image/gif' })

      const { uploadHeader } = await import('@/lib/actions/user-media')

      const mockFile = new File(['GIF89a'], 'image.gif', { type: 'image/gif' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadHeader(formData)

      expect(result).toMatchObject({ error: 'JPEG、PNG、WebP形式のみ対応しています' })
    })

    it('ストレージアップロードが失敗した場合、エラーを返す', async () => {
      mockUploadFile.mockResolvedValueOnce({ success: false, error: 'Upload failed' })

      const { uploadHeader } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test'], 'header.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadHeader(formData)

      expect(result).toMatchObject({ error: 'アップロードに失敗しました' })
    })

    it('ストレージアップロードでurlがない場合、エラーを返す', async () => {
      mockUploadFile.mockResolvedValueOnce({ success: true, url: undefined })

      const { uploadHeader } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test'], 'header.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadHeader(formData)

      expect(result).toMatchObject({ error: 'アップロードに失敗しました' })
    })

    it('generateSafeFileNameを使用してファイル名を生成する', async () => {
      mockGenerateSafeFileName.mockReturnValueOnce('generated-header.png')
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/header.png' })
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser })

      const { uploadHeader } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test'], 'my-header.png', { type: 'image/png' })
      const formData = new FormData()
      formData.append('file', mockFile)

      await uploadHeader(formData)

      expect(mockGenerateSafeFileName).toHaveBeenCalledWith('my-header.png', 'image/png')
    })

    it('validateImageFileで特定のエラーメッセージが返る場合、そのメッセージを返す', async () => {
      mockValidateImageFile.mockReturnValueOnce({ valid: false, error: 'カスタムエラーメッセージ' })

      const { uploadHeader } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test'], 'image.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadHeader(formData)

      expect(result).toMatchObject({ error: 'カスタムエラーメッセージ' })
    })

    it('validateImageFileでerrorがundefinedの場合、デフォルトメッセージを返す', async () => {
      mockValidateImageFile.mockReturnValueOnce({ valid: false, error: undefined })

      const { uploadHeader } = await import('@/lib/actions/user-media')

      const mockFile = new File(['test'], 'image.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadHeader(formData)

      expect(result).toMatchObject({ error: '無効な画像ファイルです' })
    })
  })
})
