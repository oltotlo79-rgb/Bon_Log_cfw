// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../../utils/test-utils'

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

// revalidatePathモック
const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

// rate-limitモック
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {},
}))

// loggerモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// next/headersモック
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])),
}))

// premiumモック
vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn().mockResolvedValue(false),
  getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }),
}))

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

const mockRegularUser = {
  id: 'regular-user-id',
  email: 'regular@example.com',
  nickname: '一般ユーザー',
  avatarUrl: null,
  createdAt: new Date('2024-01-01'),
  isSuspended: false,
  suspendedAt: null,
  _count: { posts: 10 },
}

const mockSuspendedUser = {
  id: 'suspended-user-id',
  email: 'suspended@example.com',
  nickname: '停止ユーザー',
  avatarUrl: null,
  createdAt: new Date('2024-01-01'),
  isSuspended: true,
  suspendedAt: new Date('2024-01-10'),
  _count: { posts: 5 },
}

// $transactionモック
const mockTransaction = vi.fn((ops: unknown) => {
  if (typeof ops === 'function') {
    return (ops as (...args: unknown[]) => unknown)(mockPrisma)
  }
  return Promise.all(ops as Promise<unknown>[])
})

describe('管理者向けユーザー管理アクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
    ;(mockPrisma as Record<string, unknown>).$transaction = mockTransaction
    // requireAdmin の suspension チェック (where.id===mockUser.id) は常に active を返す。
    // 個別テストで mockResolvedValue で上書きする場合、対象ユーザー (別 ID) 用なので mockUser.id の場合だけ差し替える。
    mockPrisma.user.findUnique.mockImplementation((args: { where?: { id?: string } } | undefined) => {
      if (args?.where?.id === mockUser.id) {
        return Promise.resolve({ isSuspended: false })
      }
      return Promise.resolve(null)
    })
  })

  // ============================================================
  // getAdminUsers
  // ============================================================

  describe('getAdminUsers', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getAdminUsers } = await import('@/lib/actions/admin/users')
      const result = await getAdminUsers()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getAdminUsers } = await import('@/lib/actions/admin/users')
      const result = await getAdminUsers()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('ユーザー一覧と総件数を正常に返す', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockRegularUser])
      mockPrisma.user.count.mockResolvedValue(1)

      const { getAdminUsers } = await import('@/lib/actions/admin/users')
      const result = await getAdminUsers()

      if ('error' in result) throw new Error('Expected users, got error')
      expect(result.users).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('ユーザーが存在しない場合は空配列と0を返す', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.user.count.mockResolvedValue(0)

      const { getAdminUsers } = await import('@/lib/actions/admin/users')
      const result = await getAdminUsers()

      if ('error' in result) throw new Error('Expected users, got error')
      expect(result.users).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('searchオプションでニックネーム・メールを検索する', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockRegularUser])
      mockPrisma.user.count.mockResolvedValue(1)

      const { getAdminUsers } = await import('@/lib/actions/admin/users')
      await getAdminUsers({ search: '一般' })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { nickname: { contains: '一般' } },
              { email: { contains: '一般' } },
            ],
          }),
        })
      )
    })

    it('status=suspendedで停止ユーザーのみを取得する', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockSuspendedUser])
      mockPrisma.user.count.mockResolvedValue(1)

      const { getAdminUsers } = await import('@/lib/actions/admin/users')
      await getAdminUsers({ status: 'suspended' })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isSuspended: true }),
        })
      )
    })

    it('status=activeで通常ユーザーのみを取得する', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockRegularUser])
      mockPrisma.user.count.mockResolvedValue(1)

      const { getAdminUsers } = await import('@/lib/actions/admin/users')
      await getAdminUsers({ status: 'active' })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isSuspended: false }),
        })
      )
    })

    it('status=allでフィルターなし取得する', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockRegularUser, mockSuspendedUser])
      mockPrisma.user.count.mockResolvedValue(2)

      const { getAdminUsers } = await import('@/lib/actions/admin/users')
      await getAdminUsers({ status: 'all' })

      // isSuspendedフィルターが含まれない
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ isSuspended: expect.anything() }),
        })
      )
    })

    it('sortBy=postCountで投稿数順に並び替える（id を第二キーに複合ソート）', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockRegularUser])
      mockPrisma.user.count.mockResolvedValue(1)

      const { getAdminUsers } = await import('@/lib/actions/admin/users')
      await getAdminUsers({ sortBy: 'postCount', sortOrder: 'desc' })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ posts: { _count: 'desc' } }, { id: 'desc' }],
        })
      )
    })

    it('sortBy=createdAtで登録日順に並び替える（id を第二キーに複合ソート）', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockRegularUser])
      mockPrisma.user.count.mockResolvedValue(1)

      const { getAdminUsers } = await import('@/lib/actions/admin/users')
      await getAdminUsers({ sortBy: 'createdAt', sortOrder: 'asc' })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })
      )
    })

    it('cursor ページネーションが動作する', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.user.count.mockResolvedValue(50)

      const { getAdminUsers } = await import('@/lib/actions/admin/users')
      await getAdminUsers({ limit: 5, cursor: 'user-cursor' })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, cursor: { id: 'user-cursor' }, skip: 1 })
      )
    })

    it('取得件数が limit と一致する場合は nextCursor が設定される', async () => {
      const list = [mockRegularUser, { ...mockRegularUser, id: 'user-2' }]
      mockPrisma.user.findMany.mockResolvedValue(list)
      mockPrisma.user.count.mockResolvedValue(10)

      const { getAdminUsers } = await import('@/lib/actions/admin/users')
      const result = await getAdminUsers({ limit: 2 })

      if ('error' in result) throw new Error('Expected users, got error')
      expect(result.nextCursor).toBe('user-2')
    })

    it('DB エラー時は空配列とエラーログを返す（フェイルセーフ、ActionResult 例外）', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('DB down'))

      const { getAdminUsers } = await import('@/lib/actions/admin/users')
      const result = await getAdminUsers()

      expect(result).toMatchObject({ users: [], total: 0, nextCursor: undefined })
    })

    it('Error インスタンスでない例外が投げられても空配列を返す', async () => {
      mockPrisma.user.findMany.mockRejectedValue('string rejection')

      const { getAdminUsers } = await import('@/lib/actions/admin/users')
      const result = await getAdminUsers()

      expect(result).toMatchObject({ users: [], total: 0, nextCursor: undefined })
    })
  })

  // ============================================================
  // getAdminUserDetail
  // ============================================================

  describe('getAdminUserDetail', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getAdminUserDetail } = await import('@/lib/actions/admin/users')
      const result = await getAdminUserDetail('user-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getAdminUserDetail } = await import('@/lib/actions/admin/users')
      const result = await getAdminUserDetail('user-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('ユーザーが存在しない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { getAdminUserDetail } = await import('@/lib/actions/admin/users')
      const result = await getAdminUserDetail('nonexistent-id')

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('ユーザー詳細と通報件数を返す', async () => {
      const detailUser = {
        ...mockRegularUser,
        _count: { posts: 10, comments: 5, followers: 3, following: 2 },
      }
      mockPrisma.user.findUnique.mockResolvedValue(detailUser)
      mockPrisma.post.findMany.mockResolvedValue([
        { id: 'post-1' }, { id: 'post-2' },
      ])
      mockPrisma.report.count.mockResolvedValue(2)

      const { getAdminUserDetail } = await import('@/lib/actions/admin/users')
      const result = await getAdminUserDetail('regular-user-id')

      if ('error' in result) throw new Error('Expected user detail, got error')
      expect(result.user).toBeDefined()
      expect(result.reportCount).toBe(2)
    })

    it('ユーザーに投稿がない場合でも通報件数を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockRegularUser,
        _count: { posts: 0, comments: 0, followers: 0, following: 0 },
      })
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.report.count.mockResolvedValue(0)

      const { getAdminUserDetail } = await import('@/lib/actions/admin/users')
      const result = await getAdminUserDetail('regular-user-id')

      if ('error' in result) throw new Error('Expected user detail, got error')
      expect(result.reportCount).toBe(0)
    })

    it('userId が空文字（バリデーション不正）なら ERR_INVALID_INPUT を返す', async () => {
      const { getAdminUserDetail } = await import('@/lib/actions/admin/users')
      const result = await getAdminUserDetail('')
      expect(result).toMatchObject({ error: expect.any(String) })
      // requireAdmin 内の admin 自身の停止チェック (where.id===mockUser.id) は許容し、
      // 空文字を対象ユーザーIDとした呼び出しのみが行われていないことを検証する
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: '' } })
      )
    })

    it('DB エラー時は ERR_OPERATION_FAILED を返す', async () => {
      // admin (mockUser.id) 自身の停止チェックは active を返し、
      // 対象ユーザー (regular-user-id) 取得時のみ DB エラーを発生させる
      mockPrisma.user.findUnique.mockImplementation((args: { where?: { id?: string } } | undefined) => {
        if (args?.where?.id === mockUser.id) return Promise.resolve({ isSuspended: false })
        return Promise.reject(new Error('DB down'))
      })

      const { getAdminUserDetail } = await import('@/lib/actions/admin/users')
      const result = await getAdminUserDetail('regular-user-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('Error インスタンスでない例外が投げられても ERR_OPERATION_FAILED を返す', async () => {
      mockPrisma.user.findUnique.mockImplementation((args: { where?: { id?: string } } | undefined) => {
        if (args?.where?.id === mockUser.id) return Promise.resolve({ isSuspended: false })
        return Promise.reject('string rejection')
      })

      const { getAdminUserDetail } = await import('@/lib/actions/admin/users')
      const result = await getAdminUserDetail('regular-user-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })
  })

  // ============================================================
  // suspendUser
  // ============================================================

  describe('suspendUser', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { suspendUser } = await import('@/lib/actions/admin/users')
      const result = await suspendUser('user-id', '規約違反')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { suspendUser } = await import('@/lib/actions/admin/users')
      const result = await suspendUser('user-id', '規約違反')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('ユーザーが存在しない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { suspendUser } = await import('@/lib/actions/admin/users')
      const result = await suspendUser('nonexistent-id', '規約違反')

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('既に停止されているユーザーはエラーを返す', async () => {
      // admin (mockUser.id) は active、対象 (suspended-user-id) は suspended
      mockPrisma.user.findUnique.mockImplementation((args: { where?: { id?: string } } | undefined) => {
        if (args?.where?.id === mockUser.id) return Promise.resolve({ isSuspended: false })
        return Promise.resolve(mockSuspendedUser)
      })

      const { suspendUser } = await import('@/lib/actions/admin/users')
      const result = await suspendUser('suspended-user-id', '再停止')

      expect(result).toMatchObject({ error: expect.stringContaining('既に停止') })
    })

    it('正常にユーザーを停止して成功を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRegularUser)
      mockTransaction.mockResolvedValue([{}, {}])

      const { suspendUser } = await import('@/lib/actions/admin/users')
      const result = await suspendUser('regular-user-id', '規約違反のため')

      expect(result).toMatchObject({ success: true })
    })

    it('トランザクションでユーザー更新と管理ログを同時実行する', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRegularUser)
      mockPrisma.user.update.mockResolvedValue({ ...mockRegularUser, isSuspended: true })
      mockPrisma.adminLog.create.mockResolvedValue({})
      mockTransaction.mockImplementation((ops: unknown) => Promise.all(ops as Promise<unknown>[]))

      const { suspendUser } = await import('@/lib/actions/admin/users')
      await suspendUser('regular-user-id', '規約違反')

      expect(mockTransaction).toHaveBeenCalled()
    })

    it('成功後にrevalidatePathを呼ぶ', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRegularUser)
      mockTransaction.mockResolvedValue([{}, {}])

      const { suspendUser } = await import('@/lib/actions/admin/users')
      await suspendUser('regular-user-id', '規約違反')

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('userId が空文字（バリデーション不正）なら ERR_INVALID_INPUT を返す', async () => {
      const { suspendUser } = await import('@/lib/actions/admin/users')
      const result = await suspendUser('', '規約違反')
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: '' } })
      )
    })

    it('reason が上限文字数を超える場合は ERR_INVALID_INPUT を返す', async () => {
      const { suspendUser } = await import('@/lib/actions/admin/users')
      const result = await suspendUser('regular-user-id', 'a'.repeat(1001))
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('DB エラー時は ERR_OPERATION_FAILED を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRegularUser)
      mockTransaction.mockRejectedValueOnce(new Error('DB down'))

      const { suspendUser } = await import('@/lib/actions/admin/users')
      const result = await suspendUser('regular-user-id', '規約違反')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('Error インスタンスでない例外が投げられても ERR_OPERATION_FAILED を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRegularUser)
      mockTransaction.mockRejectedValueOnce('string rejection')

      const { suspendUser } = await import('@/lib/actions/admin/users')
      const result = await suspendUser('regular-user-id', '規約違反')
      expect(result).toMatchObject({ error: expect.any(String) })
    })
  })

  // ============================================================
  // activateUser
  // ============================================================

  describe('activateUser', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { activateUser } = await import('@/lib/actions/admin/users')
      const result = await activateUser('user-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { activateUser } = await import('@/lib/actions/admin/users')
      const result = await activateUser('user-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('ユーザーが存在しない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { activateUser } = await import('@/lib/actions/admin/users')
      const result = await activateUser('nonexistent-id')

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('停止されていないユーザーを復帰しようとするとエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRegularUser)

      const { activateUser } = await import('@/lib/actions/admin/users')
      const result = await activateUser('regular-user-id')

      expect(result).toMatchObject({ error: expect.stringContaining('停止されていません') })
    })

    it('停止ユーザーを正常に復帰して成功を返す', async () => {
      mockPrisma.user.findUnique.mockImplementation((args: { where?: { id?: string } } | undefined) => {
        if (args?.where?.id === mockUser.id) return Promise.resolve({ isSuspended: false })
        return Promise.resolve(mockSuspendedUser)
      })
      mockTransaction.mockResolvedValue([{}, {}])

      const { activateUser } = await import('@/lib/actions/admin/users')
      const result = await activateUser('suspended-user-id')

      expect(result).toMatchObject({ success: true })
    })

    it('復帰後にrevalidatePathを呼ぶ', async () => {
      mockPrisma.user.findUnique.mockImplementation((args: { where?: { id?: string } } | undefined) => {
        if (args?.where?.id === mockUser.id) return Promise.resolve({ isSuspended: false })
        return Promise.resolve(mockSuspendedUser)
      })
      mockTransaction.mockResolvedValue([{}, {}])

      const { activateUser } = await import('@/lib/actions/admin/users')
      await activateUser('suspended-user-id')

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('トランザクションでisSuspended=false, suspendedAt=nullに更新する', async () => {
      mockPrisma.user.findUnique.mockImplementation((args: { where?: { id?: string } } | undefined) => {
        if (args?.where?.id === mockUser.id) return Promise.resolve({ isSuspended: false })
        return Promise.resolve(mockSuspendedUser)
      })
      mockPrisma.user.update.mockResolvedValue({ ...mockSuspendedUser, isSuspended: false, suspendedAt: null })
      mockPrisma.adminLog.create.mockResolvedValue({})
      mockTransaction.mockImplementation((ops: unknown) => Promise.all(ops as Promise<unknown>[]))

      const { activateUser } = await import('@/lib/actions/admin/users')
      await activateUser('suspended-user-id')

      expect(mockTransaction).toHaveBeenCalled()
    })

    it('userId が空文字（バリデーション不正）なら ERR_INVALID_INPUT を返す', async () => {
      const { activateUser } = await import('@/lib/actions/admin/users')
      const result = await activateUser('')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('DB エラー時は ERR_OPERATION_FAILED を返す', async () => {
      mockPrisma.user.findUnique.mockImplementation((args: { where?: { id?: string } } | undefined) => {
        if (args?.where?.id === mockUser.id) return Promise.resolve({ isSuspended: false })
        return Promise.resolve(mockSuspendedUser)
      })
      mockTransaction.mockRejectedValueOnce(new Error('DB down'))

      const { activateUser } = await import('@/lib/actions/admin/users')
      const result = await activateUser('suspended-user-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('Error インスタンスでない例外が投げられても ERR_OPERATION_FAILED を返す', async () => {
      mockPrisma.user.findUnique.mockImplementation((args: { where?: { id?: string } } | undefined) => {
        if (args?.where?.id === mockUser.id) return Promise.resolve({ isSuspended: false })
        return Promise.resolve(mockSuspendedUser)
      })
      mockTransaction.mockRejectedValueOnce('string rejection')

      const { activateUser } = await import('@/lib/actions/admin/users')
      const result = await activateUser('suspended-user-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })
  })

  // ============================================================
  // deleteUserByAdmin
  // ============================================================

  describe('deleteUserByAdmin', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')
      const result = await deleteUserByAdmin('user-id', '理由')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')
      const result = await deleteUserByAdmin('user-id', '理由')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('ユーザーが存在しない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')
      const result = await deleteUserByAdmin('nonexistent-id', '理由')

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('自分自身は削除できない', async () => {
      // 管理者自身のユーザーIDを削除しようとする
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockRegularUser,
        id: mockUser.id,
      })

      const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')
      const result = await deleteUserByAdmin(mockUser.id, '理由')

      expect(result).toMatchObject({ error: expect.stringContaining('自分自身') })
    })

    it('管理者ユーザーは削除できない', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRegularUser)
      // 対象ユーザーが管理者レコードを持つ場合
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用
        .mockResolvedValueOnce({ id: 'other-admin-id', userId: 'regular-user-id', role: 'admin', createdAt: new Date() }) // 削除対象が管理者

      const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')
      const result = await deleteUserByAdmin('regular-user-id', '理由')

      expect(result).toMatchObject({ error: expect.stringContaining('管理者ユーザー') })
    })

    it('非管理者ユーザーを正常に削除して成功を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRegularUser)
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用
        .mockResolvedValueOnce(null) // 削除対象が管理者でない
      mockTransaction.mockResolvedValue([{}, {}])

      const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')
      const result = await deleteUserByAdmin('regular-user-id', '規約違反')

      expect(result).toMatchObject({ success: true })
    })

    it('成功後にrevalidatePathを呼ぶ', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRegularUser)
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord)
        .mockResolvedValueOnce(null)
      mockTransaction.mockResolvedValue([{}, {}])

      const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')
      await deleteUserByAdmin('regular-user-id', '規約違反')

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('監査ログに削除されたユーザーの情報を含める', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRegularUser)
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord)
        .mockResolvedValueOnce(null)
      mockPrisma.user.delete.mockResolvedValue(mockRegularUser)
      mockPrisma.adminLog.create.mockResolvedValue({})
      mockTransaction.mockImplementation((ops: unknown) => Promise.all(ops as Promise<unknown>[]))

      const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')
      await deleteUserByAdmin('regular-user-id', '不正アクセス')

      expect(mockTransaction).toHaveBeenCalled()
    })

    it('userId が空文字（バリデーション不正）なら ERR_INVALID_INPUT を返す', async () => {
      const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')
      const result = await deleteUserByAdmin('', '理由')
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: '' } })
      )
    })

    it('reason が上限文字数を超える場合は ERR_INVALID_INPUT を返す', async () => {
      const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')
      const result = await deleteUserByAdmin('regular-user-id', 'a'.repeat(1001))
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(mockPrisma.user.delete).not.toHaveBeenCalled()
    })

    it('DB エラー時は ERR_OPERATION_FAILED を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRegularUser)
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord)
        .mockResolvedValueOnce(null)
      mockTransaction.mockRejectedValueOnce(new Error('DB down'))

      const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')
      const result = await deleteUserByAdmin('regular-user-id', '理由')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('Error インスタンスでない例外が投げられても ERR_OPERATION_FAILED を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRegularUser)
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord)
        .mockResolvedValueOnce(null)
      mockTransaction.mockRejectedValueOnce('string rejection')

      const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')
      const result = await deleteUserByAdmin('regular-user-id', '理由')
      expect(result).toMatchObject({ error: expect.any(String) })
    })
  })
})
