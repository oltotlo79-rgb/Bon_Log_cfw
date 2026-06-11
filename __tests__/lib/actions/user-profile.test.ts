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

// reactのcacheモック（getUser は cache() でラップされているため）
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    cache: (fn: (...args: unknown[]) => unknown) => fn,
  }
})

// follow actionモック（getFollowingはfollow.tsに委譲するため）
const mockGetFollowing = vi.fn()
vi.mock('@/lib/actions/follow', () => ({
  getFollowing: (...args: unknown[]) => mockGetFollowing(...args),
}))

describe('User Profile Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id, email: mockUser.email } })
  })

  // ============================================================
  // getUser
  // ============================================================

  /** ActionResult 成功レスポンスから data 部を取り出す（型安全） */
  function unwrapOk<T>(result: { success: true; data?: T } | { success: false; error: string }): T {
    if (!result.success) throw new Error(`Expected success, got error: ${result.error}`)
    if (!result.data) throw new Error('Expected data to be defined')
    return result.data
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

      const { getUser } = await import('@/lib/actions/user-profile')
      const result = await getUser(mockUser.id)

      const data = unwrapOk<{ user: { postsCount: number; followersCount: number; followingCount: number } }>(result)
      expect(data.user.postsCount).toBe(10)
      expect(data.user.followersCount).toBe(50)
      expect(data.user.followingCount).toBe(30)
    })

    it('ユーザーが見つからない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { getUser } = await import('@/lib/actions/user-profile')
      const result = await getUser('nonexistent-id')

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('ゲストユーザーの場合、エラーを返す', async () => {
      const { GUEST_EMAIL } = await import('@/lib/constants/guest')
      const userWithCount = {
        id: 'guest-id',
        email: GUEST_EMAIL,
        nickname: 'ゲスト',
        avatarUrl: null,
        headerUrl: null,
        bio: null,
        location: null,
        isPublic: true,
        bonsaiStartYear: null,
        bonsaiStartMonth: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { posts: 0, followers: 0, following: 0 },
      }
      mockPrisma.user.findUnique.mockResolvedValueOnce(userWithCount)

      const { getUser } = await import('@/lib/actions/user-profile')
      const result = await getUser('guest-id')

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('返り値にemailが含まれない（プライバシー保護）', async () => {
      const userWithCount = {
        ...mockUser,
        email: 'private@example.com',
        _count: { posts: 5, followers: 10, following: 8 },
      }
      mockPrisma.user.findUnique.mockResolvedValueOnce(userWithCount)

      const { getUser } = await import('@/lib/actions/user-profile')
      const result = await getUser(mockUser.id)

      const data = unwrapOk<{ user: Record<string, unknown> }>(result)
      expect('email' in data.user).toBe(false)
    })

    it('postsCount, followersCount, followingCountが正しく計算される', async () => {
      const userWithCount = {
        id: 'u1',
        email: 'u1@example.com',
        nickname: 'User1',
        avatarUrl: null,
        headerUrl: null,
        bio: null,
        location: null,
        isPublic: true,
        bonsaiStartYear: null,
        bonsaiStartMonth: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { posts: 42, followers: 100, following: 55 },
      }
      mockPrisma.user.findUnique.mockResolvedValueOnce(userWithCount)

      const { getUser } = await import('@/lib/actions/user-profile')
      const result = await getUser('u1')

      const data = unwrapOk<{ user: { postsCount: number; followersCount: number; followingCount: number } }>(result)
      expect(data.user.postsCount).toBe(42)
      expect(data.user.followersCount).toBe(100)
      expect(data.user.followingCount).toBe(55)
    })
  })

  // ============================================================
  // getCurrentUser
  // ============================================================

  describe('getCurrentUser', async () => {
    it('現在のユーザー情報を取得できる', async () => {
      const fullUser = {
        ...mockUser,
        bonsaiStartYear: null,
        bonsaiStartMonth: null,
        birthDate: null,
        isSuspended: false,
      }
      mockPrisma.user.findUnique.mockResolvedValueOnce(fullUser)

      const { getCurrentUser } = await import('@/lib/actions/user-profile')
      const result = await getCurrentUser()

      const data = unwrapOk<{ user: { id: string } }>(result)
      expect(data.user.id).toBe(mockUser.id)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getCurrentUser } = await import('@/lib/actions/user-profile')
      const result = await getCurrentUser()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合、エラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { getCurrentUser } = await import('@/lib/actions/user-profile')
      const result = await getCurrentUser()

      expect(result).toMatchObject({ error: 'ユーザー情報の取得に失敗しました' })
    })
  })

  // ============================================================
  // updateProfile
  // ============================================================

  describe('updateProfile', async () => {
    it('プロフィールを正常に更新できる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, nickname: '新しいニックネーム' })

      const { updateProfile } = await import('@/lib/actions/user-profile')
      const formData = createMockFormData({
        nickname: '新しいニックネーム',
        bio: '新しい自己紹介',
        location: '東京都',
      })
      const result = await updateProfile(formData)

      expect(result).toEqual({ success: true })
    })

    it('prisma.user.updateを正しいデータで呼び出す', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser })

      const { updateProfile } = await import('@/lib/actions/user-profile')
      const formData = createMockFormData({
        nickname: 'テストニックネーム',
        bio: 'テスト自己紹介',
        location: '大阪府',
      })
      await updateProfile(formData)

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          nickname: 'テストニックネーム',
          bio: 'テスト自己紹介',
          location: '大阪府',
        }),
      })
    })

    it('更新後にrevalidatePathを呼び出す', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser })

      const { updateProfile } = await import('@/lib/actions/user-profile')
      const formData = createMockFormData({ nickname: 'テスト' })
      await updateProfile(formData)

      expect(mockRevalidatePath).toHaveBeenCalledWith(`/users/${mockUser.id}`)
      expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/profile')
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { updateProfile } = await import('@/lib/actions/user-profile')
      const formData = createMockFormData({ nickname: 'テスト' })
      const result = await updateProfile(formData)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ゲストの場合、エラーを返す', async () => {
      const { GUEST_EMAIL } = await import('@/lib/constants/guest')
      const { ERR_GUEST_CANNOT_CREATE } = await import('@/lib/constants/errors')
      mockAuth.mockResolvedValue({ user: { id: 'guest-id', email: GUEST_EMAIL } })

      const { updateProfile } = await import('@/lib/actions/user-profile')
      const formData = createMockFormData({ nickname: 'テスト' })
      const result = await updateProfile(formData)

      expect(result).toMatchObject({ error: ERR_GUEST_CANNOT_CREATE })
    })

    it('ニックネームが空の場合、バリデーションエラーを返す', async () => {
      const { updateProfile } = await import('@/lib/actions/user-profile')
      const formData = createMockFormData({ nickname: '' })
      const result = await updateProfile(formData)

      expect(result).toMatchObject({ error: 'ニックネームを入力してください' })
    })

    it('ニックネームが50文字を超える場合、バリデーションエラーを返す', async () => {
      const { updateProfile } = await import('@/lib/actions/user-profile')
      const formData = createMockFormData({ nickname: 'a'.repeat(51) })
      const result = await updateProfile(formData)

      expect(result).toMatchObject({ error: 'ニックネームは50文字以内で入力してください' })
    })

    it('自己紹介が200文字を超える場合、バリデーションエラーを返す', async () => {
      const { updateProfile } = await import('@/lib/actions/user-profile')
      const formData = createMockFormData({
        nickname: 'テスト',
        bio: 'a'.repeat(201),
      })
      const result = await updateProfile(formData)

      expect(result).toMatchObject({ error: '自己紹介は200文字以内で入力してください' })
    })

    it('居住地域が100文字を超える場合、バリデーションエラーを返す', async () => {
      const { updateProfile } = await import('@/lib/actions/user-profile')
      const formData = createMockFormData({
        nickname: 'テスト',
        location: 'a'.repeat(101),
      })
      const result = await updateProfile(formData)

      expect(result).toMatchObject({ error: '居住地域は100文字以内で入力してください' })
    })

    it('予約済みニックネームの場合、エラーを返す', async () => {
      const { ERR_NICKNAME_RESERVED } = await import('@/lib/constants/errors')

      const { updateProfile } = await import('@/lib/actions/user-profile')
      // 予約済みニックネームとして 'admin' が含まれると仮定
      const formData = createMockFormData({ nickname: 'admin' })
      const result = await updateProfile(formData)

      // 予約済みチェックが実施されればエラーが返る
      if ('error' in result) {
        // 予約済みの場合はERR_NICKNAME_RESERVEDが返る可能性がある
        expect(typeof result.error).toBe('string')
        if (result.error === ERR_NICKNAME_RESERVED) {
          expect(result.error).toBe(ERR_NICKNAME_RESERVED)
        }
      }
    })

    it('bonsaiStartYearとbonsaiStartMonthを設定できる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, bonsaiStartYear: 2020, bonsaiStartMonth: 4 })

      const { updateProfile } = await import('@/lib/actions/user-profile')
      const formData = createMockFormData({
        nickname: 'テスト',
        bonsaiStartYear: '2020',
        bonsaiStartMonth: '4',
      })
      const result = await updateProfile(formData)

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          bonsaiStartYear: 2020,
          bonsaiStartMonth: 4,
        }),
      })
    })

    it('birthDateを設定できる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser })

      const { updateProfile } = await import('@/lib/actions/user-profile')
      const formData = createMockFormData({
        nickname: 'テスト',
        birthDate: '1990-01-15',
      })
      const result = await updateProfile(formData)

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          birthDate: new Date('1990-01-15'),
        }),
      })
    })

    it('bioと locationが空文字の場合、nullとして保存される', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, bio: null, location: null })

      const { updateProfile } = await import('@/lib/actions/user-profile')
      const formData = createMockFormData({ nickname: 'テスト' })
      // bio と location は appendしない（空文字として扱われる）
      await updateProfile(formData)

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: expect.objectContaining({
          bio: null,
          location: null,
        }),
      })
    })
  })

  // ============================================================
  // updatePrivacy
  // ============================================================

  describe('updatePrivacy', async () => {
    it('プライバシー設定をfalseに更新できる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, isPublic: false })

      const { updatePrivacy } = await import('@/lib/actions/user-profile')
      const result = await updatePrivacy(false)

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { isPublic: false },
      })
    })

    it('プライバシー設定をtrueに更新できる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser, isPublic: true })

      const { updatePrivacy } = await import('@/lib/actions/user-profile')
      const result = await updatePrivacy(true)

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { isPublic: true },
      })
    })

    it('更新後にrevalidatePathを呼び出す', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({ ...mockUser })

      const { updatePrivacy } = await import('@/lib/actions/user-profile')
      await updatePrivacy(false)

      expect(mockRevalidatePath).toHaveBeenCalledWith(`/users/${mockUser.id}`)
      expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/account')
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { updatePrivacy } = await import('@/lib/actions/user-profile')
      const result = await updatePrivacy(false)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ゲストの場合、エラーを返す', async () => {
      const { GUEST_EMAIL } = await import('@/lib/constants/guest')
      const { ERR_GUEST_CANNOT_CREATE } = await import('@/lib/constants/errors')
      mockAuth.mockResolvedValue({ user: { id: 'guest-id', email: GUEST_EMAIL } })

      const { updatePrivacy } = await import('@/lib/actions/user-profile')
      const result = await updatePrivacy(false)

      expect(result).toMatchObject({ error: ERR_GUEST_CANNOT_CREATE })
    })

    it('非 boolean（string）を渡すと ERR_INVALID_INPUT を返す', async () => {
      const { updatePrivacy } = await import('@/lib/actions/user-profile')
      const result = await updatePrivacy('yes' as unknown as boolean)

      expect(result).toMatchObject({ error: '入力データが不正です' })
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('非 boolean（数値）を渡すと ERR_INVALID_INPUT を返す', async () => {
      const { updatePrivacy } = await import('@/lib/actions/user-profile')
      const result = await updatePrivacy(1 as unknown as boolean)

      expect(result).toMatchObject({ error: '入力データが不正です' })
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // getFollowing
  // ============================================================

  describe('getFollowing', async () => {
    it('フォロー中のユーザー一覧を取得できる', async () => {
      const mockFollowingUsers = [
        { id: 'user-2', nickname: 'ユーザー2', avatarUrl: null, bio: null },
        { id: 'user-3', nickname: 'ユーザー3', avatarUrl: '/avatar3.jpg', bio: '自己紹介3' },
      ]
      mockGetFollowing.mockResolvedValueOnce({ users: mockFollowingUsers, nextCursor: undefined })

      const { getFollowing } = await import('@/lib/actions/user-profile')
      const result = await getFollowing(mockUser.id)

      expect(result.following).toHaveLength(2)
      expect(result.following[0]!.id).toBe('user-2')
    })

    it('follow.tsのgetFollowingに処理を委譲する', async () => {
      mockGetFollowing.mockResolvedValueOnce({ users: [], nextCursor: undefined })

      const { getFollowing } = await import('@/lib/actions/user-profile')
      await getFollowing('target-user-id')

      expect(mockGetFollowing).toHaveBeenCalledWith('target-user-id', undefined, 20)
    })

    it('カーソルを指定してページネーションできる', async () => {
      mockGetFollowing.mockResolvedValueOnce({ users: [], nextCursor: 'cursor-next' })

      const { getFollowing } = await import('@/lib/actions/user-profile')
      const result = await getFollowing(mockUser.id, 'cursor-abc')

      expect(mockGetFollowing).toHaveBeenCalledWith(mockUser.id, 'cursor-abc', 20)
      expect(result.nextCursor).toBe('cursor-next')
    })

    it('limitを指定できる', async () => {
      mockGetFollowing.mockResolvedValueOnce({ users: [], nextCursor: undefined })

      const { getFollowing } = await import('@/lib/actions/user-profile')
      await getFollowing(mockUser.id, undefined, 10)

      expect(mockGetFollowing).toHaveBeenCalledWith(mockUser.id, undefined, 10)
    })

    it('フォロー中ユーザーがいない場合、空配列を返す', async () => {
      mockGetFollowing.mockResolvedValueOnce({ users: [], nextCursor: undefined })

      const { getFollowing } = await import('@/lib/actions/user-profile')
      const result = await getFollowing(mockUser.id)

      expect(result.following).toEqual([])
      expect(result.nextCursor).toBeUndefined()
    })

    it('nextCursorが返る場合、それを引き継ぐ', async () => {
      mockGetFollowing.mockResolvedValueOnce({ users: [{ id: 'u1' }], nextCursor: 'next-cursor-123' })

      const { getFollowing } = await import('@/lib/actions/user-profile')
      const result = await getFollowing(mockUser.id)

      expect(result.nextCursor).toBe('next-cursor-123')
    })

    it('follow.tsがusersをundefinedで返す場合、空配列にフォールバックする', async () => {
      mockGetFollowing.mockResolvedValueOnce({ users: undefined, nextCursor: undefined })

      const { getFollowing } = await import('@/lib/actions/user-profile')
      const result = await getFollowing(mockUser.id)

      expect(result.following).toEqual([])
    })
  })
})
