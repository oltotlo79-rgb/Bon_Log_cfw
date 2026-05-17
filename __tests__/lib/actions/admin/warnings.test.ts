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

// ------------------------------------------------------------
// モックデータ
// ------------------------------------------------------------

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

const mockTargetUser = {
  id: 'target-user-id',
  email: 'target@example.com',
  nickname: 'ターゲットユーザー',
  avatarUrl: null,
  isSuspended: false,
  suspendedAt: null,
}

const mockWarning = {
  id: 'warning-1',
  userId: mockTargetUser.id,
  level: 'notice' as const,
  reason: 'テスト警告理由',
  relatedReportId: null,
  issuedBy: mockUser.id,
  isActive: true,
  expiresAt: null,
  createdAt: new Date('2024-06-01'),
  updatedAt: new Date('2024-06-01'),
  user: {
    id: mockTargetUser.id,
    nickname: mockTargetUser.nickname,
    email: mockTargetUser.email,
    avatarUrl: null,
  },
}

const mockWarning2 = {
  ...mockWarning,
  id: 'warning-2',
  level: 'warning' as const,
  reason: '二度目の警告',
  createdAt: new Date('2024-07-01'),
}

// $transactionモック
const mockTransaction = vi.fn((ops: unknown) => {
  if (typeof ops === 'function') {
    return (ops as (...args: unknown[]) => unknown)(mockPrisma)
  }
  return Promise.all(ops as Promise<unknown>[])
})

// ------------------------------------------------------------
// テスト
// ------------------------------------------------------------

