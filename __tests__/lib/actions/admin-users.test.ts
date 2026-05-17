import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath, revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

const mockPrisma: Record<string, any> = {
  adminUser: { findUnique: vi.fn() },
  user: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  post: { findMany: vi.fn() },
  report: { count: vi.fn() },
  adminLog: { create: vi.fn() },
  $transaction: vi.fn((ops: unknown) =>
    typeof ops === 'function'
      ? (ops as (...args: unknown[]) => unknown)(mockPrisma)
      : Promise.all(ops as Promise<unknown>[])
  ),
  $executeRaw: vi.fn().mockResolvedValue(undefined),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {},
}))
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])),
}))
vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn().mockResolvedValue(false),
  getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4 }),
}))

// ---------------------------------------------------------------------------
// getAdminUsers
// ---------------------------------------------------------------------------
describe('getAdminUsers', async () => {
  const { getAdminUsers } = await import('@/lib/actions/admin/users')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
    mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.user.count.mockResolvedValue(0)
  })

  describe('authentication and authorization', () => {
    it('returns error when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const result = await getAdminUsers()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('returns error when user is not admin', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const result = await getAdminUsers()
      expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
    })
  })

  describe('happy path', () => {
    it('returns users and total with no options', async () => {
      const mockUsers = [
        { id: 'u1', email: 'a@a.com', nickname: 'Alice', avatarUrl: null,
          createdAt: new Date(), isSuspended: false, suspendedAt: null,
          _count: { posts: 3 } },
      ]
      mockPrisma.user.findMany.mockResolvedValue(mockUsers)
      mockPrisma.user.count.mockResolvedValue(1)

      const result = await getAdminUsers()
      expect(result).toHaveProperty('users')
      expect(result).toHaveProperty('total')
      if ('users' in result) {
        expect(result.total).toBe(1)
        expect(result.users).toEqual(mockUsers)
      }
    })

    it('returns empty users when no records exist', async () => {
      const result = await getAdminUsers()
      if ('users' in result) {
        expect(result.users).toEqual([])
        expect(result.total).toBe(0)
      }
    })
  })

  describe('search filter', () => {
    it('passes OR search filter for nickname and email', async () => {
      await getAdminUsers({ search: 'alice' })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { nickname: { contains: 'alice' } },
              { email: { contains: 'alice' } },
            ],
          }),
        })
      )
    })

    it('does not add OR filter when search is not provided', async () => {
      await getAdminUsers()

      const call = mockPrisma.user.findMany.mock.calls[0][0]
      expect(call.where).not.toHaveProperty('OR')
    })
  })

  describe('status filter', () => {
    it('filters for suspended users when status=suspended', async () => {
      await getAdminUsers({ status: 'suspended' })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isSuspended: true }),
        })
      )
    })

    it('filters for active users when status=active', async () => {
      await getAdminUsers({ status: 'active' })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isSuspended: false }),
        })
      )
    })

    it('does not add isSuspended filter when status=all (default)', async () => {
      await getAdminUsers({ status: 'all' })

      const call = mockPrisma.user.findMany.mock.calls[0][0]
      expect(call.where).not.toHaveProperty('isSuspended')
    })
  })

  describe('sorting', () => {
    it('sorts by createdAt desc by default (id as secondary tiebreaker)', async () => {
      await getAdminUsers()

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      )
    })

    it('sorts by postCount using relation count (id as secondary tiebreaker)', async () => {
      await getAdminUsers({ sortBy: 'postCount', sortOrder: 'asc' })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ posts: { _count: 'asc' } }, { id: 'asc' }],
        })
      )
    })

    it('sorts by nickname when specified (id as secondary tiebreaker)', async () => {
      await getAdminUsers({ sortBy: 'nickname', sortOrder: 'asc' })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ nickname: 'asc' }, { id: 'asc' }],
        })
      )
    })
  })

  describe('pagination', () => {
    it('uses DEFAULT_PAGE_LIMIT (20) and no cursor when not specified', async () => {
      await getAdminUsers()

      const call = mockPrisma.user.findMany.mock.calls[0][0]
      expect(call.take).toBe(20)
      expect(call.cursor).toBeUndefined()
      expect(call.skip).toBeUndefined()
    })

    it('respects custom limit and cursor', async () => {
      await getAdminUsers({ limit: 5, cursor: 'user-cursor' })

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, cursor: { id: 'user-cursor' }, skip: 1 })
      )
    })
  })
})

