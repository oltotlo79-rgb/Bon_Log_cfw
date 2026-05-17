// @vitest-environment node
import { vi } from 'vitest'

import { createMockPrismaClient, mockUser, mockBonsai, mockBonsaiRecord } from '../../utils/test-utils'

// Prismaモック
 
const mockPrisma = createMockPrismaClient() as any
mockPrisma.bonsaiRecordImage = {
  deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  findMany: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({}),
}
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// revalidatePathモック
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

// ロガーモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// レート制限モック
const mockRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { limit: 20, window: 60 } },
}))

// headersモック
const mockHeadersGet = vi.fn()
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockHeadersGet(...args),
  }),
}))

/** ActionResult 成功レスポンスから data 部を取り出す（型安全） */
function unwrapOk<T>(result: { success: true; data?: T } | { success: false; error: string }): T {
  if (!result.success) throw new Error(`Expected success, got error: ${result.error}`)
  if (!result.data) throw new Error('Expected data to be defined')
  return result.data
}

describe('Bonsai Actions - Extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockRateLimit.mockResolvedValue({ success: true })
    mockHeadersGet.mockReturnValue('127.0.0.1')
  })

  // ============================================================
  // getBonsais - 追加テスト
  // ============================================================

  describe('getBonsais - extended', async () => {
    it('セッションのユーザーIDを使う（userId未指定時）', async () => {
      mockPrisma.bonsai.findMany.mockResolvedValue([])

      const { getBonsais } = await import('@/lib/actions/bonsai')
      await getBonsais()

      expect(mockPrisma.bonsai.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id },
        })
      )
    })

    it('指定ユーザーIDで未認証でも盆栽一覧を取得できる', async () => {
      mockAuth.mockResolvedValue(null)
      mockPrisma.bonsai.findMany.mockResolvedValue([])

      const { getBonsais } = await import('@/lib/actions/bonsai')
      const result = await getBonsais('other-user-id')

      const data = unwrapOk<{ bonsais: unknown[] }>(result)
      expect(data.bonsais).toBeDefined()
      expect(mockPrisma.bonsai.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'other-user-id' },
        })
      )
    })
  })

  // ============================================================
  // updateBonsai - 追加テスト
  // ============================================================

  describe('updateBonsai - extended', async () => {
    it('更新に失敗した場合、エラーを返す', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValue(mockBonsai)
      mockPrisma.bonsai.update.mockRejectedValue(new Error('Database error'))

      const { updateBonsai } = await import('@/lib/actions/bonsai')
      const result = await updateBonsai(mockBonsai.id, { name: '更新' })

      expect(result).toMatchObject({ error: '盆栽の更新に失敗しました' })
    })

    it('acquiredAtをnullに設定できる', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValue(mockBonsai)
      mockPrisma.bonsai.update.mockResolvedValue({ ...mockBonsai, acquiredAt: null })

      const { updateBonsai } = await import('@/lib/actions/bonsai')
      const result = await updateBonsai(mockBonsai.id, { acquiredAt: null })

      const data = unwrapOk<{ bonsai: typeof mockBonsai }>(result)
      expect(data.bonsai).toBeDefined()
      expect(mockPrisma.bonsai.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acquiredAt: null }),
        })
      )
    })
  })

  // ============================================================
  // deleteBonsai - 追加テスト
  // ============================================================

  describe('deleteBonsai - extended', async () => {
    it('削除に失敗した場合、エラーを返す', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValue(mockBonsai)
      mockPrisma.bonsai.delete.mockRejectedValue(new Error('Database error'))

      const { deleteBonsai } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsai(mockBonsai.id)

      expect(result).toMatchObject({ error: '盆栽の削除に失敗しました' })
    })
  })

  // ============================================================
  // addBonsaiRecord - 追加テスト
  // ============================================================

  describe('addBonsaiRecord - extended', async () => {
    it('recordAtを指定しない場合はデフォルト値が使われる', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValue(mockBonsai)
      mockPrisma.bonsaiRecord.create.mockResolvedValue({
        ...mockBonsaiRecord,
        images: [],
      })

      const { addBonsaiRecord } = await import('@/lib/actions/bonsai')
      await addBonsaiRecord({
        bonsaiId: mockBonsai.id,
        content: 'テスト',
      })

      expect(mockPrisma.bonsaiRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recordAt: expect.any(Date),
          }),
        })
      )
    })

    it('追加に失敗した場合、エラーを返す', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValue(mockBonsai)
      mockPrisma.bonsaiRecord.create.mockRejectedValue(new Error('Database error'))

      const { addBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await addBonsaiRecord({
        bonsaiId: mockBonsai.id,
        content: 'テスト',
      })

      expect(result).toMatchObject({ error: '成長記録の追加に失敗しました' })
    })

    it('空のimageUrlsでは画像が作成されない', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValue(mockBonsai)
      mockPrisma.bonsaiRecord.create.mockResolvedValue({
        ...mockBonsaiRecord,
        images: [],
      })

      const { addBonsaiRecord } = await import('@/lib/actions/bonsai')
      await addBonsaiRecord({
        bonsaiId: mockBonsai.id,
        content: 'テスト',
        imageUrls: [],
      })

      expect(mockPrisma.bonsaiRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            images: undefined,
          }),
        })
      )
    })
  })

  // ============================================================
  // updateBonsaiRecord - 追加テスト
  // ============================================================

  describe('updateBonsaiRecord - extended', async () => {
    it('他人の盆栽の記録は更新できない', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        ...mockBonsaiRecord,
        bonsai: { userId: 'other-user-id' },
      })

      const { updateBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await updateBonsaiRecord(mockBonsaiRecord.id, { content: '更新' })

      expect(result).toMatchObject({ error: '成長記録が見つかりません' })
    })

    it('imageUrlsを指定すると既存画像が削除される', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        ...mockBonsaiRecord,
        bonsai: { userId: mockUser.id },
        bonsaiId: mockBonsai.id,
      })
      mockPrisma.bonsaiRecordImage.deleteMany.mockResolvedValue({ count: 2 })
      mockPrisma.bonsaiRecord.update.mockResolvedValue({
        ...mockBonsaiRecord,
        images: [{ url: '/new.jpg', sortOrder: 0 }],
      })

      const { updateBonsaiRecord } = await import('@/lib/actions/bonsai')
      await updateBonsaiRecord(mockBonsaiRecord.id, {
        imageUrls: ['/new.jpg'],
      })

      expect(mockPrisma.bonsaiRecordImage.deleteMany).toHaveBeenCalledWith({
        where: { recordId: mockBonsaiRecord.id },
      })
    })

    it('imageUrlsがundefinedの場合は既存画像を削除しない', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        ...mockBonsaiRecord,
        bonsai: { userId: mockUser.id },
        bonsaiId: mockBonsai.id,
      })
      mockPrisma.bonsaiRecord.update.mockResolvedValue({
        ...mockBonsaiRecord,
        content: '更新',
        images: [],
      })

      const { updateBonsaiRecord } = await import('@/lib/actions/bonsai')
      await updateBonsaiRecord(mockBonsaiRecord.id, { content: '更新' })

      expect(mockPrisma.bonsaiRecordImage.deleteMany).not.toHaveBeenCalled()
    })

    it('更新に失敗した場合、エラーを返す', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        ...mockBonsaiRecord,
        bonsai: { userId: mockUser.id },
        bonsaiId: mockBonsai.id,
      })
      mockPrisma.bonsaiRecord.update.mockRejectedValue(new Error('Database error'))

      const { updateBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await updateBonsaiRecord(mockBonsaiRecord.id, { content: '更新' })

      expect(result).toMatchObject({ error: '成長記録の更新に失敗しました' })
    })

    it('空のimageUrlsでは既存画像を削除するが新しい画像は作成しない', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        ...mockBonsaiRecord,
        bonsai: { userId: mockUser.id },
        bonsaiId: mockBonsai.id,
      })
      mockPrisma.bonsaiRecordImage.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.bonsaiRecord.update.mockResolvedValue({
        ...mockBonsaiRecord,
        images: [],
      })

      const { updateBonsaiRecord } = await import('@/lib/actions/bonsai')
      await updateBonsaiRecord(mockBonsaiRecord.id, { imageUrls: [] })

      expect(mockPrisma.bonsaiRecordImage.deleteMany).toHaveBeenCalled()
      expect(mockPrisma.bonsaiRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            images: undefined,
          }),
        })
      )
    })
  })

  // ============================================================
  // deleteBonsaiRecord - 追加テスト
  // ============================================================

  describe('deleteBonsaiRecord - extended', async () => {
    it('他人の盆栽の記録は削除できない', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        ...mockBonsaiRecord,
        bonsai: { userId: 'other-user-id' },
      })

      const { deleteBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsaiRecord(mockBonsaiRecord.id)

      expect(result).toMatchObject({ error: '成長記録が見つかりません' })
    })

    it('削除に失敗した場合、エラーを返す', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        ...mockBonsaiRecord,
        bonsai: { userId: mockUser.id },
        bonsaiId: mockBonsai.id,
      })
      mockPrisma.bonsaiRecord.delete.mockRejectedValue(new Error('Database error'))

      const { deleteBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsaiRecord(mockBonsaiRecord.id)

      expect(result).toMatchObject({ error: '成長記録の削除に失敗しました' })
    })
  })

  // ============================================================
  // getBonsaiTimeline - 追加テスト
  // ============================================================

  describe('getBonsaiTimeline - extended', async () => {
    it('カーソル付きでページネーションが動作する', async () => {
      mockPrisma.bonsaiRecord.findMany.mockResolvedValue([])

      const { getBonsaiTimeline } = await import('@/lib/actions/bonsai')
      await getBonsaiTimeline({ cursor: 'cursor-1', limit: 10 })

      expect(mockPrisma.bonsaiRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-1' },
          skip: 1,
        })
      )
    })

    it('limit件返却時にnextCursorが設定される', async () => {
      const records = Array(20).fill(null).map((_, i) => ({
        ...mockBonsaiRecord,
        id: `record-${i}`,
        bonsai: { ...mockBonsai, user: { id: mockUser.id, nickname: 'test', avatarUrl: null } },
        images: [],
      }))
      mockPrisma.bonsaiRecord.findMany.mockResolvedValue(records)

      const { getBonsaiTimeline } = await import('@/lib/actions/bonsai')
      const result = await getBonsaiTimeline({ limit: 20 })

      const data = unwrapOk<{ records: unknown[]; nextCursor?: string }>(result)
      expect(data.nextCursor).toBe('record-19')
    })

    it('limit未満ではnextCursorがundefined', async () => {
      mockPrisma.bonsaiRecord.findMany.mockResolvedValue([
        { ...mockBonsaiRecord, id: 'r1', bonsai: { ...mockBonsai }, images: [] },
      ])

      const { getBonsaiTimeline } = await import('@/lib/actions/bonsai')
      const result = await getBonsaiTimeline({ limit: 20 })

      const data = unwrapOk<{ records: unknown[]; nextCursor?: string }>(result)
      expect(data.nextCursor).toBeUndefined()
    })
  })

  // ============================================================
  // getBonsaiRecords - 追加テスト
  // ============================================================

  describe('getBonsaiRecords - extended', async () => {
    it('カーソル付きでページネーションが動作する', async () => {
      mockPrisma.bonsaiRecord.findMany.mockResolvedValue([])

      const { getBonsaiRecords } = await import('@/lib/actions/bonsai')
      await getBonsaiRecords(mockBonsai.id, { cursor: 'cursor-1', limit: 5 })

      expect(mockPrisma.bonsaiRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bonsaiId: mockBonsai.id },
          take: 5,
          cursor: { id: 'cursor-1' },
          skip: 1,
        })
      )
    })

    it('limit件返却時にnextCursorが設定される', async () => {
      const records = Array(10).fill(null).map((_, i) => ({
        ...mockBonsaiRecord,
        id: `record-${i}`,
        images: [],
      }))
      mockPrisma.bonsaiRecord.findMany.mockResolvedValue(records)

      const { getBonsaiRecords } = await import('@/lib/actions/bonsai')
      const result = await getBonsaiRecords(mockBonsai.id, { limit: 10 })

      const data = unwrapOk<{ records: unknown[]; nextCursor?: string }>(result)
      expect(data.nextCursor).toBe('record-9')
    })
  })

  // ============================================================
  // searchBonsais - 追加テスト
  // ============================================================

  describe('searchBonsais - extended', async () => {
    it('空のクエリでは全件返す（getBonsaisを呼ぶ）', async () => {
      mockPrisma.bonsai.findMany.mockResolvedValue([
        { ...mockBonsai, records: [], _count: { records: 0 } },
      ])

      const { searchBonsais } = await import('@/lib/actions/bonsai')
      const result = await searchBonsais('   ')

      const data = unwrapOk<{ bonsais: unknown[] }>(result)
      expect(data.bonsais).toBeDefined()
    })

    it('レート制限に達した場合はエラーを返す', async () => {
      mockRateLimit.mockResolvedValueOnce({ success: false })

      const { searchBonsais } = await import('@/lib/actions/bonsai')
      const result = await searchBonsais('テスト')

      // ActionResult エラー形式
      expect(result).toMatchObject({
        success: false,
        error: '検索リクエストが多すぎます。しばらく待ってから再試行してください',
      })
    })

    it('検索に失敗した場合、エラーを返す', async () => {
      mockPrisma.bonsai.findMany.mockRejectedValue(new Error('Database error'))

      const { searchBonsais } = await import('@/lib/actions/bonsai')
      const result = await searchBonsais('テスト')

      expect(result).toMatchObject({ error: '盆栽の検索に失敗しました' })
    })

    it('IPヘッダーからIPを取得してレート制限に使用する', async () => {
      mockHeadersGet.mockImplementation((name: string) => {
        if (name === 'cf-connecting-ip') return '192.168.1.1'
        return null
      })
      mockPrisma.bonsai.findMany.mockResolvedValue([])

      const { searchBonsais } = await import('@/lib/actions/bonsai')
      await searchBonsais('テスト')

      expect(mockRateLimit).toHaveBeenCalledWith(
        'search:bonsai:192.168.1.1',
        expect.any(Object)
      )
    })
  })

  // ============================================================
  // createBonsai - 追加テスト
  // ============================================================

  describe('createBonsai - extended', async () => {
    it('オプションフィールドなしで作成できる', async () => {
      mockPrisma.bonsai.create.mockResolvedValue({ ...mockBonsai, species: undefined, description: undefined })

      const { createBonsai } = await import('@/lib/actions/bonsai')
      const result = await createBonsai({ name: '黒松' })

      const data = unwrapOk<{ bonsai: typeof mockBonsai }>(result)
      expect(data.bonsai).toBeDefined()
      expect(mockPrisma.bonsai.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: '黒松',
          species: undefined,
          description: undefined,
        }),
      })
    })

    it('acquiredAt付きで作成できる', async () => {
      const date = new Date('2023-05-01')
      mockPrisma.bonsai.create.mockResolvedValue({ ...mockBonsai, acquiredAt: date })

      const { createBonsai } = await import('@/lib/actions/bonsai')
      const result = await createBonsai({ name: '黒松', acquiredAt: date })

      const data = unwrapOk<{ bonsai: typeof mockBonsai }>(result)
      expect(data.bonsai).toBeDefined()
      expect(mockPrisma.bonsai.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          acquiredAt: date,
        }),
      })
    })
  })
})
