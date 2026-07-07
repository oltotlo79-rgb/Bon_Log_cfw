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
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
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

const mockPesticide = {
  id: 'pesticide-1',
  name: 'テスト農薬A',
  registrationNumber: 'REG-001',
  pesticideType: 'insecticide',
  formulationTypeId: 'form-1',
  description: 'テスト用農薬の説明',
  slug: 'test-pesticide-a',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockPesticideWithRelations = {
  ...mockPesticide,
  formulationType: { id: 'form-1', name: '乳剤' },
  ingredients: [
    { id: 'ing-1', activeIngredient: { id: 'ai-1', name: '有効成分A' } },
  ],
  effects: [
    { id: 'eff-1', diseasePest: { id: 'dp-1', name: 'アブラムシ' } },
  ],
  incompatibleWith: [
    { id: 'inc-1', incompatibleWith: { id: 'pesticide-2', name: '農薬B' } },
  ],
  spreaderTypes: [
    { id: 'sp-1', spreaderType: { id: 'spt-1', name: '展着剤A' } },
  ],
}

describe('農薬データ管理アクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
    ;(mockPrisma as Record<string, unknown>).$transaction = mockTransaction

    // pesticide モデルを追加
    if (!(mockPrisma as Record<string, unknown>).pesticide) {
      ;(mockPrisma as Record<string, unknown>).pesticide = {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      }
    } else {
      const p = (mockPrisma as Record<string, unknown>).pesticide as Record<string, ReturnType<typeof vi.fn>>
      p.findUnique = vi.fn()
      p.findMany = vi.fn()
      p.create = vi.fn()
      p.update = vi.fn()
      p.delete = vi.fn()
      p.count = vi.fn()
    }

    // pesticideDataHistory モデルを追加
    if (!(mockPrisma as Record<string, unknown>).pesticideDataHistory) {
      ;(mockPrisma as Record<string, unknown>).pesticideDataHistory = {
        findMany: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
      }
    } else {
      const h = (mockPrisma as Record<string, unknown>).pesticideDataHistory as Record<string, ReturnType<typeof vi.fn>>
      h.findMany = vi.fn()
      h.create = vi.fn()
      h.count = vi.fn()
    }
  })

  type MockModelMethods = { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> }
  const getPesticide = () => (mockPrisma as Record<string, unknown>).pesticide as MockModelMethods
  const getHistory = () => (mockPrisma as Record<string, unknown>).pesticideDataHistory as MockModelMethods

  // ============================================================
  // getAdminPesticides
  // ============================================================

  describe('getAdminPesticides', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getAdminPesticides } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticides()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getAdminPesticides } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticides()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('オプションなしで一覧を取得する', async () => {
      getPesticide().findMany.mockResolvedValue([])
      getPesticide().count.mockResolvedValue(0)

      const { getAdminPesticides } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticides()

      if ('error' in result) throw new Error('Expected pesticides, got error')
      expect(result.pesticides).toEqual([])
      expect(result.total).toBe(0)
    })

    it('農薬一覧と総件数を正常に返す', async () => {
      const mockList = [
        { ...mockPesticide, formulationType: { name: '乳剤' }, _count: { effects: 2, ingredients: 1 } },
      ]
      getPesticide().findMany.mockResolvedValue(mockList)
      getPesticide().count.mockResolvedValue(1)

      const { getAdminPesticides } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticides()

      if ('error' in result) throw new Error('Expected pesticides, got error')
      expect(result.pesticides).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('DB エラー時は ERR_OPERATION_FAILED を返す', async () => {
      getPesticide().findMany.mockRejectedValue(new Error('DB down'))
      getPesticide().count.mockResolvedValue(0)

      const { getAdminPesticides } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticides()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('Error インスタンスでない例外が投げられても ERR_OPERATION_FAILED を返す', async () => {
      getPesticide().findMany.mockRejectedValue('string rejection')
      getPesticide().count.mockResolvedValue(0)

      const { getAdminPesticides } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticides()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('options が不正（limit が上限超過）なら ERR_INVALID_INPUT を返す', async () => {
      const { getAdminPesticides } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticides({ limit: 100000 })
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(getPesticide().findMany).not.toHaveBeenCalled()
    })

    it('取得件数が limit と一致する場合は nextCursor が設定される', async () => {
      const mockList = Array.from({ length: 2 }, (_, i) => ({
        ...mockPesticide,
        id: `p${i}`,
        formulationType: { name: '乳剤' },
        _count: { effects: 0, ingredients: 0 },
      }))
      getPesticide().findMany.mockResolvedValue(mockList)
      getPesticide().count.mockResolvedValue(10)

      const { getAdminPesticides } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticides({ limit: 2 })

      if ('error' in result) throw new Error('Expected pesticides, got error')
      expect(result.nextCursor).toBe('p1')
    })

    it('searchフィルタが名前と登録番号の部分一致で適用される', async () => {
      getPesticide().findMany.mockResolvedValue([])
      getPesticide().count.mockResolvedValue(0)

      const { getAdminPesticides } = await import('@/lib/actions/admin/pesticide-data')
      await getAdminPesticides({ search: 'テスト' })

      expect(getPesticide().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'テスト' } },
              { registrationNumber: { contains: 'テスト' } },
            ],
          }),
        })
      )
    })

    it('pesticideTypeフィルタが適用される', async () => {
      getPesticide().findMany.mockResolvedValue([])
      getPesticide().count.mockResolvedValue(0)

      const { getAdminPesticides } = await import('@/lib/actions/admin/pesticide-data')
      await getAdminPesticides({ pesticideType: 'insecticide' as never })

      expect(getPesticide().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pesticideType: 'insecticide',
          }),
        })
      )
    })

    it('cursor ページネーションが適用される', async () => {
      getPesticide().findMany.mockResolvedValue([])
      getPesticide().count.mockResolvedValue(50)

      const { getAdminPesticides } = await import('@/lib/actions/admin/pesticide-data')
      await getAdminPesticides({ limit: 10, cursor: 'pest-cursor' })

      expect(getPesticide().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'pest-cursor' },
          skip: 1,
        })
      )
    })

    it('デフォルトでは limit=20、cursor/skip なし', async () => {
      getPesticide().findMany.mockResolvedValue([])
      getPesticide().count.mockResolvedValue(0)

      const { getAdminPesticides } = await import('@/lib/actions/admin/pesticide-data')
      await getAdminPesticides()

      const call = getPesticide().findMany.mock.calls[0]![0]
      expect(call.take).toBe(20)
      expect(call.cursor).toBeUndefined()
      expect(call.skip).toBeUndefined()
    })

    it('includeにformulationTypeと_countが含まれる', async () => {
      getPesticide().findMany.mockResolvedValue([])
      getPesticide().count.mockResolvedValue(0)

      const { getAdminPesticides } = await import('@/lib/actions/admin/pesticide-data')
      await getAdminPesticides()

      expect(getPesticide().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            formulationType: expect.any(Object),
            _count: expect.objectContaining({
              select: expect.objectContaining({ effects: true, ingredients: true }),
            }),
          }),
        })
      )
    })

    it('searchとtypeフィルタを同時に適用できる', async () => {
      getPesticide().findMany.mockResolvedValue([])
      getPesticide().count.mockResolvedValue(0)

      const { getAdminPesticides } = await import('@/lib/actions/admin/pesticide-data')
      await getAdminPesticides({ search: '殺虫', pesticideType: 'insecticide' as never })

      expect(getPesticide().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
            pesticideType: 'insecticide',
          }),
        })
      )
    })
  })

  // ============================================================
  // getAdminPesticideDetail
  // ============================================================

  describe('getAdminPesticideDetail', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getAdminPesticideDetail } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticideDetail('pesticide-1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getAdminPesticideDetail } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticideDetail('pesticide-1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('農薬が見つからない場合はエラーを返す', async () => {
      getPesticide().findUnique.mockResolvedValue(null)

      const { getAdminPesticideDetail } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticideDetail('nonexistent-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('農薬詳細をリレーション付きで正常に返す', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticideWithRelations)
      getHistory().findMany.mockResolvedValue([
        { id: 'h1', action: 'create', createdAt: new Date() },
      ])

      const { getAdminPesticideDetail } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticideDetail('pesticide-1')

      if ('error' in result) throw new Error('Expected pesticide, got error')
      expect(result.pesticide).toEqual(mockPesticideWithRelations)
      expect(result.history).toHaveLength(1)
    })

    it('DB エラー時は ERR_OPERATION_FAILED を返す', async () => {
      getPesticide().findUnique.mockRejectedValue(new Error('DB down'))

      const { getAdminPesticideDetail } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticideDetail('pesticide-1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('Error インスタンスでない例外が投げられても ERR_OPERATION_FAILED を返す', async () => {
      getPesticide().findUnique.mockRejectedValue('string rejection')

      const { getAdminPesticideDetail } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticideDetail('pesticide-1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('id が空文字（バリデーション不正）なら ERR_INVALID_INPUT を返す', async () => {
      const { getAdminPesticideDetail } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getAdminPesticideDetail('')
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(getPesticide().findUnique).not.toHaveBeenCalled()
    })

    it('更新履歴が最大20件取得される', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticideWithRelations)
      getHistory().findMany.mockResolvedValue([])

      const { getAdminPesticideDetail } = await import('@/lib/actions/admin/pesticide-data')
      await getAdminPesticideDetail('pesticide-1')

      expect(getHistory().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pesticideId: 'pesticide-1' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      )
    })

    it('includeに全リレーションが含まれる', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticideWithRelations)
      getHistory().findMany.mockResolvedValue([])

      const { getAdminPesticideDetail } = await import('@/lib/actions/admin/pesticide-data')
      await getAdminPesticideDetail('pesticide-1')

      expect(getPesticide().findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            formulationType: true,
            ingredients: expect.any(Object),
            effects: expect.any(Object),
            incompatibleWith: expect.any(Object),
            spreaderTypes: expect.any(Object),
          }),
        })
      )
    })
  })

  // ============================================================
  // createPesticide
  // ============================================================

  describe('createPesticide', () => {
    const validData = {
      name: '新規農薬',
      registrationNumber: 'REG-NEW',
      pesticideType: 'fungicide' as never,
      formulationTypeId: 'form-1',
      description: '新規農薬の説明',
      slug: 'new-pesticide',
    }

    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await createPesticide(validData)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await createPesticide(validData)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('名前が空の場合はエラーを返す', async () => {
      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await createPesticide({ ...validData, name: '' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('名前が空白のみの場合はエラーを返す', async () => {
      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await createPesticide({ ...validData, name: '   ' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('name 以外のバリデーション不正（slug 形式違反）は ERR_INVALID_INPUT を返す', async () => {
      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await createPesticide({ ...validData, slug: 'Invalid Slug!!' })
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(getPesticide().create).not.toHaveBeenCalled()
    })

    it('DB エラー時は ERR_OPERATION_FAILED を返す', async () => {
      getPesticide().create.mockRejectedValue(new Error('DB down'))

      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await createPesticide(validData)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('Error インスタンスでない例外が投げられても ERR_OPERATION_FAILED を返す', async () => {
      getPesticide().create.mockRejectedValue('string rejection')

      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await createPesticide(validData)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('registrationNumber / formulationTypeId / description を省略すると null で保存される', async () => {
      const minimalData = { name: '最小構成農薬', pesticideType: 'fungicide' as never, slug: 'minimal-pesticide' }
      getPesticide().create.mockResolvedValue({ ...mockPesticide, id: 'minimal-id' })
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      await createPesticide(minimalData)

      expect(getPesticide().create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            registrationNumber: null,
            formulationTypeId: null,
            description: null,
          }),
        })
      )
    })

    it('正常に農薬を作成できる', async () => {
      const createdPesticide = { ...mockPesticide, id: 'new-pesticide-id', name: '新規農薬' }
      getPesticide().create.mockResolvedValue(createdPesticide)
      getHistory().create.mockResolvedValue({ id: 'history-1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await createPesticide(validData)

      expect(result).toMatchObject({ success: true })
      expect(getPesticide().create).toHaveBeenCalled()
    })

    it('作成時に履歴が記録される', async () => {
      const createdPesticide = { ...mockPesticide, id: 'new-pesticide-id' }
      getPesticide().create.mockResolvedValue(createdPesticide)
      getHistory().create.mockResolvedValue({ id: 'history-1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      await createPesticide(validData)

      expect(getHistory().create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pesticideId: 'new-pesticide-id',
            action: 'create',
            performedBy: mockUser.id,
          }),
        })
      )
    })

    it('作成時に監査ログが記録される', async () => {
      const createdPesticide = { ...mockPesticide, id: 'new-pesticide-id' }
      getPesticide().create.mockResolvedValue(createdPesticide)
      getHistory().create.mockResolvedValue({ id: 'history-1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      await createPesticide(validData)

      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adminId: mockUser.id,
            action: 'create_pesticide',
            targetType: 'pesticide',
            targetId: 'new-pesticide-id',
          }),
        })
      )
    })

    it('作成後にrevalidatePathが呼ばれる', async () => {
      getPesticide().create.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      await createPesticide(validData)

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/pesticide-data')
    })

    it('作成後にrevalidatePesticideMasterCache経由でrevalidateTagが呼ばれる（農薬マスタキャッシュ無効化）', async () => {
      getPesticide().create.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { revalidateTag } = await import('next/cache')
      const { CACHE_TAGS } = await import('@/lib/cache')
      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await createPesticide(validData)

      expect(result.success).toBe(true)
      expect(revalidateTag).toHaveBeenCalledWith(CACHE_TAGS.PESTICIDE_MASTER, { expire: 0 })
    })

    it('名前の前後空白がトリムされる', async () => {
      getPesticide().create.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      await createPesticide({ ...validData, name: '  トリムテスト  ' })

      expect(getPesticide().create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'トリムテスト',
          }),
        })
      )
    })
  })

  // ============================================================
  // updatePesticide
  // ============================================================

  describe('updatePesticide', () => {
    const updateData = {
      name: '更新後農薬名',
      description: '更新後の説明',
    }

    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await updatePesticide('pesticide-1', updateData)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await updatePesticide('pesticide-1', updateData)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('農薬が見つからない場合はエラーを返す', async () => {
      getPesticide().findUnique.mockResolvedValue(null)

      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await updatePesticide('nonexistent-id', updateData)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('パスパラメータ id がバリデーション不正なら ERR_INVALID_INPUT を返す', async () => {
      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await updatePesticide('', updateData)
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(getPesticide().findUnique).not.toHaveBeenCalled()
    })

    it('name 以外のバリデーション不正（不正な pesticideType）は ERR_INVALID_INPUT を返す', async () => {
      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await updatePesticide('pesticide-1', { pesticideType: 'not-a-real-type' as never })
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(getPesticide().update).not.toHaveBeenCalled()
    })

    it('name が空白のみの場合は ERR_PESTICIDE_NAME_REQUIRED を返す', async () => {
      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await updatePesticide('pesticide-1', { name: '   ' })
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(getPesticide().update).not.toHaveBeenCalled()
    })

    it('DB エラー時は ERR_OPERATION_FAILED を返す', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getPesticide().update.mockRejectedValue(new Error('DB down'))

      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await updatePesticide('pesticide-1', updateData)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('Error インスタンスでない例外が投げられても ERR_OPERATION_FAILED を返す', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getPesticide().update.mockRejectedValue('string rejection')

      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await updatePesticide('pesticide-1', updateData)
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('pesticideType / formulationTypeId を省略すると更新データに含まれない', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getPesticide().update.mockResolvedValue({ ...mockPesticide, name: '部分更新' })
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      await updatePesticide('pesticide-1', { name: '部分更新' })

      const updateCall = getPesticide().update.mock.calls[0]![0]
      expect(updateCall.data).not.toHaveProperty('pesticideType')
      expect(updateCall.data).not.toHaveProperty('formulationTypeId')
      expect(updateCall.data).toEqual({ name: '部分更新' })
    })

    it('正常に農薬を更新できる', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getPesticide().update.mockResolvedValue({ ...mockPesticide, ...updateData })
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await updatePesticide('pesticide-1', updateData)

      expect(result).toMatchObject({ success: true })
      expect(getPesticide().update).toHaveBeenCalled()
    })

    it('更新時に変更履歴が記録される', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getPesticide().update.mockResolvedValue({ ...mockPesticide, ...updateData })
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      await updatePesticide('pesticide-1', updateData)

      expect(getHistory().create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pesticideId: 'pesticide-1',
            action: 'update',
            performedBy: mockUser.id,
          }),
        })
      )
    })

    it('更新時に監査ログが記録される', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getPesticide().update.mockResolvedValue({ ...mockPesticide, name: '更新後' })
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      await updatePesticide('pesticide-1', { name: '更新後' })

      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adminId: mockUser.id,
            action: 'update_pesticide',
            targetType: 'pesticide',
            targetId: 'pesticide-1',
          }),
        })
      )
    })

    it('更新後にrevalidatePathが呼ばれる', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getPesticide().update.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      await updatePesticide('pesticide-1', updateData)

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/pesticide-data')
    })

    it('更新後にrevalidatePesticideMasterCache経由でrevalidateTagが呼ばれる（農薬マスタキャッシュ無効化）', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getPesticide().update.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { revalidateTag } = await import('next/cache')
      const { CACHE_TAGS } = await import('@/lib/cache')
      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await updatePesticide('pesticide-1', updateData)

      expect(result.success).toBe(true)
      expect(revalidateTag).toHaveBeenCalledWith(CACHE_TAGS.PESTICIDE_MASTER, { expire: 0 })
    })

    it('registrationNumberをnullに設定できる', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getPesticide().update.mockResolvedValue({ ...mockPesticide, registrationNumber: null })
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      await updatePesticide('pesticide-1', { registrationNumber: null })

      expect(getPesticide().update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            registrationNumber: null,
          }),
        })
      )
    })
  })

  // ============================================================
  // deletePesticide
  // ============================================================

  describe('deletePesticide', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await deletePesticide('pesticide-1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await deletePesticide('pesticide-1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('農薬が見つからない場合はエラーを返す', async () => {
      getPesticide().findUnique.mockResolvedValue(null)

      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await deletePesticide('nonexistent-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('正常に農薬を削除できる', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })

      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await deletePesticide('pesticide-1')

      expect(result).toMatchObject({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
    })

    it('DB エラー時は ERR_OPERATION_FAILED を返す', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockTransaction.mockRejectedValueOnce(new Error('DB down'))

      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await deletePesticide('pesticide-1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('Error インスタンスでない例外が投げられても ERR_OPERATION_FAILED を返す', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockTransaction.mockRejectedValueOnce('string rejection')

      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await deletePesticide('pesticide-1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('id が空文字（バリデーション不正）なら ERR_INVALID_INPUT を返す', async () => {
      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await deletePesticide('')
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(getPesticide().findUnique).not.toHaveBeenCalled()
    })

    it('削除前に履歴が記録される', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })

      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      await deletePesticide('pesticide-1')

      expect(getHistory().create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pesticideId: 'pesticide-1',
            action: 'delete',
            performedBy: mockUser.id,
          }),
        })
      )
    })

    it('削除時にトランザクションで実行される', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })

      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      await deletePesticide('pesticide-1')

      // $transaction が配列で呼ばれる（delete + adminLog.create）
      expect(mockTransaction).toHaveBeenCalledTimes(1)
    })

    it('削除後にrevalidatePathが呼ばれる', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })

      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      await deletePesticide('pesticide-1')

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/pesticide-data')
    })

    it('削除後にrevalidatePesticideMasterCache経由でrevalidateTagが呼ばれる（農薬マスタキャッシュ無効化）', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })

      const { revalidateTag } = await import('next/cache')
      const { CACHE_TAGS } = await import('@/lib/cache')
      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await deletePesticide('pesticide-1')

      expect(result.success).toBe(true)
      expect(revalidateTag).toHaveBeenCalledWith(CACHE_TAGS.PESTICIDE_MASTER, { expire: 0 })
    })
  })

  // ============================================================
  // getPesticideHistory
  // ============================================================

  describe('getPesticideHistory', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getPesticideHistory } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getPesticideHistory()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getPesticideHistory } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getPesticideHistory()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('オプションなしで全件取得する', async () => {
      getHistory().findMany.mockResolvedValue([])
      getHistory().count.mockResolvedValue(0)

      const { getPesticideHistory } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getPesticideHistory()

      if ('error' in result) throw new Error('Expected history, got error')
      expect(result.history).toEqual([])
      expect(result.total).toBe(0)
    })

    it('DB エラー時は ERR_OPERATION_FAILED を返す', async () => {
      getHistory().findMany.mockRejectedValue(new Error('DB down'))
      getHistory().count.mockResolvedValue(0)

      const { getPesticideHistory } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getPesticideHistory()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('Error インスタンスでない例外が投げられても ERR_OPERATION_FAILED を返す', async () => {
      getHistory().findMany.mockRejectedValue('string rejection')
      getHistory().count.mockResolvedValue(0)

      const { getPesticideHistory } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getPesticideHistory()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('options が不正（limit が上限超過）なら ERR_INVALID_INPUT を返す', async () => {
      const { getPesticideHistory } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getPesticideHistory({ limit: 100000 })
      expect(result).toMatchObject({ error: expect.any(String) })
      expect(getHistory().findMany).not.toHaveBeenCalled()
    })

    it('取得件数が limit と一致する場合は nextCursor が設定される', async () => {
      const mockHistoryList = [
        { id: 'h1', pesticideId: 'p1', action: 'create', createdAt: new Date() },
        { id: 'h2', pesticideId: 'p1', action: 'update', createdAt: new Date() },
      ]
      getHistory().findMany.mockResolvedValue(mockHistoryList)
      getHistory().count.mockResolvedValue(10)

      const { getPesticideHistory } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getPesticideHistory({ limit: 2 })

      if ('error' in result) throw new Error('Expected history, got error')
      expect(result.nextCursor).toBe('h2')
    })

    it('履歴一覧と総件数を正常に返す', async () => {
      const mockHistoryList = [
        { id: 'h1', pesticideId: 'p1', action: 'create', createdAt: new Date() },
        { id: 'h2', pesticideId: 'p1', action: 'update', createdAt: new Date() },
      ]
      getHistory().findMany.mockResolvedValue(mockHistoryList)
      getHistory().count.mockResolvedValue(2)

      const { getPesticideHistory } = await import('@/lib/actions/admin/pesticide-data')
      const result = await getPesticideHistory()

      if ('error' in result) throw new Error('Expected history, got error')
      expect(result.history).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('pesticideIdフィルタが適用される', async () => {
      getHistory().findMany.mockResolvedValue([])
      getHistory().count.mockResolvedValue(0)

      const { getPesticideHistory } = await import('@/lib/actions/admin/pesticide-data')
      await getPesticideHistory({ pesticideId: 'pesticide-1' })

      expect(getHistory().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pesticideId: 'pesticide-1',
          }),
        })
      )
    })

    it('cursor ページネーションが適用される', async () => {
      getHistory().findMany.mockResolvedValue([])
      getHistory().count.mockResolvedValue(100)

      const { getPesticideHistory } = await import('@/lib/actions/admin/pesticide-data')
      await getPesticideHistory({ limit: 5, cursor: 'hist-cursor' })

      expect(getHistory().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          cursor: { id: 'hist-cursor' },
          skip: 1,
        })
      )
    })

    it('デフォルトでは limit=20、cursor/skip なし（createdAt + id の複合キーで並べる）', async () => {
      getHistory().findMany.mockResolvedValue([])
      getHistory().count.mockResolvedValue(0)

      const { getPesticideHistory } = await import('@/lib/actions/admin/pesticide-data')
      await getPesticideHistory()

      const call = getHistory().findMany.mock.calls[0]![0]
      expect(call.take).toBe(20)
      expect(call.cursor).toBeUndefined()
      expect(call.skip).toBeUndefined()
      expect(call.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }])
    })

    it('pesticideIdなしではwhereが空オブジェクトになる', async () => {
      getHistory().findMany.mockResolvedValue([])
      getHistory().count.mockResolvedValue(0)

      const { getPesticideHistory } = await import('@/lib/actions/admin/pesticide-data')
      await getPesticideHistory()

      expect(getHistory().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      )
    })
  })

  // ============================================================
  // 品質向上テスト: 履歴記録の正確性・カスケード・エッジケース
  // ============================================================

  describe('createPesticide - 履歴記録の正確性', () => {
    const validData = {
      name: '履歴テスト農薬',
      registrationNumber: 'REG-HIST',
      pesticideType: 'insecticide' as never,
      formulationTypeId: 'form-1',
      description: '履歴テスト用',
      slug: 'history-test',
    }

    it('作成履歴のactionが"create"でafter dataにフル入力データが含まれる', async () => {
      const createdPesticide = { ...mockPesticide, id: 'new-id' }
      getPesticide().create.mockResolvedValue(createdPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      await createPesticide(validData)

      const historyCall = getHistory().create.mock.calls[0]![0]
      expect(historyCall.data.action).toBe('create')
      expect(historyCall.data.changes).toEqual(
        expect.objectContaining({
          after: expect.objectContaining({
            name: '履歴テスト農薬',
            registrationNumber: 'REG-HIST',
            pesticideType: 'insecticide',
            slug: 'history-test',
          }),
        })
      )
    })

    it('作成履歴のperformedByが管理者ユーザーIDと一致する', async () => {
      getPesticide().create.mockResolvedValue({ ...mockPesticide, id: 'new-id' })
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { createPesticide } = await import('@/lib/actions/admin/pesticide-data')
      await createPesticide(validData)

      const historyCall = getHistory().create.mock.calls[0]![0]
      expect(historyCall.data.performedBy).toBe(mockUser.id)
      expect(historyCall.data.pesticideId).toBe('new-id')
    })
  })

  describe('updatePesticide - 履歴のbefore/after差分', () => {
    it('更新履歴にbeforeとafterの差分が正しく記録される', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getPesticide().update.mockResolvedValue({ ...mockPesticide, name: '更新後名' })
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      await updatePesticide('pesticide-1', { name: '更新後名', description: '新しい説明' })

      const historyCall = getHistory().create.mock.calls[0]![0]
      expect(historyCall.data.action).toBe('update')
      expect(historyCall.data.changes.before).toEqual(
        expect.objectContaining({
          name: mockPesticide.name,
          registrationNumber: mockPesticide.registrationNumber,
          pesticideType: mockPesticide.pesticideType,
          description: mockPesticide.description,
        })
      )
      expect(historyCall.data.changes.after).toEqual(
        expect.objectContaining({
          name: '更新後名',
          description: '新しい説明',
        })
      )
    })

    it('registrationNumberがnullの農薬を更新すると、beforeにnullが記録される', async () => {
      const pesticideNoReg = { ...mockPesticide, registrationNumber: null }
      getPesticide().findUnique.mockResolvedValue(pesticideNoReg)
      getPesticide().update.mockResolvedValue({ ...pesticideNoReg, name: '更新後' })
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      await updatePesticide('pesticide-1', { name: '更新後' })

      const historyCall = getHistory().create.mock.calls[0]![0]
      expect(historyCall.data.changes.before.registrationNumber).toBeNull()
    })

    it('descriptionが空文字の場合でもエラーにならず更新される', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getPesticide().update.mockResolvedValue({ ...mockPesticide, description: '' })
      getHistory().create.mockResolvedValue({ id: 'h1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'l1' })

      const { updatePesticide } = await import('@/lib/actions/admin/pesticide-data')
      const result = await updatePesticide('pesticide-1', { description: '' })

      expect(result).toMatchObject({ success: true })
      expect(getPesticide().update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: '',
          }),
        })
      )
    })
  })

  describe('deletePesticide - 履歴記録とカスケード検証', () => {
    it('削除履歴にaction="delete"とbefore dataが含まれる', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })

      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      await deletePesticide('pesticide-1')

      const historyCall = getHistory().create.mock.calls[0]![0]
      expect(historyCall.data.action).toBe('delete')
      expect(historyCall.data.changes).toEqual(
        expect.objectContaining({
          before: expect.objectContaining({
            name: mockPesticide.name,
            registrationNumber: mockPesticide.registrationNumber,
            pesticideType: mockPesticide.pesticideType,
          }),
        })
      )
    })

    it('トランザクション内でpesticide.deleteとadminLog.createが実行される', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })

      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      await deletePesticide('pesticide-1')

      // mockTransactionが呼ばれ、中で配列が渡される
      expect(mockTransaction).toHaveBeenCalledTimes(1)
      // pesticide.deleteが呼ばれている
      expect(getPesticide().delete).toHaveBeenCalledWith({ where: { id: 'pesticide-1' } })
      // adminLog.createも呼ばれている
      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'delete_pesticide',
            targetId: 'pesticide-1',
          }),
        })
      )
    })

    it('削除履歴はトランザクション外で先に記録される', async () => {
      const callOrder: string[] = []
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getHistory().create.mockImplementation(() => {
        callOrder.push('history')
        return Promise.resolve({ id: 'h1' })
      })
      mockTransaction.mockImplementation((ops: unknown) => {
        callOrder.push('transaction')
        if (typeof ops === 'function') {
          return (ops as (...args: unknown[]) => unknown)(mockPrisma)
        }
        return Promise.all(ops as Promise<unknown>[])
      })

      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      await deletePesticide('pesticide-1')

      // 履歴記録がトランザクションより先に実行される
      expect(callOrder.indexOf('history')).toBeLessThan(callOrder.indexOf('transaction'))
    })

    it('削除履歴のperformedByが管理者ユーザーIDと一致する', async () => {
      getPesticide().findUnique.mockResolvedValue(mockPesticide)
      getHistory().create.mockResolvedValue({ id: 'h1' })

      const { deletePesticide } = await import('@/lib/actions/admin/pesticide-data')
      await deletePesticide('pesticide-1')

      const historyCall = getHistory().create.mock.calls[0]![0]
      expect(historyCall.data.performedBy).toBe(mockUser.id)
      expect(historyCall.data.pesticideId).toBe('pesticide-1')
    })
  })
})