// ---------------------------------------------------------------------------
// getAdminUserDetail
// ---------------------------------------------------------------------------
describe('getAdminUserDetail', async () => {
  const { getAdminUserDetail } = await import('@/lib/actions/admin/users')

  const mockUser = {
    id: 'target-user',
    email: 'target@example.com',
    nickname: 'Target',
    avatarUrl: null,
    isSuspended: false,
    suspendedAt: null,
    createdAt: new Date(),
    _count: { posts: 5, comments: 10, followers: 3, following: 2 },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
    mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue(mockUser)
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.report.count.mockResolvedValue(0)
  })

  describe('authentication and authorization', () => {
    it('returns error when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const result = await getAdminUserDetail('target-user')
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('returns error when user is not admin', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const result = await getAdminUserDetail('target-user')
      expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
    })
  })

  describe('happy path', () => {
    it('returns user and reportCount', async () => {
      mockPrisma.report.count.mockResolvedValue(7)

      const result = await getAdminUserDetail('target-user')
      expect(result).toHaveProperty('user')
      expect(result).toHaveProperty('reportCount')
      if ('user' in result) {
        expect(result.user).toEqual(mockUser)
        expect(result.reportCount).toBe(7)
      }
    })

    it('returns reportCount=0 when no reports', async () => {
      mockPrisma.report.count.mockResolvedValue(0)

      const result = await getAdminUserDetail('target-user')
      if ('reportCount' in result) {
        expect(result.reportCount).toBe(0)
      }
    })

    it('includes post IDs in report count query', async () => {
      mockPrisma.post.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])

      await getAdminUserDetail('target-user')

      expect(mockPrisma.report.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ targetId: 'target-user' }),
            ]),
          }),
        })
      )
    })

    it('handles user with no posts correctly', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])

      const result = await getAdminUserDetail('target-user')
      expect(result).toHaveProperty('reportCount')
    })
  })

  describe('user not found', () => {
    it('returns error when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const result = await getAdminUserDetail('nonexistent')
      expect(result).toMatchObject({ success: false, error: 'ユーザーが見つかりません' })
    })
  })
})

// ---------------------------------------------------------------------------
// suspendUser
// ---------------------------------------------------------------------------
describe('suspendUser', async () => {
  const { suspendUser } = await import('@/lib/actions/admin/users')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
    mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'target-user', isSuspended: false, nickname: 'Target',
    })
    mockPrisma.user.update.mockResolvedValue({ id: 'target-user', isSuspended: true })
    mockPrisma.adminLog.create.mockResolvedValue({})
    // Ensure $transaction is in working state each test
    mockPrisma.$transaction.mockImplementation((ops: unknown) =>
      typeof ops === 'function'
        ? (ops as (...args: unknown[]) => unknown)(mockPrisma)
        : Promise.all(ops as Promise<unknown>[])
    )
  })

  describe('authentication and authorization', () => {
    it('returns error when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const result = await suspendUser('target-user', 'spam')
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('returns error when user is not admin', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const result = await suspendUser('target-user', 'spam')
      expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
    })
  })

  describe('happy path', () => {
    it('successfully suspends user and returns success', async () => {
      const result = await suspendUser('target-user', 'Spam behavior')
      expect(result).toMatchObject({ success: true })
    })

    it('calls revalidatePath after suspension', async () => {
      await suspendUser('target-user', 'Spam behavior')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('uses transaction to update user and create log', async () => {
      await suspendUser('target-user', 'reason')
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('returns error when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const result = await suspendUser('nonexistent', 'reason')
      expect(result).toMatchObject({ success: false, error: 'ユーザーが見つかりません' })
    })

    it('returns error when user is already suspended', async () => {
      // admin 自身 (admin-user-id) は active、対象ユーザー (target-user) は suspended
      mockPrisma.user.findUnique.mockImplementation((args: { where?: { id?: string } } | undefined) => {
        if (args?.where?.id === 'admin-user-id') {
          return Promise.resolve({ isSuspended: false })
        }
        return Promise.resolve({ id: 'target-user', isSuspended: true })
      })
      const result = await suspendUser('target-user', 'reason')
      expect(result).toMatchObject({ success: false, error: 'このユーザーは既に停止されています' })
    })
  })

  describe('database errors', () => {
    it('returns error on transaction failure', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', isSuspended: false })
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'))
      const result = await suspendUser('target-user', 'reason')
      expect(result).toMatchObject({ success: false })
    })
  })
})

