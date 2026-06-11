// @vitest-environment node
import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, createMockFormData } from '../../utils/test-utils'

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

// revalidatePathモック（unstable_cacheはテスト環境で動作しないため合わせてモック）
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

// ストレージモック
const mockUploadFile = vi.fn()
vi.mock('@/lib/storage', () => ({
  uploadFile: mockUploadFile,
}))

// ファイル検証モック
vi.mock('@/lib/file-validation', () => ({
  validateImageFile: vi.fn().mockReturnValue({ valid: true, detectedType: 'image/jpeg' }),
  generateSafeFileName: vi.fn().mockReturnValue('mock-uuid.jpg'),
}))

describe('User Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  })

  // ============================================================
  // getUser
  // ============================================================

  /** ActionResult 成功レスポンスから data 部を取り出す（型安全） */
  function unwrapOk<T>(result: { success: true; data?: unknown } | { success: false; error: string }): T {
    if (!result.success) throw new Error(`Expected success, got error: ${result.error}`)
    if (!result.data) throw new Error('Expected data to be defined')
    return result.data as T
  }

  describe('getUser', async () => {
    it('ユーザー情報を取得できる', async () => {
      const userWithCount = {
        ...mockUser,
        _count: {
          posts: 10,
          followers: 50,
          following: 30,
        },
      }
      mockPrisma.user.findUnique.mockResolvedValueOnce(userWithCount)

      const { getUser } = await import('@/lib/actions/user')
      const result = await getUser(mockUser.id)

      const data = unwrapOk<{ user: { postsCount: number; followersCount: number; followingCount: number } }>(result)
      expect(data.user).toBeDefined()
      expect(data.user.postsCount).toBe(10)
      expect(data.user.followersCount).toBe(50)
      expect(data.user.followingCount).toBe(30)
    })

    it('ユーザーが見つからない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { getUser } = await import('@/lib/actions/user')
      const result = await getUser('nonexistent-id')

      expect('error' in result && result.error).toBe('ユーザーが見つかりません')
    })
  })

  // ============================================================
  // getCurrentUser
  // ============================================================

  describe('getCurrentUser', async () => {
    it('現在のユーザー情報を取得できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser)

      const { getCurrentUser } = await import('@/lib/actions/user')
      const result = await getCurrentUser()

      const data = unwrapOk<{ user: typeof mockUser }>(result)
      expect(data.user).toEqual(mockUser)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getCurrentUser } = await import('@/lib/actions/user')
      const result = await getCurrentUser()

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('ユーザーが見つからない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { getCurrentUser } = await import('@/lib/actions/user')
      const result = await getCurrentUser()

      expect('error' in result && result.error).toBe('ユーザー情報の取得に失敗しました')
    })
  })

  // ============================================================
  // updateProfile
  // ============================================================

  describe('updateProfile', async () => {
    it('プロフィールを更新できる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, nickname: '新しいニックネーム' })

      const { updateProfile } = await import('@/lib/actions/user')
      const formData = createMockFormData({
        nickname: '新しいニックネーム',
        bio: '新しい自己紹介',
        location: '東京都',
      })
      const result = await updateProfile(formData)

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          nickname: '新しいニックネーム',
          bio: '新しい自己紹介',
          location: '東京都',
        }),
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { updateProfile } = await import('@/lib/actions/user')
      const formData = createMockFormData({ nickname: 'テスト' })
      const result = await updateProfile(formData)

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('ゲストの場合は作成不可エラーを返す', async () => {
      const { GUEST_EMAIL } = await import('@/lib/constants/guest')
      const { ERR_GUEST_CANNOT_CREATE } = await import('@/lib/constants/errors')
      mockAuth.mockResolvedValue({ user: { id: 'guest-1', email: GUEST_EMAIL } })

      const { updateProfile } = await import('@/lib/actions/user')
      const formData = createMockFormData({ nickname: 'テスト' })
      const result = await updateProfile(formData)

      expect('error' in result && result.error).toBe(ERR_GUEST_CANNOT_CREATE)
    })

    it('ニックネームが空の場合、エラーを返す', async () => {
      const { updateProfile } = await import('@/lib/actions/user')
      const formData = createMockFormData({ nickname: '' })
      const result = await updateProfile(formData)

      expect('error' in result && result.error).toBe('ニックネームを入力してください')
    })

    it('ニックネームが50文字を超える場合、エラーを返す', async () => {
      const { updateProfile } = await import('@/lib/actions/user')
      const formData = createMockFormData({ nickname: 'a'.repeat(51) })
      const result = await updateProfile(formData)

      expect('error' in result && result.error).toBe('ニックネームは50文字以内で入力してください')
    })

    it('自己紹介が200文字を超える場合、エラーを返す', async () => {
      const { updateProfile } = await import('@/lib/actions/user')
      const formData = createMockFormData({
        nickname: 'テスト',
        bio: 'a'.repeat(201),
      })
      const result = await updateProfile(formData)

      expect('error' in result && result.error).toBe('自己紹介は200文字以内で入力してください')
    })
  })

  // ============================================================
  // updatePrivacy
  // ============================================================

  describe('updatePrivacy', async () => {
    it('プライバシー設定を更新できる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, isPublic: false })

      const { updatePrivacy } = await import('@/lib/actions/user')
      const result = await updatePrivacy(false)

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { isPublic: false },
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { updatePrivacy } = await import('@/lib/actions/user')
      const result = await updatePrivacy(false)

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('ゲストの場合は作成不可エラーを返す', async () => {
      const { GUEST_EMAIL } = await import('@/lib/constants/guest')
      const { ERR_GUEST_CANNOT_CREATE } = await import('@/lib/constants/errors')
      mockAuth.mockResolvedValue({ user: { id: 'guest-1', email: GUEST_EMAIL } })

      const { updatePrivacy } = await import('@/lib/actions/user')
      const result = await updatePrivacy(false)

      expect('error' in result && result.error).toBe(ERR_GUEST_CANNOT_CREATE)
    })
  })

  // ============================================================
  // uploadAvatar
  // ============================================================

  describe('uploadAvatar', async () => {
    it('アバターをアップロードできる', async () => {
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/avatar.jpg' })
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, avatarUrl: 'https://example.com/avatar.jpg' })

      const { uploadAvatar } = await import('@/lib/actions/user')

      // File オブジェクトをモック
      const mockFile = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadAvatar(formData)

      expect(result).toMatchObject({ success: true, data: { url: 'https://example.com/avatar.jpg' } })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { uploadAvatar } = await import('@/lib/actions/user')
      const formData = new FormData()
      const result = await uploadAvatar(formData)

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('ファイルがない場合、エラーを返す', async () => {
      const { uploadAvatar } = await import('@/lib/actions/user')
      const formData = new FormData()
      const result = await uploadAvatar(formData)

      expect('error' in result && result.error).toBe('ファイルが選択されていません')
    })

    it('ファイルサイズが4MBを超える場合、エラーを返す', async () => {
      const { uploadAvatar } = await import('@/lib/actions/user')

      // 5MBのファイルをモック
      const largeContent = new Array(5 * 1024 * 1024).fill('a').join('')
      const mockFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadAvatar(formData)

      expect('error' in result && result.error).toBe('画像は4MB以下にしてください')
    })

    it('許可されていないファイル形式の場合、エラーを返す', async () => {
      const { uploadAvatar } = await import('@/lib/actions/user')

      const mockFile = new File(['test'], 'avatar.gif', { type: 'image/gif' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadAvatar(formData)

      expect('error' in result && result.error).toBe('JPEG、PNG、WebP形式のみ対応しています')
    })
  })

  // ============================================================
  // uploadHeader
  // ============================================================

  describe('uploadHeader', async () => {
    it('ヘッダー画像をアップロードできる', async () => {
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/header.jpg' })
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, headerUrl: 'https://example.com/header.jpg' })

      const { uploadHeader } = await import('@/lib/actions/user')

      const mockFile = new File(['test'], 'header.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const result = await uploadHeader(formData)

      expect(result).toMatchObject({ success: true, data: { url: 'https://example.com/header.jpg' } })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { uploadHeader } = await import('@/lib/actions/user')
      const formData = new FormData()
      const result = await uploadHeader(formData)

      expect('error' in result && result.error).toBe('認証が必要です')
    })
  })

  // ============================================================
  // deleteAccount
  // ============================================================

  describe('deleteAccount', async () => {
    it('アカウントを削除できる', async () => {
      mockPrisma.$transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          userAnalytics: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          message: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          conversationParticipant: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          notification: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          user: { delete: vi.fn().mockResolvedValue(mockUser) },
        }
        return callback(tx)
      })

      const { deleteAccount } = await import('@/lib/actions/user')
      const result = await deleteAccount()

      expect(result).toEqual({ success: true })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { deleteAccount } = await import('@/lib/actions/user')
      const result = await deleteAccount()

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('削除に失敗した場合、エラーを返す', async () => {
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('Database error'))

      const { deleteAccount } = await import('@/lib/actions/user')
      const result = await deleteAccount()

      expect('error' in result && result.error).toBe('アカウントの削除に失敗しました')
    })
  })

  // ============================================================
  // getFollowing
  // ============================================================

  describe('getFollowing', async () => {
    it('フォロー中一覧を取得できる', async () => {
      const mockFollowing = [
        {
          followerId: mockUser.id,
          followingId: 'following-1',
          following: {
            id: 'following-1',
            nickname: 'フォロー中1',
            avatarUrl: '/avatar1.jpg',
            bio: '自己紹介1',
          },
        },
        {
          followerId: mockUser.id,
          followingId: 'following-2',
          following: {
            id: 'following-2',
            nickname: 'フォロー中2',
            avatarUrl: '/avatar2.jpg',
            bio: '自己紹介2',
          },
        },
      ]
      mockPrisma.follow.findMany.mockResolvedValueOnce(mockFollowing)

      const { getFollowing } = await import('@/lib/actions/user')
      const result = await getFollowing(mockUser.id)

      expect(result.following).toHaveLength(2)
      expect(result.following[0]!.nickname).toBe('フォロー中1')
    })
  })
})