describe('管理者向け警告管理アクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
    ;(mockPrisma as Record<string, unknown>).$transaction = mockTransaction
  })

  // ============================================================
  // getWarnings
  // ============================================================

  describe('getWarnings', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getWarnings } = await import('@/lib/actions/admin/warnings')
      const result = await getWarnings()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getWarnings } = await import('@/lib/actions/admin/warnings')
      const result = await getWarnings()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('警告が0件の場合は空配列と0を返す', async () => {
      mockPrisma.userWarning.findMany.mockResolvedValue([])
      mockPrisma.userWarning.count.mockResolvedValue(0)

      const { getWarnings } = await import('@/lib/actions/admin/warnings')
      const result = await getWarnings()

      if ('error' in result) throw new Error('Expected warnings, got error')
      expect(result.warnings).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('警告一覧と総件数を正常に返す', async () => {
      mockPrisma.userWarning.findMany.mockResolvedValue([mockWarning, mockWarning2])
      mockPrisma.userWarning.count.mockResolvedValue(2)

      const { getWarnings } = await import('@/lib/actions/admin/warnings')
      const result = await getWarnings()

      if ('error' in result) throw new Error('Expected warnings, got error')
      expect(result.warnings).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('levelフィルタを正しく渡す', async () => {
      mockPrisma.userWarning.findMany.mockResolvedValue([mockWarning])
      mockPrisma.userWarning.count.mockResolvedValue(1)

      const { getWarnings } = await import('@/lib/actions/admin/warnings')
      await getWarnings({ level: 'notice' as const })

      expect(mockPrisma.userWarning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ level: 'notice' }),
        })
      )
    })

    it('userIdフィルタを正しく渡す', async () => {
      mockPrisma.userWarning.findMany.mockResolvedValue([])
      mockPrisma.userWarning.count.mockResolvedValue(0)

      const { getWarnings } = await import('@/lib/actions/admin/warnings')
      await getWarnings({ userId: 'target-user-id' })

      expect(mockPrisma.userWarning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'target-user-id' }),
        })
      )
    })

    it('isActiveフィルタを正しく渡す', async () => {
      mockPrisma.userWarning.findMany.mockResolvedValue([])
      mockPrisma.userWarning.count.mockResolvedValue(0)

      const { getWarnings } = await import('@/lib/actions/admin/warnings')
      await getWarnings({ isActive: true })

      expect(mockPrisma.userWarning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      )
    })

    it('searchフィルタでニックネーム・メールを検索する', async () => {
      mockPrisma.userWarning.findMany.mockResolvedValue([mockWarning])
      mockPrisma.userWarning.count.mockResolvedValue(1)

      const { getWarnings } = await import('@/lib/actions/admin/warnings')
      await getWarnings({ search: 'ターゲット' })

      expect(mockPrisma.userWarning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: {
              OR: [
                { nickname: { contains: 'ターゲット' } },
                { email: { contains: 'ターゲット' } },
              ],
            },
          }),
        })
      )
    })

    it('cursor ページネーションが正しく渡される', async () => {
      mockPrisma.userWarning.findMany.mockResolvedValue([])
      mockPrisma.userWarning.count.mockResolvedValue(0)

      const { getWarnings } = await import('@/lib/actions/admin/warnings')
      await getWarnings({ limit: 10, cursor: 'warn-cursor' })

      expect(mockPrisma.userWarning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'warn-cursor' },
          skip: 1,
        })
      )
    })

    it('オプションなしでは limit=20、cursor/skip なし', async () => {
      mockPrisma.userWarning.findMany.mockResolvedValue([])
      mockPrisma.userWarning.count.mockResolvedValue(0)

      const { getWarnings } = await import('@/lib/actions/admin/warnings')
      await getWarnings()

      const call = mockPrisma.userWarning.findMany.mock.calls[0][0]
      expect(call.take).toBe(20)
      expect(call.cursor).toBeUndefined()
      expect(call.skip).toBeUndefined()
    })

    it('結果にユーザー情報がincludeされる', async () => {
      mockPrisma.userWarning.findMany.mockResolvedValue([mockWarning])
      mockPrisma.userWarning.count.mockResolvedValue(1)

      const { getWarnings } = await import('@/lib/actions/admin/warnings')
      await getWarnings()

      expect(mockPrisma.userWarning.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            user: expect.any(Object),
          }),
        })
      )
    })
  })

  // ============================================================
  // issueWarning
  // ============================================================

  describe('issueWarning', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(mockTargetUser)
      mockPrisma.adminUser.findUnique.mockImplementation(
        (args: { where: { userId?: string } }) => {
          // 管理者チェック: 呼び出し元の管理者はadminレコードを返す
          // ターゲットユーザーは管理者ではない
          if (args.where.userId === mockUser.id) {
            return Promise.resolve(mockAdminUserRecord)
          }
          return Promise.resolve(null)
        }
      )
    })

    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      const result = await issueWarning({
        userId: mockTargetUser.id,
        level: 'notice',
        reason: 'テスト',
      })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      const result = await issueWarning({
        userId: mockTargetUser.id,
        level: 'notice',
        reason: 'テスト',
      })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('存在しないユーザーの場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      const result = await issueWarning({
        userId: 'nonexistent-id',
        level: 'notice',
        reason: 'テスト',
      })
      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('管理者ユーザーに対しては警告を発行できない', async () => {
      // ターゲットユーザーも管理者の場合
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      const result = await issueWarning({
        userId: mockTargetUser.id,
        level: 'notice',
        reason: 'テスト',
      })
      expect(result).toMatchObject({ error: '管理者に警告を発行できません' })
    })

    it('noticeレベルの警告を正常に発行できる', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      const result = await issueWarning({
        userId: mockTargetUser.id,
        level: 'notice',
        reason: '注意喚起です',
      })

      expect(result).toMatchObject({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
    })

    it('warningレベルの警告を正常に発行できる', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      const result = await issueWarning({
        userId: mockTargetUser.id,
        level: 'warning',
        reason: '警告です',
      })

      expect(result).toMatchObject({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
    })

    it('temp_suspendレベルではユーザーを停止する', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      const result = await issueWarning({
        userId: mockTargetUser.id,
        level: 'temp_suspend',
        reason: '一時停止です',
      })

      expect(result).toMatchObject({ success: true })
      // $transactionに渡される配列にuser.updateが含まれることを確認
      const transactionArg = mockTransaction.mock.calls[0][0]
      expect(Array.isArray(transactionArg)).toBe(true)
      // 配列には warning.create + user.update + adminLog.create の3つ
      expect(transactionArg).toHaveLength(3)
    })

    it('permanent_banレベルではユーザーを停止する', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      const result = await issueWarning({
        userId: mockTargetUser.id,
        level: 'permanent_ban',
        reason: '永久停止です',
      })

      expect(result).toMatchObject({ success: true })
      const transactionArg = mockTransaction.mock.calls[0][0]
      expect(Array.isArray(transactionArg)).toBe(true)
      // warning.create + user.update + adminLog.create の3つ
      expect(transactionArg).toHaveLength(3)
    })

    it('noticeレベルではユーザー停止しない（配列は2要素）', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      await issueWarning({
        userId: mockTargetUser.id,
        level: 'notice',
        reason: '注意のみ',
      })

      const transactionArg = mockTransaction.mock.calls[0][0]
      expect(Array.isArray(transactionArg)).toBe(true)
      // warning.create + adminLog.create の2つ（user.updateなし）
      expect(transactionArg).toHaveLength(2)
    })

    it('expiresAtを指定した場合に期限が設定される', async () => {
      const expiresAt = '2025-12-31T23:59:59.000Z'
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      const result = await issueWarning({
        userId: mockTargetUser.id,
        level: 'notice',
        reason: '期限付き警告',
        expiresAt,
      })

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.userWarning.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: new Date(expiresAt),
        }),
      })
    })

    it('relatedReportIdを指定した場合に通報IDが紐付けられる', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      const result = await issueWarning({
        userId: mockTargetUser.id,
        level: 'warning',
        reason: '通報に基づく警告',
        relatedReportId: 'report-123',
      })

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.userWarning.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          relatedReportId: 'report-123',
        }),
      })
    })

    it('発行後にrevalidatePathが呼ばれる', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      await issueWarning({
        userId: mockTargetUser.id,
        level: 'notice',
        reason: 'テスト',
      })

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/warnings')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('adminLogにissue_warningアクションが記録される', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      await issueWarning({
        userId: mockTargetUser.id,
        level: 'warning',
        reason: '記録テスト',
      })

      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: mockUser.id,
          action: 'issue_warning',
          targetType: 'user',
          targetId: mockTargetUser.id,
          details: expect.stringContaining('warning'),
        }),
      })
    })

    it('issuedByに管理者のuserIdが設定される', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      await issueWarning({
        userId: mockTargetUser.id,
        level: 'notice',
        reason: 'テスト',
      })

      expect(mockPrisma.userWarning.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          issuedBy: mockUser.id,
        }),
      })
    })
  })

  // ============================================================
  // deactivateWarning
  // ============================================================

  describe('deactivateWarning', () => {
    beforeEach(() => {
      mockPrisma.userWarning.findUnique.mockResolvedValue(mockWarning)
    })

    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { deactivateWarning } = await import('@/lib/actions/admin/warnings')
      const result = await deactivateWarning('warning-1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { deactivateWarning } = await import('@/lib/actions/admin/warnings')
      const result = await deactivateWarning('warning-1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('存在しない警告IDの場合はエラーを返す', async () => {
      mockPrisma.userWarning.findUnique.mockResolvedValue(null)
      const { deactivateWarning } = await import('@/lib/actions/admin/warnings')
      const result = await deactivateWarning('nonexistent-warning')
      expect(result).toMatchObject({ error: '警告が見つかりません' })
    })

    it('警告を正常に無効化できる', async () => {
      const { deactivateWarning } = await import('@/lib/actions/admin/warnings')
      const result = await deactivateWarning('warning-1')
      expect(result).toMatchObject({ success: true })
    })

    it('$transactionでupdateとadminLog.createが実行される', async () => {
      const { deactivateWarning } = await import('@/lib/actions/admin/warnings')
      await deactivateWarning('warning-1')

      expect(mockTransaction).toHaveBeenCalled()
      expect(mockPrisma.userWarning.update).toHaveBeenCalledWith({
        where: { id: 'warning-1' },
        data: { isActive: false },
      })
      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: mockUser.id,
          action: 'deactivate_warning',
          targetType: 'user',
          targetId: mockWarning.userId,
        }),
      })
    })

    it('無効化後にrevalidatePathが呼ばれる', async () => {
      const { deactivateWarning } = await import('@/lib/actions/admin/warnings')
      await deactivateWarning('warning-1')

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/warnings')
    })

    it('adminLogのdetailsにwarningIdが含まれる', async () => {
      const { deactivateWarning } = await import('@/lib/actions/admin/warnings')
      await deactivateWarning('warning-1')

      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: expect.stringContaining('warning-1'),
        }),
      })
    })
  })

  // ============================================================
  // getUserWarningsSummary
  // ============================================================

  describe('getUserWarningsSummary', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getUserWarningsSummary } = await import('@/lib/actions/admin/warnings')
      const result = await getUserWarningsSummary('target-user-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getUserWarningsSummary } = await import('@/lib/actions/admin/warnings')
      const result = await getUserWarningsSummary('target-user-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('警告サマリーを正常に返す', async () => {
      mockPrisma.userWarning.count
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(3) // active
      mockPrisma.userWarning.groupBy.mockResolvedValue([
        { level: 'notice', _count: 1 },
        { level: 'warning', _count: 2 },
      ])

      const { getUserWarningsSummary } = await import('@/lib/actions/admin/warnings')
      const result = await getUserWarningsSummary('target-user-id')

      if ('error' in result) throw new Error('Expected summary, got error')
      expect(result.total).toBe(5)
      expect(result.active).toBe(3)
      expect(result.byLevel).toEqual({ notice: 1, warning: 2 })
    })

    it('警告が0件の場合は全て0を返す', async () => {
      mockPrisma.userWarning.count
        .mockResolvedValueOnce(0) // total
        .mockResolvedValueOnce(0) // active
      mockPrisma.userWarning.groupBy.mockResolvedValue([])

      const { getUserWarningsSummary } = await import('@/lib/actions/admin/warnings')
      const result = await getUserWarningsSummary('target-user-id')

      if ('error' in result) throw new Error('Expected summary, got error')
      expect(result.total).toBe(0)
      expect(result.active).toBe(0)
      expect(result.byLevel).toEqual({})
    })

    it('countにuserIdが正しく渡される', async () => {
      mockPrisma.userWarning.count.mockResolvedValue(0)
      mockPrisma.userWarning.groupBy.mockResolvedValue([])

      const { getUserWarningsSummary } = await import('@/lib/actions/admin/warnings')
      await getUserWarningsSummary('specific-user-id')

      expect(mockPrisma.userWarning.count).toHaveBeenCalledWith({
        where: { userId: 'specific-user-id' },
      })
      expect(mockPrisma.userWarning.count).toHaveBeenCalledWith({
        where: { userId: 'specific-user-id', isActive: true },
      })
    })

    it('groupByにuserIdとisActive条件が渡される', async () => {
      mockPrisma.userWarning.count.mockResolvedValue(0)
      mockPrisma.userWarning.groupBy.mockResolvedValue([])

      const { getUserWarningsSummary } = await import('@/lib/actions/admin/warnings')
      await getUserWarningsSummary('specific-user-id')

      expect(mockPrisma.userWarning.groupBy).toHaveBeenCalledWith({
        by: ['level'],
        where: { userId: 'specific-user-id', isActive: true },
        _count: true,
      })
    })
  })

  // ============================================================
  // issueWarning トランザクション内容の検証
  // ============================================================

  describe('issueWarning トランザクション内容の検証', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(mockTargetUser)
      mockPrisma.adminUser.findUnique.mockImplementation(
        (args: { where: { userId?: string } }) => {
          if (args.where.userId === mockUser.id) {
            return Promise.resolve(mockAdminUserRecord)
          }
          return Promise.resolve(null)
        }
      )
    })

    it('notice/warningレベルはトランザクションにuser.updateを含まない', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')

      for (const level of ['notice', 'warning'] as const) {
        vi.clearAllMocks()
        mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
        mockPrisma.user.findUnique.mockResolvedValue(mockTargetUser)
        mockPrisma.adminUser.findUnique.mockImplementation(
          (args: { where: { userId?: string } }) => {
            if (args.where.userId === mockUser.id) {
              return Promise.resolve(mockAdminUserRecord)
            }
            return Promise.resolve(null)
          }
        )
        ;(mockPrisma as Record<string, unknown>).$transaction = mockTransaction

        await issueWarning({
          userId: mockTargetUser.id,
          level,
          reason: `${level}テスト`,
        })

        expect(mockPrisma.user.update).not.toHaveBeenCalled()
      }
    })

    it('temp_suspendはトランザクションにuser.update(isSuspended:true)を含む', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      await issueWarning({
        userId: mockTargetUser.id,
        level: 'temp_suspend',
        reason: '一時停止テスト',
      })

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockTargetUser.id },
        data: expect.objectContaining({ isSuspended: true }),
      })
    })

    it('permanent_banはトランザクションにuser.update(isSuspended:true)を含む', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      await issueWarning({
        userId: mockTargetUser.id,
        level: 'permanent_ban',
        reason: '永久停止テスト',
      })

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockTargetUser.id },
        data: expect.objectContaining({ isSuspended: true }),
      })
    })

    it('トランザクションのadminLog.createに正しいaction/targetType/detailsが含まれる', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      await issueWarning({
        userId: mockTargetUser.id,
        level: 'notice',
        reason: '詳細確認テスト',
      })

      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'issue_warning',
          targetType: 'user',
          targetId: mockTargetUser.id,
          details: expect.stringContaining('"level":"notice"'),
        }),
      })
      // detailsにreasonも含まれる
      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: expect.stringContaining('詳細確認テスト'),
        }),
      })
    })
  })

  // ============================================================
  // 警告レベルのエスカレーション
  // ============================================================

  describe('警告レベルのエスカレーション', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(mockTargetUser)
      mockPrisma.adminUser.findUnique.mockImplementation(
        (args: { where: { userId?: string } }) => {
          if (args.where.userId === mockUser.id) {
            return Promise.resolve(mockAdminUserRecord)
          }
          return Promise.resolve(null)
        }
      )
    })

    it('temp_suspend警告発行後、ユーザーのisSuspendedがtrueになる', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      const result = await issueWarning({
        userId: mockTargetUser.id,
        level: 'temp_suspend',
        reason: '一時停止エスカレーション',
      })

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockTargetUser.id },
          data: expect.objectContaining({
            isSuspended: true,
            suspendedAt: expect.any(Date),
          }),
        })
      )
    })

    it('permanent_ban警告発行後、ユーザーのisSuspendedがtrueになる', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      const result = await issueWarning({
        userId: mockTargetUser.id,
        level: 'permanent_ban',
        reason: '永久停止エスカレーション',
      })

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockTargetUser.id },
          data: expect.objectContaining({
            isSuspended: true,
            suspendedAt: expect.any(Date),
          }),
        })
      )
    })

    it('expiresAtが設定された場合、正しいDate型に変換される', async () => {
      const isoString = '2026-06-15T12:00:00.000Z'
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      await issueWarning({
        userId: mockTargetUser.id,
        level: 'temp_suspend',
        reason: '期限付き停止',
        expiresAt: isoString,
      })

      expect(mockPrisma.userWarning.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: new Date(isoString),
        }),
      })
      // Date型であることを確認
      const callData = mockPrisma.userWarning.create.mock.calls[0][0].data
      expect(callData.expiresAt).toBeInstanceOf(Date)
    })

    it('expiresAtが空の場合、nullが設定される', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      await issueWarning({
        userId: mockTargetUser.id,
        level: 'notice',
        reason: '期限なし警告',
      })

      expect(mockPrisma.userWarning.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: null,
        }),
      })
    })
  })

  // ============================================================
  // 境界・エッジケース
  // ============================================================

  describe('境界・エッジケース', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(mockTargetUser)
      mockPrisma.adminUser.findUnique.mockImplementation(
        (args: { where: { userId?: string } }) => {
          if (args.where.userId === mockUser.id) {
            return Promise.resolve(mockAdminUserRecord)
          }
          return Promise.resolve(null)
        }
      )
    })

    it('既に停止中のユーザーにtemp_suspend警告を発行しても成功する', async () => {
      // admin (mockUser.id) は active、対象 (target-user-id) は suspended
      mockPrisma.user.findUnique.mockImplementation((args: { where?: { id?: string } } | undefined) => {
        if (args?.where?.id === mockUser.id) return Promise.resolve({ isSuspended: false })
        return Promise.resolve({
          ...mockTargetUser,
          isSuspended: true,
          suspendedAt: new Date('2024-01-01'),
        })
      })

      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      const result = await issueWarning({
        userId: mockTargetUser.id,
        level: 'temp_suspend',
        reason: '追加停止',
      })

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isSuspended: true }),
        })
      )
    })

    it('非常に長いreason（1000文字以上）でも正常に発行できる', async () => {
      const longReason = 'あ'.repeat(1500)
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      const result = await issueWarning({
        userId: mockTargetUser.id,
        level: 'warning',
        reason: longReason,
      })

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.userWarning.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reason: longReason,
        }),
      })
    })

    it('relatedReportIdが空文字の場合、nullが設定される', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')
      await issueWarning({
        userId: mockTargetUser.id,
        level: 'notice',
        reason: 'テスト',
        relatedReportId: '',
      })

      // 空文字は falsy なので null になる
      expect(mockPrisma.userWarning.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          relatedReportId: null,
        }),
      })
    })

    it('同じユーザーに同じレベルの警告を重複発行できる', async () => {
      const { issueWarning } = await import('@/lib/actions/admin/warnings')

      const result1 = await issueWarning({
        userId: mockTargetUser.id,
        level: 'notice',
        reason: '1回目の注意',
      })
      const result2 = await issueWarning({
        userId: mockTargetUser.id,
        level: 'notice',
        reason: '2回目の注意',
      })

      expect(result1).toMatchObject({ success: true })
      expect(result2).toMatchObject({ success: true })
      expect(mockPrisma.userWarning.create).toHaveBeenCalledTimes(2)
    })
  })

  // ============================================================
  // 返り値の検証
  // ============================================================

  describe('返り値の検証', () => {
    it('getWarningsが返すwarningsの各要素にuser情報が含まれる', async () => {
      const warningWithUser = {
        ...mockWarning,
        user: {
          id: mockTargetUser.id,
          nickname: mockTargetUser.nickname,
          email: mockTargetUser.email,
          avatarUrl: mockTargetUser.avatarUrl,
        },
      }
      mockPrisma.userWarning.findMany.mockResolvedValue([warningWithUser])
      mockPrisma.userWarning.count.mockResolvedValue(1)

      const { getWarnings } = await import('@/lib/actions/admin/warnings')
      const result = await getWarnings()

      if ('error' in result) throw new Error('Expected warnings, got error')
      expect(result.warnings[0].user).toEqual({
        id: mockTargetUser.id,
        nickname: mockTargetUser.nickname,
        email: mockTargetUser.email,
        avatarUrl: mockTargetUser.avatarUrl,
      })
    })

    it('getUserWarningsSummaryのbyLevelが正しいキーと値を持つ', async () => {
      mockPrisma.userWarning.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7) // active
      mockPrisma.userWarning.groupBy.mockResolvedValue([
        { level: 'notice', _count: 3 },
        { level: 'warning', _count: 2 },
        { level: 'temp_suspend', _count: 1 },
        { level: 'permanent_ban', _count: 1 },
      ])

      const { getUserWarningsSummary } = await import('@/lib/actions/admin/warnings')
      const result = await getUserWarningsSummary('target-user-id')

      if ('error' in result) throw new Error('Expected summary, got error')
      expect(result.total).toBe(10)
      expect(result.active).toBe(7)
      expect(result.byLevel).toEqual({
        notice: 3,
        warning: 2,
        temp_suspend: 1,
        permanent_ban: 1,
      })
    })
  })

  // ============================================================
  // deactivateWarning 追加検証
  // ============================================================

  describe('deactivateWarning 追加検証', () => {
    beforeEach(() => {
      mockPrisma.userWarning.findUnique.mockResolvedValue(mockWarning)
    })

    it('無効化後にrevalidatePathが"/admin/warnings"で呼ばれる', async () => {
      const { deactivateWarning } = await import('@/lib/actions/admin/warnings')
      await deactivateWarning('warning-1')

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/warnings')
      // /admin/usersは呼ばれない（issueWarningとは異なる）
      expect(mockRevalidatePath).not.toHaveBeenCalledWith('/admin/users')
    })

    it('無効化のトランザクションにwarning.update(isActive:false)とadminLog.createが含まれる', async () => {
      const { deactivateWarning } = await import('@/lib/actions/admin/warnings')
      await deactivateWarning('warning-1')

      const transactionArg = mockTransaction.mock.calls[0][0]
      expect(Array.isArray(transactionArg)).toBe(true)
      expect(transactionArg).toHaveLength(2)

      expect(mockPrisma.userWarning.update).toHaveBeenCalledWith({
        where: { id: 'warning-1' },
        data: { isActive: false },
      })
      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'deactivate_warning',
          targetType: 'user',
          targetId: mockWarning.userId,
          details: expect.stringContaining('warning-1'),
        }),
      })
    })

    it('既に無効化済みの警告でもエラーにならない', async () => {
      mockPrisma.userWarning.findUnique.mockResolvedValue({
        ...mockWarning,
        isActive: false,
      })

      const { deactivateWarning } = await import('@/lib/actions/admin/warnings')
      const result = await deactivateWarning('warning-1')

      // 実装上はisActiveチェックをしていないので成功する
      expect(result).toMatchObject({ success: true })
    })
  })
})