// ---------------------------------------------------------------------------
// activateUser
// ---------------------------------------------------------------------------
describe('activateUser', async () => {
  const { activateUser } = await import('@/lib/actions/admin/users')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
    mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'admin-user-id', role: 'admin' })
    // requireAdmin の suspension チェック (where.id===admin-user-id) と対象ユーザー取得 (where.id===target-user) を where.id で分岐
    mockPrisma.user.findUnique.mockImplementation((args: { where?: { id?: string } } | undefined) => {
      if (args?.where?.id === 'admin-user-id') {
        return Promise.resolve({ isSuspended: false })
      }
      return Promise.resolve({ id: 'target-user', isSuspended: true, nickname: 'Target' })
    })
    mockPrisma.user.update.mockResolvedValue({ id: 'target-user', isSuspended: false })
    mockPrisma.adminLog.create.mockResolvedValue({})
    // Reset $transaction to default working state (may have been set to reject in prior test)
    mockPrisma.$transaction.mockImplementation((ops: unknown) =>
      typeof ops === 'function'
        ? (ops as (...args: unknown[]) => unknown)(mockPrisma)
        : Promise.all(ops as Promise<unknown>[])
    )
  })

  describe('authentication and authorization', () => {
    it('returns error when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const result = await activateUser('target-user')
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('returns error when user is not admin', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const result = await activateUser('target-user')
      expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
    })
  })

  describe('happy path', () => {
    it('successfully activates user and returns success', async () => {
      const result = await activateUser('target-user')
      expect(result).toMatchObject({ success: true })
    })

    it('calls revalidatePath after activation', async () => {
      await activateUser('target-user')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('uses transaction to update user and create log', async () => {
      await activateUser('target-user')
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('returns error when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const result = await activateUser('nonexistent')
      expect(result).toMatchObject({ success: false, error: 'ユーザーが見つかりません' })
    })

    it('returns error when user is not suspended', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'target-user', isSuspended: false,
      })
      const result = await activateUser('target-user')
      expect(result).toMatchObject({ success: false, error: 'このユーザーは停止されていません' })
    })
  })
})

// ---------------------------------------------------------------------------
// deleteUserByAdmin
// ---------------------------------------------------------------------------
describe('deleteUserByAdmin', async () => {
  const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')

  // Helper: set up adminUser.findUnique to return admin for requireAdmin check,
  // then null for the targetAdminUser check (default happy path).
  function setupAdminUserMock(targetIsAdmin = false) {
    let callCount = 0
    mockPrisma.adminUser.findUnique.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({ userId: 'admin-user-id', role: 'admin' })
      }
      return Promise.resolve(
        targetIsAdmin ? { userId: 'target-user', role: 'admin' } : null
      )
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
    setupAdminUserMock()
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'target-user', email: 'target@example.com', nickname: 'Target',
    })
    mockPrisma.user.delete.mockResolvedValue({ id: 'target-user' })
    mockPrisma.adminLog.create.mockResolvedValue({})
    // Reset $transaction to working state
    mockPrisma.$transaction.mockImplementation((ops: unknown) =>
      typeof ops === 'function'
        ? (ops as (...args: unknown[]) => unknown)(mockPrisma)
        : Promise.all(ops as Promise<unknown>[])
    )
  })

  describe('authentication and authorization', () => {
    it('returns error when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const result = await deleteUserByAdmin('target-user', 'violation')
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('returns error when user is not admin', async () => {
      // Override: both calls return null (requireAdmin fails)
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const result = await deleteUserByAdmin('target-user', 'violation')
      expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
    })
  })

  describe('happy path', () => {
    it('successfully deletes user and returns success', async () => {
      const result = await deleteUserByAdmin('target-user', 'Rule violation')
      expect(result).toMatchObject({ success: true })
    })

    it('calls revalidatePath after deletion', async () => {
      await deleteUserByAdmin('target-user', 'Rule violation')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('uses transaction to delete user and create log', async () => {
      await deleteUserByAdmin('target-user', 'reason')
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('edge cases and safety checks', () => {
    it('returns error when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const result = await deleteUserByAdmin('nonexistent', 'reason')
      expect(result).toMatchObject({ success: false, error: 'ユーザーが見つかりません' })
    })

    it('returns error when admin tries to delete themselves', async () => {
      // Target = admin's own userId
      const result = await deleteUserByAdmin('admin-user-id', 'reason')
      expect(result).toMatchObject({ success: false, error: '自分自身を削除することはできません' })
    })

    it('returns error when target user is also an admin', async () => {
      setupAdminUserMock(true)
      const result = await deleteUserByAdmin('target-user', 'reason')
      expect(result).toMatchObject({ success: false, error: '管理者ユーザーは削除できません' })
    })
  })

  describe('database errors', () => {
    it('returns error on transaction failure', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', isAdmin: false })
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'))
      const result = await deleteUserByAdmin('target-user', 'reason')
      expect(result).toMatchObject({ success: false })
    })
  })
})
