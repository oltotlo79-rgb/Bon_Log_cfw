// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockRequireAuth = vi.fn()
const mockRequireActiveUser = vi.fn()
const mockRequireActiveNonGuestUser = vi.fn()
vi.mock('@/lib/actions/utils', async () => {
  const actual = await vi.importActual('@/lib/actions/utils')
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
    requireActiveUser: (...args: unknown[]) => mockRequireActiveUser(...args),
    requireActiveNonGuestUser: (...args: unknown[]) => mockRequireActiveNonGuestUser(...args),
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { maxRequests: 30, windowMs: 60000 } },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}))

vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}))


import {
  ERR_BONSAI_NOT_FOUND,
  ERR_BONSAI_RECORD_NOT_FOUND,
  ERR_BONSAI_RECORD_CREATE_FAILED,
  ERR_BONSAI_RECORD_UPDATE_FAILED,
  ERR_BONSAI_RECORD_DELETE_FAILED,
  ERR_INVALID_INPUT,
  ERR_RATE_LIMIT_OPERATION,
} from '@/lib/constants/errors'

describe('bonsai-record actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // addBonsaiRecord
  // ============================================================
  describe('addBonsaiRecord', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/bonsai-record')
      return mod.addBonsaiRecord
    }

    it('未認証の場合エラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })
      const addBonsaiRecord = await importAction()

      const result = await addBonsaiRecord({ bonsaiId: 'b1' })
      expect(result).toMatchObject({ success: false })
    })

    it('盆栽が見つからない場合エラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsai.findFirst.mockResolvedValue(null)
      const addBonsaiRecord = await importAction()

      const result = await addBonsaiRecord({ bonsaiId: 'nonexistent' })
      expect(result).toMatchObject({ success: false, error: ERR_BONSAI_NOT_FOUND })
    })

    it('成長記録を正常に追加できる', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsai.findFirst.mockResolvedValue({ id: 'b1', userId: 'user-1' })
      const mockRecord = { id: 'rec-1', bonsaiId: 'b1', content: 'テスト記録', images: [] }
      mockPrisma.bonsaiRecord.create.mockResolvedValue(mockRecord)
      const addBonsaiRecord = await importAction()

      const result = await addBonsaiRecord({
        bonsaiId: 'b1',
        content: 'テスト記録',
        imageUrls: [],
      })
      expect(result).toMatchObject({ success: true, data: { record: mockRecord } })
    })

    it('画像付きで記録を追加できる', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsai.findFirst.mockResolvedValue({ id: 'b1', userId: 'user-1' })
      const mockRecord = {
        id: 'rec-2',
        bonsaiId: 'b1',
        images: [{ url: '/img1.jpg', sortOrder: 0 }, { url: '/img2.jpg', sortOrder: 1 }],
      }
      mockPrisma.bonsaiRecord.create.mockResolvedValue(mockRecord)
      const addBonsaiRecord = await importAction()

      const result = await addBonsaiRecord({
        bonsaiId: 'b1',
        content: '植え替え',
        imageUrls: ['/img1.jpg', '/img2.jpg'],
      })
      expect(result).toMatchObject({ success: true, data: { record: mockRecord } })
      expect(mockPrisma.bonsaiRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bonsaiId: 'b1',
            content: '植え替え',
            images: {
              create: [
                { url: '/img1.jpg', sortOrder: 0 },
                { url: '/img2.jpg', sortOrder: 1 },
              ],
            },
          }),
        })
      )
    })

    it('DB例外時にエラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsai.findFirst.mockResolvedValue({ id: 'b1', userId: 'user-1' })
      mockPrisma.bonsaiRecord.create.mockRejectedValue(new Error('DB error'))
      const addBonsaiRecord = await importAction()

      const result = await addBonsaiRecord({ bonsaiId: 'b1', content: 'test' })
      expect(result).toMatchObject({ success: false, error: ERR_BONSAI_RECORD_CREATE_FAILED })
    })
  })

  // ============================================================
  // updateBonsaiRecord
  // ============================================================
  describe('updateBonsaiRecord', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/bonsai-record')
      return mod.updateBonsaiRecord
    }

    it('未認証の場合エラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })
      const updateBonsaiRecord = await importAction()

      const result = await updateBonsaiRecord('rec-1', { content: 'updated' })
      expect(result).toMatchObject({ success: false })
    })

    it('記録が見つからない場合エラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue(null)
      const updateBonsaiRecord = await importAction()

      const result = await updateBonsaiRecord('nonexistent', { content: 'x' })
      expect(result).toMatchObject({ success: false, error: ERR_BONSAI_RECORD_NOT_FOUND })
    })

    it('他ユーザーの記録は更新できない', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        bonsai: { userId: 'other-user' },
      })
      const updateBonsaiRecord = await importAction()

      const result = await updateBonsaiRecord('rec-1', { content: 'x' })
      expect(result).toMatchObject({ success: false, error: ERR_BONSAI_RECORD_NOT_FOUND })
    })

    it('画像URLが指定された場合、既存画像を削除する', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        bonsaiId: 'b1',
        bonsai: { userId: 'user-1' },
      })
      mockPrisma.bonsaiRecord.update.mockResolvedValue({
        id: 'rec-1',
        images: [{ url: '/new.jpg', sortOrder: 0 }],
      })
      const updateBonsaiRecord = await importAction()

      await updateBonsaiRecord('rec-1', { imageUrls: ['/new.jpg'] })
      expect(mockPrisma.bonsaiRecordImage.deleteMany).toHaveBeenCalledWith({
        where: { recordId: 'rec-1' },
      })
    })

    it('正常に更新できる', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        bonsaiId: 'b1',
        bonsai: { userId: 'user-1' },
      })
      const updatedRecord = { id: 'rec-1', content: '更新後', images: [] }
      mockPrisma.bonsaiRecord.update.mockResolvedValue(updatedRecord)
      const updateBonsaiRecord = await importAction()

      const result = await updateBonsaiRecord('rec-1', { content: '更新後' })
      expect(result).toMatchObject({ success: true, data: { record: updatedRecord } })
    })

    it('DB例外時にエラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        bonsaiId: 'b1',
        bonsai: { userId: 'user-1' },
      })
      mockPrisma.bonsaiRecord.update.mockRejectedValue(new Error('DB error'))
      const updateBonsaiRecord = await importAction()

      const result = await updateBonsaiRecord('rec-1', { content: 'x' })
      expect(result).toMatchObject({ success: false, error: ERR_BONSAI_RECORD_UPDATE_FAILED })
    })
  })

  // ============================================================
  // deleteBonsaiRecord
  // ============================================================
  describe('deleteBonsaiRecord', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/bonsai-record')
      return mod.deleteBonsaiRecord
    }

    it('未認証の場合エラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })
      const deleteBonsaiRecord = await importAction()

      const result = await deleteBonsaiRecord('rec-1')
      expect(result).toMatchObject({ success: false })
    })

    it('記録が見つからない場合エラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue(null)
      const deleteBonsaiRecord = await importAction()

      const result = await deleteBonsaiRecord('nonexistent')
      expect(result).toMatchObject({ success: false, error: ERR_BONSAI_RECORD_NOT_FOUND })
    })

    it('他ユーザーの記録は削除できない', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        bonsai: { userId: 'other-user' },
      })
      const deleteBonsaiRecord = await importAction()

      const result = await deleteBonsaiRecord('rec-1')
      expect(result).toMatchObject({ success: false, error: ERR_BONSAI_RECORD_NOT_FOUND })
    })

    it('正常に削除できる', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        bonsaiId: 'b1',
        bonsai: { userId: 'user-1' },
      })
      mockPrisma.bonsaiRecord.delete.mockResolvedValue({})
      const deleteBonsaiRecord = await importAction()

      const result = await deleteBonsaiRecord('rec-1')
      expect(result).toMatchObject({ success: true })
    })

    it('DB例外時にエラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        bonsaiId: 'b1',
        bonsai: { userId: 'user-1' },
      })
      mockPrisma.bonsaiRecord.delete.mockRejectedValue(new Error('DB error'))
      const deleteBonsaiRecord = await importAction()

      const result = await deleteBonsaiRecord('rec-1')
      expect(result).toMatchObject({ success: false, error: ERR_BONSAI_RECORD_DELETE_FAILED })
    })
  })

  // ============================================================
  // getBonsaiTimeline
  // ============================================================
  describe('getBonsaiTimeline', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/bonsai-record')
      return mod.getBonsaiTimeline
    }

    /** ActionResult 成功レスポンスから data 部を取り出す（型安全） */
    function unwrap<T>(result: { success: true; data?: T } | { success: false; error: string }): T {
      if (!result.success) throw new Error(`Expected success, got error: ${result.error}`)
      if (!result.data) throw new Error('Expected data to be defined')
      return result.data
    }

    it('記録一覧を取得できる', async () => {
      const records = [
        { id: 'rec-1', recordAt: new Date(), bonsai: { user: { id: 'u1' } }, images: [] },
        { id: 'rec-2', recordAt: new Date(), bonsai: { user: { id: 'u2' } }, images: [] },
      ]
      mockPrisma.bonsaiRecord.findMany.mockResolvedValue(records)
      const getBonsaiTimeline = await importAction()

      const result = await getBonsaiTimeline({ limit: 20 })
      const data = unwrap<{ records: typeof records; nextCursor?: string }>(result)
      expect(data.records).toHaveLength(2)
    })

    it('limit件取得時に nextCursor を返す', async () => {
      const records = Array.from({ length: 20 }, (_, i) => ({
        id: `rec-${i}`,
        recordAt: new Date(),
      }))
      mockPrisma.bonsaiRecord.findMany.mockResolvedValue(records)
      const getBonsaiTimeline = await importAction()

      const result = await getBonsaiTimeline({ limit: 20 })
      const data = unwrap<{ records: typeof records; nextCursor?: string }>(result)
      expect(data.nextCursor).toBe('rec-19')
    })

    it('limit未満の場合 nextCursor は undefined', async () => {
      mockPrisma.bonsaiRecord.findMany.mockResolvedValue([{ id: 'rec-1' }])
      const getBonsaiTimeline = await importAction()

      const result = await getBonsaiTimeline({ limit: 20 })
      const data = unwrap<{ records: { id: string }[]; nextCursor?: string }>(result)
      expect(data.nextCursor).toBeUndefined()
    })

    it('cursor 指定時に skip:1 で取得する', async () => {
      mockPrisma.bonsaiRecord.findMany.mockResolvedValue([])
      const getBonsaiTimeline = await importAction()

      await getBonsaiTimeline({ cursor: 'rec-5', limit: 10 })
      expect(mockPrisma.bonsaiRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'rec-5' },
          skip: 1,
          take: 10,
        })
      )
    })

    it('DB例外時に空配列を返す', async () => {
      mockPrisma.bonsaiRecord.findMany.mockRejectedValue(new Error('DB error'))
      const getBonsaiTimeline = await importAction()

      const result = await getBonsaiTimeline()
      // 例外時もユーザー UX を壊さないため空配列を ActionResult で返却する
      expect(result).toEqual({ success: true, data: { records: [], nextCursor: undefined } })
    })
  })

  // ============================================================
  // getBonsaiRecords
  // ============================================================
  describe('getBonsaiRecords', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/bonsai-record')
      return mod.getBonsaiRecords
    }

    /** ActionResult 成功レスポンスから data 部を取り出す（型安全） */
    function unwrap<T>(result: { success: true; data?: T } | { success: false; error: string }): T {
      if (!result.success) throw new Error(`Expected success, got error: ${result.error}`)
      if (!result.data) throw new Error('Expected data to be defined')
      return result.data
    }

    it('指定盆栽の記録一覧を取得できる', async () => {
      const records = [{ id: 'rec-1', bonsaiId: 'b1', images: [] }]
      mockPrisma.bonsaiRecord.findMany.mockResolvedValue(records)
      const getBonsaiRecords = await importAction()

      const result = await getBonsaiRecords('b1')
      const data = unwrap<{ records: typeof records; nextCursor?: string }>(result)
      expect(data.records).toHaveLength(1)
      expect(mockPrisma.bonsaiRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bonsaiId: 'b1' },
        })
      )
    })

    it('DB例外時に空配列を返す', async () => {
      mockPrisma.bonsaiRecord.findMany.mockRejectedValue(new Error('DB error'))
      const getBonsaiRecords = await importAction()

      const result = await getBonsaiRecords('b1')
      expect(result).toEqual({ success: true, data: { records: [], nextCursor: undefined } })
    })

    it('cursor指定時にskip:1で取得する', async () => {
      mockPrisma.bonsaiRecord.findMany.mockResolvedValue([])
      const getBonsaiRecords = await importAction()

      await getBonsaiRecords('b1', { cursor: 'rec-5', limit: 10 })
      expect(mockPrisma.bonsaiRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bonsaiId: 'b1' },
          cursor: { id: 'rec-5' },
          skip: 1,
          take: 10,
        })
      )
    })

    it('limit件取得時にnextCursorを返す', async () => {
      const records = Array.from({ length: 10 }, (_, i) => ({
        id: `rec-${i}`,
        bonsaiId: 'b1',
        images: [],
      }))
      mockPrisma.bonsaiRecord.findMany.mockResolvedValue(records)
      const getBonsaiRecords = await importAction()

      const result = await getBonsaiRecords('b1', { limit: 10 })
      const data = unwrap<{ records: typeof records; nextCursor?: string }>(result)
      expect(data.nextCursor).toBe('rec-9')
    })
  })

  // ============================================================
  // addBonsaiRecord - 追加エッジケーステスト
  // ============================================================
  describe('addBonsaiRecord - edge cases', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/bonsai-record')
      return mod.addBonsaiRecord
    }

    it('bonsaiIdが空文字の場合バリデーションエラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      const addBonsaiRecord = await importAction()

      const result = await addBonsaiRecord({ bonsaiId: '' })
      expect(result).toMatchObject({ success: false, error: ERR_INVALID_INPUT })
    })

    it('contentが制限文字数を超える場合バリデーションエラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      const addBonsaiRecord = await importAction()

      const result = await addBonsaiRecord({
        bonsaiId: 'b1',
        content: 'a'.repeat(2001),
      })
      expect(result).toMatchObject({ success: false, error: ERR_INVALID_INPUT })
    })

    it('imageUrlsが上限を超える場合バリデーションエラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      const addBonsaiRecord = await importAction()

      const result = await addBonsaiRecord({
        bonsaiId: 'b1',
        imageUrls: ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg'],
      })
      expect(result).toMatchObject({ success: false, error: ERR_INVALID_INPUT })
    })

    it('imageUrlsに空文字が含まれる場合バリデーションエラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      const addBonsaiRecord = await importAction()

      const result = await addBonsaiRecord({
        bonsaiId: 'b1',
        imageUrls: [''],
      })
      expect(result).toMatchObject({ success: false, error: ERR_INVALID_INPUT })
    })

    it('recordAtが指定されない場合デフォルトで現在時刻を使う', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsai.findFirst.mockResolvedValue({ id: 'b1', userId: 'user-1' })
      mockPrisma.bonsaiRecord.create.mockResolvedValue({ id: 'rec-1', images: [] })
      const addBonsaiRecord = await importAction()

      await addBonsaiRecord({ bonsaiId: 'b1', content: 'test' })
      expect(mockPrisma.bonsaiRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recordAt: expect.any(Date),
          }),
        })
      )
    })
  })

  // ============================================================
  // updateBonsaiRecord - レート制限テスト
  // ============================================================
  describe('updateBonsaiRecord - rate limit', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/bonsai-record')
      return mod.updateBonsaiRecord
    }

    it('レート制限に達した場合エラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      const { checkUserRateLimit: mockRL } = await import('@/lib/rate-limit')
      vi.mocked(mockRL).mockResolvedValueOnce({ success: false, remaining: 0, reset: Date.now() })
      const updateBonsaiRecord = await importAction()

      const result = await updateBonsaiRecord('rec-1', { content: 'updated' })
      expect(result).toMatchObject({ success: false, error: ERR_RATE_LIMIT_OPERATION })
    })

    it('recordIdが空文字の場合バリデーションエラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      const updateBonsaiRecord = await importAction()

      const result = await updateBonsaiRecord('', { content: 'updated' })
      expect(result).toMatchObject({ success: false, error: ERR_INVALID_INPUT })
    })

    it('imageUrlsを空配列で指定すると既存画像を削除する', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        bonsaiId: 'b1',
        bonsai: { userId: 'user-1' },
      })
      mockPrisma.bonsaiRecord.update.mockResolvedValue({ id: 'rec-1', images: [] })
      const updateBonsaiRecord = await importAction()

      await updateBonsaiRecord('rec-1', { imageUrls: [] })
      expect(mockPrisma.bonsaiRecordImage.deleteMany).toHaveBeenCalledWith({
        where: { recordId: 'rec-1' },
      })
    })
  })

  // ============================================================
  // deleteBonsaiRecord - レート制限テスト
  // ============================================================
  describe('deleteBonsaiRecord - rate limit', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/bonsai-record')
      return mod.deleteBonsaiRecord
    }

    it('レート制限に達した場合エラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      const { checkUserRateLimit: mockRL } = await import('@/lib/rate-limit')
      vi.mocked(mockRL).mockResolvedValueOnce({ success: false, remaining: 0, reset: Date.now() })
      const deleteBonsaiRecord = await importAction()

      const result = await deleteBonsaiRecord('rec-1')
      expect(result).toMatchObject({ success: false, error: ERR_RATE_LIMIT_OPERATION })
    })

    it('recordIdが空文字の場合バリデーションエラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      const deleteBonsaiRecord = await importAction()

      const result = await deleteBonsaiRecord('')
      expect(result).toMatchObject({ success: false, error: ERR_INVALID_INPUT })
    })
  })

  // ============================================================
  // getBonsaiTimeline - デフォルトlimitテスト
  // ============================================================
  describe('getBonsaiTimeline - defaults', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/bonsai-record')
      return mod.getBonsaiTimeline
    }

    it('limit未指定時はDEFAULT_PAGE_LIMITを使用する', async () => {
      mockPrisma.bonsaiRecord.findMany.mockResolvedValue([])
      const getBonsaiTimeline = await importAction()

      await getBonsaiTimeline()
      expect(mockPrisma.bonsaiRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        })
      )
    })

    it('cursor未指定時はcursorとskipを含めない', async () => {
      mockPrisma.bonsaiRecord.findMany.mockResolvedValue([])
      const getBonsaiTimeline = await importAction()

      await getBonsaiTimeline({ limit: 10 })
      const call = mockPrisma.bonsaiRecord.findMany.mock.calls[0][0]
      expect(call.cursor).toBeUndefined()
      expect(call.skip).toBeUndefined()
    })
  })
})
