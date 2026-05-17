// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

vi.mock('@/lib/rate-limit', () => ({ checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }), RATE_LIMITS: {} }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])) }))
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn().mockResolvedValue(false), getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }) }))

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

const mockTransaction = vi.fn((ops: unknown) => {
  if (typeof ops === 'function') {
    return (ops as (...args: unknown[]) => unknown)(mockPrisma)
  }
  return Promise.all(ops as Promise<unknown>[])
})

describe('管理者ロール管理アクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
    ;(mockPrisma as Record<string, unknown>).$transaction = mockTransaction
    // adminUser に findMany, update, delete, create を追加
    if (!mockPrisma.adminUser.findMany) {
      mockPrisma.adminUser.findMany = vi.fn()
    }
    mockPrisma.adminUser.update = vi.fn().mockResolvedValue({})
    mockPrisma.adminUser.delete = vi.fn().mockResolvedValue({})
    mockPrisma.adminUser.create = vi.fn().mockResolvedValue({})
    mockPrisma.adminLog.create = vi.fn().mockResolvedValue({})
  })

  // ============================================================
  // getAdminRoles
  // ============================================================

  describe('getAdminRoles', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getAdminRoles } = await import('@/lib/actions/admin/roles')
      const result = await getAdminRoles()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getAdminRoles } = await import('@/lib/actions/admin/roles')
      const result = await getAdminRoles()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者一覧をユーザー情報付きで正常に返す', async () => {
      const mockAdmins = [
        {
          id: 'admin-1',
          userId: 'user-1',
          role: 'admin',
          createdAt: new Date(),
          user: { id: 'user-1', nickname: '管理者A', email: 'a@example.com', avatarUrl: null },
        },
        {
          id: 'admin-2',
          userId: 'user-2',
          role: 'moderator',
          createdAt: new Date(),
          user: { id: 'user-2', nickname: 'モデレーターB', email: 'b@example.com', avatarUrl: '/avatar.jpg' },
        },
      ]
      mockPrisma.adminUser.findMany.mockResolvedValue(mockAdmins)

      const { getAdminRoles } = await import('@/lib/actions/admin/roles')
      const result = await getAdminRoles()

      if ('error' in result) throw new Error('Expected admins, got error')
      expect(result.admins).toHaveLength(2)
      expect(result.admins[0].user.nickname).toBe('管理者A')
    })

    it('管理者が0人の場合は空配列を返す', async () => {
      mockPrisma.adminUser.findMany.mockResolvedValue([])

      const { getAdminRoles } = await import('@/lib/actions/admin/roles')
      const result = await getAdminRoles()

      if ('error' in result) throw new Error('Expected admins, got error')
      expect(result.admins).toHaveLength(0)
    })

    it('findManyにincludeとorderByが渡される', async () => {
      mockPrisma.adminUser.findMany.mockResolvedValue([])

      const { getAdminRoles } = await import('@/lib/actions/admin/roles')
      await getAdminRoles()

      expect(mockPrisma.adminUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            user: expect.objectContaining({
              select: expect.objectContaining({ id: true, nickname: true }),
            }),
          }),
          orderBy: { createdAt: 'asc' },
        })
      )
    })
  })

  // ============================================================
  // updateAdminRole
  // ============================================================

  describe('updateAdminRole', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { updateAdminRole } = await import('@/lib/actions/admin/roles')
      const result = await updateAdminRole('target-user-id', 'moderator' as never)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { updateAdminRole } = await import('@/lib/actions/admin/roles')
      const result = await updateAdminRole('target-user-id', 'moderator' as never)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('自分自身のロールは変更できない', async () => {
      const { updateAdminRole } = await import('@/lib/actions/admin/roles')
      const result = await updateAdminRole(mockUser.id, 'moderator' as never)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('対象ユーザーが管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用
        .mockResolvedValueOnce(null) // 対象ユーザー検索用

      const { updateAdminRole } = await import('@/lib/actions/admin/roles')
      const result = await updateAdminRole('nonexistent-user-id', 'moderator' as never)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('自分より高い権限のユーザーのロールは変更できない', async () => {
      const superAdminRecord = { id: 'sa-record', userId: 'super-admin-id', role: 'super_admin', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用（role: 'admin'）
        .mockResolvedValueOnce(superAdminRecord) // 対象（role: 'super_admin'）

      const { updateAdminRole } = await import('@/lib/actions/admin/roles')
      const result = await updateAdminRole('super-admin-id', 'moderator' as never)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('自分と同じ権限のユーザーのロールは変更できない', async () => {
      const sameRoleRecord = { id: 'same-record', userId: 'other-admin-id', role: 'admin', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用（role: 'admin'）
        .mockResolvedValueOnce(sameRoleRecord) // 対象（role: 'admin'）

      const { updateAdminRole } = await import('@/lib/actions/admin/roles')
      const result = await updateAdminRole('other-admin-id', 'moderator' as never)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('付与先ロールが自分と同じ以上の場合はエラーを返す', async () => {
      const moderatorRecord = { id: 'mod-record', userId: 'mod-id', role: 'moderator', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用（role: 'admin'）
        .mockResolvedValueOnce(moderatorRecord) // 対象（role: 'moderator'）

      const { updateAdminRole } = await import('@/lib/actions/admin/roles')
      // admin が moderator を admin に昇格 → canManageRole('admin', 'admin') = false
      const result = await updateAdminRole('mod-id', 'admin' as never)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('正常にロールを変更できる', async () => {
      const moderatorRecord = { id: 'mod-record', userId: 'mod-id', role: 'moderator', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用（role: 'admin'）
        .mockResolvedValueOnce(moderatorRecord) // 対象（role: 'moderator'）

      const { updateAdminRole } = await import('@/lib/actions/admin/roles')
      const result = await updateAdminRole('mod-id', 'support' as never)

      expect(result).toMatchObject({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/roles')
    })

    it('変更時に監査ログが作成される', async () => {
      const moderatorRecord = { id: 'mod-record', userId: 'mod-id', role: 'moderator', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用
        .mockResolvedValueOnce(moderatorRecord) // 対象

      const { updateAdminRole } = await import('@/lib/actions/admin/roles')
      await updateAdminRole('mod-id', 'support' as never)

      // $transaction が配列で呼ばれる（update + adminLog.create）
      expect(mockTransaction).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // addAdmin
  // ============================================================

  describe('addAdmin', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { addAdmin } = await import('@/lib/actions/admin/roles')
      const result = await addAdmin('user-id', 'moderator' as never)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { addAdmin } = await import('@/lib/actions/admin/roles')
      const result = await addAdmin('user-id', 'moderator' as never)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('対象ユーザーが存在しない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { addAdmin } = await import('@/lib/actions/admin/roles')
      const result = await addAdmin('nonexistent-user-id', 'moderator' as never)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('自分より高い権限のロールを付与できない', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'new-admin-id', nickname: 'New Admin' })

      const { addAdmin } = await import('@/lib/actions/admin/roles')
      // admin が super_admin を付与 → canManageRole('admin', 'super_admin') = false
      const result = await addAdmin('new-admin-id', 'super_admin' as never)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('自分と同じ権限のロールを付与できない', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'new-admin-id', nickname: 'New Admin' })

      const { addAdmin } = await import('@/lib/actions/admin/roles')
      // admin が admin を付与 → canManageRole('admin', 'admin') = false
      const result = await addAdmin('new-admin-id', 'admin' as never)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('正常に管理者を追加できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'new-admin-id', nickname: 'New Admin' })

      const { addAdmin } = await import('@/lib/actions/admin/roles')
      const result = await addAdmin('new-admin-id', 'moderator' as never)

      expect(result).toMatchObject({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/roles')
    })

    it('追加時に監査ログが作成される', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'new-admin-id', nickname: 'New Admin' })

      const { addAdmin } = await import('@/lib/actions/admin/roles')
      await addAdmin('new-admin-id', 'support' as never)

      expect(mockTransaction).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // removeAdmin
  // ============================================================

  describe('removeAdmin', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { removeAdmin } = await import('@/lib/actions/admin/roles')
      const result = await removeAdmin('target-user-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { removeAdmin } = await import('@/lib/actions/admin/roles')
      const result = await removeAdmin('target-user-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('自分自身を削除できない', async () => {
      const { removeAdmin } = await import('@/lib/actions/admin/roles')
      const result = await removeAdmin(mockUser.id)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('対象ユーザーが管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用
        .mockResolvedValueOnce(null) // 対象ユーザー検索用

      const { removeAdmin } = await import('@/lib/actions/admin/roles')
      const result = await removeAdmin('nonexistent-user-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('自分より高い権限の管理者は削除できない', async () => {
      const superAdminRecord = { id: 'sa-record', userId: 'super-admin-id', role: 'super_admin', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用（role: 'admin'）
        .mockResolvedValueOnce(superAdminRecord) // 対象（role: 'super_admin'）

      const { removeAdmin } = await import('@/lib/actions/admin/roles')
      const result = await removeAdmin('super-admin-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('自分と同じ権限の管理者は削除できない', async () => {
      const sameRoleRecord = { id: 'same-record', userId: 'other-admin-id', role: 'admin', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用（role: 'admin'）
        .mockResolvedValueOnce(sameRoleRecord) // 対象（role: 'admin'）

      const { removeAdmin } = await import('@/lib/actions/admin/roles')
      const result = await removeAdmin('other-admin-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('正常に管理者を削除できる', async () => {
      const moderatorRecord = { id: 'mod-record', userId: 'mod-id', role: 'moderator', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用
        .mockResolvedValueOnce(moderatorRecord) // 対象

      const { removeAdmin } = await import('@/lib/actions/admin/roles')
      const result = await removeAdmin('mod-id')

      expect(result).toMatchObject({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/roles')
    })

    it('削除時に監査ログが作成される', async () => {
      const supportRecord = { id: 'sup-record', userId: 'sup-id', role: 'support', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用
        .mockResolvedValueOnce(supportRecord) // 対象

      const { removeAdmin } = await import('@/lib/actions/admin/roles')
      await removeAdmin('sup-id')

      expect(mockTransaction).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================
  // Role hierarchy enforcement (追加テスト)
  // ============================================================

  describe('ロール階層の強制', () => {
    it('moderatorがadminのロールを変更しようとしたら拒否される', async () => {
      const moderatorCaller = { id: 'mod-record', userId: mockUser.id, role: 'moderator', createdAt: new Date() }
      const adminTarget = { id: 'admin-target-record', userId: 'admin-target-id', role: 'admin', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(moderatorCaller) // requireAdmin用（moderator）
        .mockResolvedValueOnce(adminTarget) // 対象（admin）

      const { updateAdminRole } = await import('@/lib/actions/admin/roles')
      const result = await updateAdminRole('admin-target-id', 'support' as never)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('adminがsupportをadmin（同等ロール）に昇格させようとしたら拒否される', async () => {
      // admin (80) が support を admin (80) に昇格 → canManageRole('admin','admin') = false
      const supportTarget = { id: 'sup-target-record', userId: 'sup-target-id', role: 'support', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用（admin）
        .mockResolvedValueOnce(supportTarget) // 対象（support）

      const { updateAdminRole } = await import('@/lib/actions/admin/roles')
      const result = await updateAdminRole('sup-target-id', 'admin' as never)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('adminがsuper_adminを削除しようとしたら拒否される', async () => {
      const superAdminRecord = { id: 'sa-record', userId: 'super-admin-id', role: 'super_admin', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用（admin）
        .mockResolvedValueOnce(superAdminRecord) // 対象（super_admin）

      const { removeAdmin } = await import('@/lib/actions/admin/roles')
      const result = await removeAdmin('super-admin-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })
  })

  // ============================================================
  // Audit trail verification (追加テスト)
  // ============================================================

  describe('監査ログの内容検証', () => {
    it('updateAdminRoleでトランザクションが呼ばれる', async () => {
      // モックをリセットして再設定
      mockPrisma.adminUser.findUnique.mockReset()
      const moderatorRecord = { id: 'mod-record', userId: 'mod-id', role: 'moderator', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce({ ...mockAdminUserRecord, role: 'admin' }) // requireAdmin用
        .mockResolvedValueOnce(moderatorRecord) // 対象

      const { updateAdminRole } = await import('@/lib/actions/admin/roles')
      const result = await updateAdminRole('mod-id', 'support' as never)

      expect(result).toHaveProperty('success', true)
      expect(mockTransaction).toHaveBeenCalled()
    })

    it('addAdminのadminLogにroleが記録される', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'new-admin-id', nickname: 'New Admin' })

      const { addAdmin } = await import('@/lib/actions/admin/roles')
      await addAdmin('new-admin-id', 'support' as never)

      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'add_admin',
          targetId: 'new-admin-id',
        }),
      })

      const createCall = mockPrisma.adminLog.create.mock.calls[0][0]
      const details = JSON.parse(createCall.data.details)
      expect(details).toEqual({ role: 'support' })
    })

    it('removeAdminでトランザクションが呼ばれる', async () => {
      // モックをリセットして再設定
      mockPrisma.adminUser.findUnique.mockReset()
      const supportRecord = { id: 'sup-record', userId: 'sup-id', role: 'support', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce({ ...mockAdminUserRecord, role: 'admin' }) // requireAdmin用
        .mockResolvedValueOnce(supportRecord) // 対象

      const { removeAdmin } = await import('@/lib/actions/admin/roles')
      const result = await removeAdmin('sup-id')

      expect(result).toHaveProperty('success', true)
      expect(mockTransaction).toHaveBeenCalled()
    })

    it('updateAdminRoleのadminLogにadminIdとtargetTypeが正しく記録される', async () => {
      const moderatorRecord = { id: 'mod-record', userId: 'mod-id', role: 'moderator', createdAt: new Date() }
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce(mockAdminUserRecord) // requireAdmin用（admin）
        .mockResolvedValueOnce(moderatorRecord) // 対象

      const { updateAdminRole } = await import('@/lib/actions/admin/roles')
      await updateAdminRole('mod-id', 'support' as never)

      const createCall = mockPrisma.adminLog.create.mock.calls[0][0]
      expect(createCall.data.adminId).toBe(mockUser.id)
      expect(createCall.data.targetType).toBe('user')
      expect(createCall.data.targetId).toBe('mod-id')
    })
  })

  // ============================================================
  // Edge cases (追加テスト)
  // ============================================================

  describe('エッジケース', () => {
    it('既にadminのユーザーをaddAdminで再追加するとPrismaエラーになる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-admin-id', nickname: 'Existing Admin' })
      // create時にユニーク制約違反のPrismaエラー
      mockPrisma.adminUser.create.mockRejectedValue(new Error('Unique constraint failed on the fields: (`userId`)'))
      mockTransaction.mockRejectedValueOnce(new Error('Unique constraint failed on the fields: (`userId`)'))

      const { addAdmin } = await import('@/lib/actions/admin/roles')
      await expect(addAdmin('existing-admin-id', 'moderator' as never)).rejects.toThrow()
    })
  })
})
