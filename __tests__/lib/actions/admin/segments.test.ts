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

describe('管理者セグメントアクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
  })

  // ============================================================
  // getSegments
  // ============================================================
  describe('getSegments', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getSegments } = await import('@/lib/actions/admin/segments')
      const result = await getSegments()
      expect(result).toHaveProperty('error')
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getSegments } = await import('@/lib/actions/admin/segments')
      const result = await getSegments()
      expect(result).toHaveProperty('error')
    })

    it('空のセグメント一覧を返す', async () => {
      mockPrisma.userSegment.findMany.mockResolvedValue([])
      mockPrisma.userSegment.count.mockResolvedValue(0)
      const { getSegments } = await import('@/lib/actions/admin/segments')
      const result = await getSegments()
      const data = result as { segments: unknown[]; total: number }
      expect(data.segments).toEqual([])
      expect(data.total).toBe(0)
    })

    it('セグメント一覧を正しく返す', async () => {
      const mockSegments = [
        { id: 'seg-1', name: 'プレミアム', description: 'プレミアムユーザー', conditions: {}, createdAt: new Date(), createdBy: mockUser.id },
        { id: 'seg-2', name: 'アクティブ', description: null, conditions: {}, createdAt: new Date(), createdBy: mockUser.id },
      ]
      mockPrisma.userSegment.findMany.mockResolvedValue(mockSegments)
      mockPrisma.userSegment.count.mockResolvedValue(2)
      const { getSegments } = await import('@/lib/actions/admin/segments')
      const result = await getSegments()
      const data = result as { segments: typeof mockSegments; total: number }
      expect(data.segments.length).toBe(2)
      expect(data.total).toBe(2)
    })

    it('デフォルトでは limit=20、cursor/skip なし', async () => {
      mockPrisma.userSegment.findMany.mockResolvedValue([])
      mockPrisma.userSegment.count.mockResolvedValue(0)
      const { getSegments } = await import('@/lib/actions/admin/segments')
      await getSegments()
      const call = mockPrisma.userSegment.findMany.mock.calls[0][0]
      expect(call.take).toBe(20)
      expect(call.cursor).toBeUndefined()
      expect(call.skip).toBeUndefined()
    })

    it('cursor ページネーションが適用される', async () => {
      mockPrisma.userSegment.findMany.mockResolvedValue([])
      mockPrisma.userSegment.count.mockResolvedValue(50)
      const { getSegments } = await import('@/lib/actions/admin/segments')
      await getSegments({ limit: 10, cursor: 'seg-cursor' })
      const call = mockPrisma.userSegment.findMany.mock.calls[0][0]
      expect(call.take).toBe(10)
      expect(call.cursor).toEqual({ id: 'seg-cursor' })
      expect(call.skip).toBe(1)
    })

    it('作成日降順 + id降順 の複合キーでソートされる', async () => {
      mockPrisma.userSegment.findMany.mockResolvedValue([])
      mockPrisma.userSegment.count.mockResolvedValue(0)
      const { getSegments } = await import('@/lib/actions/admin/segments')
      await getSegments()
      const call = mockPrisma.userSegment.findMany.mock.calls[0][0]
      expect(call.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }])
    })
  })

  // ============================================================
  // createSegment
  // ============================================================
  describe('createSegment', () => {
    const validConditions = {
      rules: [{ field: 'isPremium' as const, operator: 'is' as const, value: true }],
      logic: 'AND' as const,
    }

    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { createSegment } = await import('@/lib/actions/admin/segments')
      const result = await createSegment({ name: 'テスト', conditions: validConditions })
      expect(result).toHaveProperty('error')
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { createSegment } = await import('@/lib/actions/admin/segments')
      const result = await createSegment({ name: 'テスト', conditions: validConditions })
      expect(result).toHaveProperty('error')
    })

    it('空の名前はエラーを返す', async () => {
      const { createSegment } = await import('@/lib/actions/admin/segments')
      const result = await createSegment({ name: '', conditions: validConditions })
      expect(result).toEqual({ success: false, error: 'セグメント名を入力してください' })
    })

    it('スペースのみの名前はエラーを返す', async () => {
      const { createSegment } = await import('@/lib/actions/admin/segments')
      const result = await createSegment({ name: '   ', conditions: validConditions })
      expect(result).toEqual({ success: false, error: 'セグメント名を入力してください' })
    })

    it('正常にセグメントを作成できる', async () => {
      const mockSegment = {
        id: 'new-seg-id',
        name: 'プレミアムユーザー',
        description: null,
        conditions: validConditions,
        createdBy: mockUser.id,
        createdAt: new Date(),
      }
      mockPrisma.userSegment.create.mockResolvedValue(mockSegment)

      const { createSegment } = await import('@/lib/actions/admin/segments')
      const result = await createSegment({ name: 'プレミアムユーザー', conditions: validConditions })
      expect(result).toEqual({ success: true, data: mockSegment })
    })

    it('説明付きでセグメントを作成できる', async () => {
      const mockSegment = {
        id: 'new-seg-id',
        name: 'テスト',
        description: '説明文',
        conditions: validConditions,
        createdBy: mockUser.id,
        createdAt: new Date(),
      }
      mockPrisma.userSegment.create.mockResolvedValue(mockSegment)

      const { createSegment } = await import('@/lib/actions/admin/segments')
      await createSegment({ name: 'テスト', description: '説明文', conditions: validConditions })
      const call = mockPrisma.userSegment.create.mock.calls[0][0]
      expect(call.data.description).toBe('説明文')
    })

    it('名前の前後空白がトリムされる', async () => {
      mockPrisma.userSegment.create.mockResolvedValue({ id: 'seg-id', name: 'テスト' })
      const { createSegment } = await import('@/lib/actions/admin/segments')
      await createSegment({ name: '  テスト  ', conditions: validConditions })
      const call = mockPrisma.userSegment.create.mock.calls[0][0]
      expect(call.data.name).toBe('テスト')
    })

    it('作成後にrevalidatePathが呼ばれる', async () => {
      mockPrisma.userSegment.create.mockResolvedValue({ id: 'seg-id', name: 'テスト' })
      const { createSegment } = await import('@/lib/actions/admin/segments')
      await createSegment({ name: 'テスト', conditions: validConditions })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/segments')
    })

    it('createdByにadminのuserIdが設定される', async () => {
      mockPrisma.userSegment.create.mockResolvedValue({ id: 'seg-id', name: 'テスト' })
      const { createSegment } = await import('@/lib/actions/admin/segments')
      await createSegment({ name: 'テスト', conditions: validConditions })
      const call = mockPrisma.userSegment.create.mock.calls[0][0]
      expect(call.data.createdBy).toBe(mockUser.id)
    })
  })

  // ============================================================
  // deleteSegment
  // ============================================================
  describe('deleteSegment', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { deleteSegment } = await import('@/lib/actions/admin/segments')
      const result = await deleteSegment('seg-1')
      expect(result).toHaveProperty('error')
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { deleteSegment } = await import('@/lib/actions/admin/segments')
      const result = await deleteSegment('seg-1')
      expect(result).toHaveProperty('error')
    })

    it('セグメントが見つからない場合はエラーを返す', async () => {
      mockPrisma.userSegment.findUnique.mockResolvedValue(null)
      const { deleteSegment } = await import('@/lib/actions/admin/segments')
      const result = await deleteSegment('nonexistent-id')
      expect(result).toEqual({ success: false, error: 'セグメントが見つかりません' })
    })

    it('正常にセグメントを削除できる', async () => {
      mockPrisma.userSegment.findUnique.mockResolvedValue({ id: 'seg-1', name: 'テスト' })
      mockPrisma.userSegment.delete.mockResolvedValue({ id: 'seg-1' })
      const { deleteSegment } = await import('@/lib/actions/admin/segments')
      const result = await deleteSegment('seg-1')
      expect(result).toEqual({ success: true })
    })

    it('削除時にrevalidatePathが呼ばれる', async () => {
      mockPrisma.userSegment.findUnique.mockResolvedValue({ id: 'seg-1', name: 'テスト' })
      mockPrisma.userSegment.delete.mockResolvedValue({ id: 'seg-1' })
      const { deleteSegment } = await import('@/lib/actions/admin/segments')
      await deleteSegment('seg-1')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/segments')
    })

    it('正しいIDでdeleteが呼ばれる', async () => {
      mockPrisma.userSegment.findUnique.mockResolvedValue({ id: 'seg-1', name: 'テスト' })
      mockPrisma.userSegment.delete.mockResolvedValue({ id: 'seg-1' })
      const { deleteSegment } = await import('@/lib/actions/admin/segments')
      await deleteSegment('seg-1')
      expect(mockPrisma.userSegment.delete).toHaveBeenCalledWith({ where: { id: 'seg-1' } })
    })
  })

  // ============================================================
  // evaluateSegment
  // ============================================================
  describe('evaluateSegment', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { evaluateSegment } = await import('@/lib/actions/admin/segments')
      const result = await evaluateSegment('seg-1')
      expect(result).toHaveProperty('error')
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { evaluateSegment } = await import('@/lib/actions/admin/segments')
      const result = await evaluateSegment('seg-1')
      expect(result).toHaveProperty('error')
    })

    it('セグメントが見つからない場合はエラーを返す', async () => {
      mockPrisma.userSegment.findUnique.mockResolvedValue(null)
      const { evaluateSegment } = await import('@/lib/actions/admin/segments')
      const result = await evaluateSegment('nonexistent-id')
      expect(result).toEqual({ success: false, error: 'セグメントが見つかりません' })
    })

    it('該当ユーザー数を返す（AND条件）', async () => {
      mockPrisma.userSegment.findUnique.mockResolvedValue({
        id: 'seg-1',
        name: 'テスト',
        conditions: {
          rules: [{ field: 'isPremium', operator: 'is', value: true }],
          logic: 'AND',
        },
      })
      mockPrisma.user.count.mockResolvedValue(42)

      const { evaluateSegment } = await import('@/lib/actions/admin/segments')
      const result = await evaluateSegment('seg-1')
      expect(result).toEqual({ count: 42 })
    })

    it('該当ユーザー数を返す（OR条件）', async () => {
      mockPrisma.userSegment.findUnique.mockResolvedValue({
        id: 'seg-2',
        name: 'テスト2',
        conditions: {
          rules: [
            { field: 'isPremium', operator: 'is', value: true },
            { field: 'location', operator: 'contains', value: '東京' },
          ],
          logic: 'OR',
        },
      })
      mockPrisma.user.count.mockResolvedValue(100)

      const { evaluateSegment } = await import('@/lib/actions/admin/segments')
      const result = await evaluateSegment('seg-2')
      expect(result).toEqual({ count: 100 })
    })

    it('ゼロ件の場合もcount: 0を返す', async () => {
      mockPrisma.userSegment.findUnique.mockResolvedValue({
        id: 'seg-1',
        name: 'テスト',
        conditions: {
          rules: [{ field: 'isSuspended', operator: 'is', value: true }],
          logic: 'AND',
        },
      })
      mockPrisma.user.count.mockResolvedValue(0)

      const { evaluateSegment } = await import('@/lib/actions/admin/segments')
      const result = await evaluateSegment('seg-1')
      expect(result).toEqual({ count: 0 })
    })

    it('createdAt条件が正しくwhere句に変換される', async () => {
      mockPrisma.userSegment.findUnique.mockResolvedValue({
        id: 'seg-1',
        name: 'テスト',
        conditions: {
          rules: [{ field: 'createdAt', operator: 'gte', value: '2024-01-01' }],
          logic: 'AND',
        },
      })
      mockPrisma.user.count.mockResolvedValue(10)

      const { evaluateSegment } = await import('@/lib/actions/admin/segments')
      await evaluateSegment('seg-1')
      const call = mockPrisma.user.count.mock.calls[0][0]
      expect(call.where.AND[0].createdAt.gte).toBeInstanceOf(Date)
    })
  })

  // ============================================================
  // Segment condition building (追加テスト)
  // ============================================================

  describe('セグメント条件のwhere句構築', () => {
    it('AND条件で複数ルールが正しくAND配列に構築される', async () => {
      mockPrisma.userSegment.findUnique.mockResolvedValue({
        id: 'seg-and',
        name: 'AND条件テスト',
        conditions: {
          rules: [
            { field: 'isPremium', operator: 'is', value: true },
            { field: 'location', operator: 'contains', value: '東京' },
          ],
          logic: 'AND',
        },
      })
      mockPrisma.user.count.mockResolvedValue(5)

      const { evaluateSegment } = await import('@/lib/actions/admin/segments')
      await evaluateSegment('seg-and')

      const call = mockPrisma.user.count.mock.calls[0][0]
      expect(call.where).toHaveProperty('AND')
      expect(call.where.AND).toHaveLength(2)
      expect(call.where.AND[0]).toEqual({ isPremium: true })
      expect(call.where.AND[1]).toEqual({ location: { contains: '東京' } })
    })

    it('OR条件の場合のwhere句がOR配列で構築される', async () => {
      mockPrisma.userSegment.findUnique.mockResolvedValue({
        id: 'seg-or',
        name: 'OR条件テスト',
        conditions: {
          rules: [
            { field: 'isPremium', operator: 'is', value: true },
            { field: 'isSuspended', operator: 'is', value: false },
          ],
          logic: 'OR',
        },
      })
      mockPrisma.user.count.mockResolvedValue(50)

      const { evaluateSegment } = await import('@/lib/actions/admin/segments')
      await evaluateSegment('seg-or')

      const call = mockPrisma.user.count.mock.calls[0][0]
      expect(call.where).toHaveProperty('OR')
      expect(call.where.OR).toHaveLength(2)
    })

    it('isPremium条件が文字列"true"でもboolean trueに変換される', async () => {
      mockPrisma.userSegment.findUnique.mockResolvedValue({
        id: 'seg-str-bool',
        name: '文字列boolean変換テスト',
        conditions: {
          rules: [{ field: 'isPremium', operator: 'is', value: 'true' }],
          logic: 'AND',
        },
      })
      mockPrisma.user.count.mockResolvedValue(3)

      const { evaluateSegment } = await import('@/lib/actions/admin/segments')
      await evaluateSegment('seg-str-bool')

      const call = mockPrisma.user.count.mock.calls[0][0]
      expect(call.where.AND[0].isPremium).toBe(true)
    })

    it('createdAt条件のgt演算子が正しいDate変換をする', async () => {
      const dateStr = '2025-06-15'
      mockPrisma.userSegment.findUnique.mockResolvedValue({
        id: 'seg-date',
        name: '日付変換テスト',
        conditions: {
          rules: [{ field: 'createdAt', operator: 'gt', value: dateStr }],
          logic: 'AND',
        },
      })
      mockPrisma.user.count.mockResolvedValue(10)

      const { evaluateSegment } = await import('@/lib/actions/admin/segments')
      await evaluateSegment('seg-date')

      const call = mockPrisma.user.count.mock.calls[0][0]
      const createdAtClause = call.where.AND[0].createdAt
      expect(createdAtClause).toHaveProperty('gt')
      expect(createdAtClause.gt).toBeInstanceOf(Date)
      expect(createdAtClause.gt.toISOString()).toContain('2025-06-15')
    })
  })

  // ============================================================
  // Return value verification (追加テスト)
  // ============================================================

  describe('返り値の検証', () => {
    it('createSegmentが作成されたsegmentオブジェクトをdataとして返す', async () => {
      const mockSegment = {
        id: 'created-seg-id',
        name: '新セグメント',
        description: null,
        conditions: { rules: [{ field: 'isPremium', operator: 'is', value: true }], logic: 'AND' },
        createdBy: mockUser.id,
        createdAt: new Date('2025-01-01'),
      }
      mockPrisma.userSegment.create.mockResolvedValue(mockSegment)

      const { createSegment } = await import('@/lib/actions/admin/segments')
      const result = await createSegment({
        name: '新セグメント',
        conditions: { rules: [{ field: 'isPremium' as const, operator: 'is' as const, value: true }], logic: 'AND' as const },
      })

      expect(result).toEqual({ success: true, data: mockSegment })
      expect((result as { data: typeof mockSegment }).data.id).toBe('created-seg-id')
    })

    it('evaluateSegmentのcountが正しい数値を返す', async () => {
      mockPrisma.userSegment.findUnique.mockResolvedValue({
        id: 'seg-count',
        name: 'カウントテスト',
        conditions: {
          rules: [{ field: 'isSuspended', operator: 'is', value: true }],
          logic: 'AND',
        },
      })
      mockPrisma.user.count.mockResolvedValue(12345)

      const { evaluateSegment } = await import('@/lib/actions/admin/segments')
      const result = await evaluateSegment('seg-count')

      expect(result).toEqual({ count: 12345 })
      expect(typeof (result as { count: number }).count).toBe('number')
    })
  })

  // ============================================================
  // Edge cases (追加テスト)
  // ============================================================

  describe('エッジケース', () => {
    it('conditionsが空のルール配列の場合でもcountを返す', async () => {
      mockPrisma.userSegment.findUnique.mockResolvedValue({
        id: 'seg-empty',
        name: '空条件テスト',
        conditions: {
          rules: [],
          logic: 'AND',
        },
      })
      mockPrisma.user.count.mockResolvedValue(999)

      const { evaluateSegment } = await import('@/lib/actions/admin/segments')
      const result = await evaluateSegment('seg-empty')

      expect(result).toEqual({ count: 999 })
      // AND with empty array
      const call = mockPrisma.user.count.mock.calls[0][0]
      expect(call.where.AND).toEqual([])
    })

    it('未知のfield名の場合はZodがセグメント条件を不正と判定する', async () => {
      // segmentConditionsSchema は field を enum で制限するため、
      // 未知の field は parseSegmentConditions 段階で拒否される（Zod 化による仕様厳格化）。
      mockPrisma.userSegment.findUnique.mockResolvedValue({
        id: 'seg-unknown',
        name: '未知フィールドテスト',
        conditions: {
          rules: [{ field: 'unknownField', operator: 'eq', value: 'test' }],
          logic: 'AND',
        },
      })

      const { evaluateSegment } = await import('@/lib/actions/admin/segments')
      const result = await evaluateSegment('seg-unknown')

      expect(result).toMatchObject({ success: false, error: 'セグメント条件が不正です' })
      expect(mockPrisma.user.count).not.toHaveBeenCalled()
    })
  })
})
