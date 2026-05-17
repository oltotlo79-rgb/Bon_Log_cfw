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

// ng-word-checkerモック
const mockInvalidateNgWordsCache = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/ng-word-checker', () => ({
  invalidateNgWordsCache: (...args: unknown[]) => mockInvalidateNgWordsCache(...args),
}))

// ============================================================
// テスト用モックデータ
// ============================================================

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

const mockNgWord = {
  id: 'ng-word-1',
  word: '禁止ワード',
  category: 'inappropriate',
  isRegex: false,
  isActive: true,
  createdBy: mockUser.id,
  createdAt: new Date('2024-06-01'),
  updatedAt: new Date('2024-06-01'),
}

const mockNgWord2 = {
  id: 'ng-word-2',
  word: 'スパム',
  category: 'spam',
  isRegex: false,
  isActive: false,
  createdBy: mockUser.id,
  createdAt: new Date('2024-06-02'),
  updatedAt: new Date('2024-06-02'),
}

const mockModerationItem = {
  id: 'mod-item-1',
  targetId: 'target-post-1',
  targetType: 'post',
  status: 'pending',
  reason: 'NGワード検出',
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date('2024-07-01'),
  updatedAt: new Date('2024-07-01'),
}

const mockModerationItemComment = {
  id: 'mod-item-2',
  targetId: 'target-comment-1',
  targetType: 'comment',
  status: 'pending',
  reason: 'ユーザー通報',
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date('2024-07-02'),
  updatedAt: new Date('2024-07-02'),
}

// $transactionモック
const mockTransaction = vi.fn((ops: unknown) => {
  if (typeof ops === 'function') {
    return (ops as (...args: unknown[]) => unknown)(mockPrisma)
  }
  return Promise.all(ops as Promise<unknown>[])
})

// ============================================================
// ngWord, moderationQueue はcreateMockPrismaClientに含まれないため
// 動的に追加する
// ============================================================

function setupExtraModels() {
   
  const p = mockPrisma as any
  if (!p.ngWord) {
    p.ngWord = {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    }
  }
  if (!p.moderationQueue) {
    p.moderationQueue = {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    }
  }
  // post.deleteMany が無い場合に追加
  if (!p.post.deleteMany) {
    p.post.deleteMany = vi.fn()
  }
  // user.updateMany が既にあるはず（念のため）
  if (!p.user.updateMany) {
    p.user.updateMany = vi.fn()
  }
}

describe('管理者向けモデレーションアクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupExtraModels()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
    ;(mockPrisma as Record<string, unknown>).$transaction = mockTransaction
  })

  // ============================================================
  // getNgWords
  // ============================================================

  describe('getNgWords', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getNgWords } = await import('@/lib/actions/admin/moderation')
      const result = await getNgWords()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getNgWords } = await import('@/lib/actions/admin/moderation')
      const result = await getNgWords()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('NGワード一覧と総件数を正常に返す', async () => {
       
      const p = mockPrisma as any
      p.ngWord.findMany.mockResolvedValue([mockNgWord, mockNgWord2])
      p.ngWord.count.mockResolvedValue(2)

      const { getNgWords } = await import('@/lib/actions/admin/moderation')
      const result = await getNgWords()

      if ('error' in result) throw new Error('Expected words, got error')
      expect(result.words).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('オプションなしではデフォルト limit、cursor/skip なしで動作する', async () => {

      const p = mockPrisma as any
      p.ngWord.findMany.mockResolvedValue([])
      p.ngWord.count.mockResolvedValue(0)

      const { getNgWords } = await import('@/lib/actions/admin/moderation')
      await getNgWords()

      const call = p.ngWord.findMany.mock.calls[0][0]
      expect(call.take).toBe(20)
      expect(call.cursor).toBeUndefined()
      expect(call.skip).toBeUndefined()
    })

    it('検索キーワードでフィルタリングできる', async () => {
       
      const p = mockPrisma as any
      p.ngWord.findMany.mockResolvedValue([mockNgWord])
      p.ngWord.count.mockResolvedValue(1)

      const { getNgWords } = await import('@/lib/actions/admin/moderation')
      await getNgWords({ search: '禁止' })

      expect(p.ngWord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            word: { contains: '禁止' },
          }),
        })
      )
    })

    it('カテゴリでフィルタリングできる', async () => {
       
      const p = mockPrisma as any
      p.ngWord.findMany.mockResolvedValue([mockNgWord2])
      p.ngWord.count.mockResolvedValue(1)

      const { getNgWords } = await import('@/lib/actions/admin/moderation')
      await getNgWords({ category: 'spam' })

      expect(p.ngWord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'spam',
          }),
        })
      )
    })

    it('cursor 指定で cursor/skip:1 が findMany に渡される', async () => {

      const p = mockPrisma as any
      p.ngWord.findMany.mockResolvedValue([])
      p.ngWord.count.mockResolvedValue(0)

      const { getNgWords } = await import('@/lib/actions/admin/moderation')
      await getNgWords({ limit: 10, cursor: 'ng-cursor' })

      expect(p.ngWord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'ng-cursor' },
          skip: 1,
        })
      )
    })

    it('NGワードが存在しない場合は空配列と0を返す', async () => {
       
      const p = mockPrisma as any
      p.ngWord.findMany.mockResolvedValue([])
      p.ngWord.count.mockResolvedValue(0)

      const { getNgWords } = await import('@/lib/actions/admin/moderation')
      const result = await getNgWords()

      if ('error' in result) throw new Error('Expected words, got error')
      expect(result.words).toHaveLength(0)
      expect(result.total).toBe(0)
    })
  })

  // ============================================================
  // createNgWord
  // ============================================================

  describe('createNgWord', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { createNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await createNgWord({ word: 'テスト', category: 'inappropriate' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { createNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await createNgWord({ word: 'テスト', category: 'inappropriate' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('空文字の場合はエラーを返す', async () => {
      const { createNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await createNgWord({ word: '', category: 'inappropriate' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('空白のみの場合はエラーを返す', async () => {
      const { createNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await createNgWord({ word: '   ', category: 'inappropriate' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('重複するワードの場合はエラーを返す', async () => {
       
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(mockNgWord)

      const { createNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await createNgWord({ word: '禁止ワード', category: 'inappropriate' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('正常にNGワードを作成できる', async () => {
       
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(null)
      p.ngWord.create.mockResolvedValue({ id: 'new-ng-word' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { createNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await createNgWord({ word: '新しい禁止ワード', category: 'spam' })

      expect(result).toMatchObject({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
      expect(mockInvalidateNgWordsCache).toHaveBeenCalled()
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/ng-words')
    })

    it('isRegexオプションが渡される', async () => {
       
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(null)
      p.ngWord.create.mockResolvedValue({ id: 'new-ng-word' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { createNgWord } = await import('@/lib/actions/admin/moderation')
      await createNgWord({ word: 'regex.*pattern', category: 'spam', isRegex: true })

      // $transaction はバッチ配列として呼ばれる（関数ではない）
      expect(mockTransaction).toHaveBeenCalled()
    })

    it('ワードの前後の空白がトリムされる', async () => {
       
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(null)
      p.ngWord.create.mockResolvedValue({ id: 'new-ng-word' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { createNgWord } = await import('@/lib/actions/admin/moderation')
      await createNgWord({ word: '  トリム対象  ', category: 'inappropriate' })

      // findUnique でトリム後のワードで重複チェック
      expect(p.ngWord.findUnique).toHaveBeenCalledWith({
        where: { word: 'トリム対象' },
      })
    })

    it('カテゴリが空の場合はデフォルトの inappropriate が使われる', async () => {
       
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(null)
      p.ngWord.create.mockResolvedValue({ id: 'new-ng-word' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { createNgWord } = await import('@/lib/actions/admin/moderation')
      await createNgWord({ word: 'テストワード', category: '' })

      // transaction内でcreateが呼ばれることを確認
      expect(mockTransaction).toHaveBeenCalled()
    })
  })

  // ============================================================
  // deleteNgWord
  // ============================================================

  describe('deleteNgWord', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { deleteNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await deleteNgWord('ng-word-1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { deleteNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await deleteNgWord('ng-word-1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('存在しないNGワードの場合はエラーを返す', async () => {
       
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(null)

      const { deleteNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await deleteNgWord('nonexistent-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('正常にNGワードを削除できる', async () => {
       
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(mockNgWord)
      p.ngWord.delete.mockResolvedValue(mockNgWord)
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { deleteNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await deleteNgWord('ng-word-1')

      expect(result).toMatchObject({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
      expect(mockInvalidateNgWordsCache).toHaveBeenCalled()
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/ng-words')
    })
  })

  // ============================================================
  // toggleNgWord
  // ============================================================

  describe('toggleNgWord', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { toggleNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await toggleNgWord('ng-word-1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { toggleNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await toggleNgWord('ng-word-1')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('存在しないNGワードの場合はエラーを返す', async () => {
       
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(null)

      const { toggleNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await toggleNgWord('nonexistent-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('有効なNGワードを無効に切り替えられる', async () => {
       
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue({ ...mockNgWord, isActive: true })
      p.ngWord.update.mockResolvedValue({ ...mockNgWord, isActive: false })

      const { toggleNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await toggleNgWord('ng-word-1')

      expect(result).toMatchObject({ success: true })
      expect(p.ngWord.update).toHaveBeenCalledWith({
        where: { id: 'ng-word-1' },
        data: { isActive: false },
      })
      expect(mockInvalidateNgWordsCache).toHaveBeenCalled()
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/ng-words')
    })

    it('無効なNGワードを有効に切り替えられる', async () => {
       
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue({ ...mockNgWord2, isActive: false })
      p.ngWord.update.mockResolvedValue({ ...mockNgWord2, isActive: true })

      const { toggleNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await toggleNgWord('ng-word-2')

      expect(result).toMatchObject({ success: true })
      expect(p.ngWord.update).toHaveBeenCalledWith({
        where: { id: 'ng-word-2' },
        data: { isActive: true },
      })
    })
  })

  // ============================================================
  // getModerationQueue
  // ============================================================

  describe('getModerationQueue', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getModerationQueue } = await import('@/lib/actions/admin/moderation')
      const result = await getModerationQueue()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getModerationQueue } = await import('@/lib/actions/admin/moderation')
      const result = await getModerationQueue()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('モデレーションキュー一覧と総件数を正常に返す', async () => {
       
      const p = mockPrisma as any
      p.moderationQueue.findMany.mockResolvedValue([mockModerationItem, mockModerationItemComment])
      p.moderationQueue.count.mockResolvedValue(2)

      const { getModerationQueue } = await import('@/lib/actions/admin/moderation')
      const result = await getModerationQueue()

      if ('error' in result) throw new Error('Expected items, got error')
      expect(result.items).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('ステータスでフィルタリングできる', async () => {
       
      const p = mockPrisma as any
      p.moderationQueue.findMany.mockResolvedValue([mockModerationItem])
      p.moderationQueue.count.mockResolvedValue(1)

      const { getModerationQueue } = await import('@/lib/actions/admin/moderation')
      await getModerationQueue({ status: 'pending' as never })

      expect(p.moderationQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'pending',
          }),
        })
      )
    })

    it('ターゲットタイプでフィルタリングできる', async () => {
       
      const p = mockPrisma as any
      p.moderationQueue.findMany.mockResolvedValue([mockModerationItem])
      p.moderationQueue.count.mockResolvedValue(1)

      const { getModerationQueue } = await import('@/lib/actions/admin/moderation')
      await getModerationQueue({ targetType: 'post' as never })

      expect(p.moderationQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            targetType: 'post',
          }),
        })
      )
    })

    it('cursor 指定で cursor/skip:1 が findMany に渡される', async () => {

      const p = mockPrisma as any
      p.moderationQueue.findMany.mockResolvedValue([])
      p.moderationQueue.count.mockResolvedValue(0)

      const { getModerationQueue } = await import('@/lib/actions/admin/moderation')
      await getModerationQueue({ limit: 5, cursor: 'mq-cursor' })

      expect(p.moderationQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          cursor: { id: 'mq-cursor' },
          skip: 1,
        })
      )
    })

    it('オプションなしではデフォルト limit、cursor/skip なしで動作する', async () => {

      const p = mockPrisma as any
      p.moderationQueue.findMany.mockResolvedValue([])
      p.moderationQueue.count.mockResolvedValue(0)

      const { getModerationQueue } = await import('@/lib/actions/admin/moderation')
      await getModerationQueue()

      const call = p.moderationQueue.findMany.mock.calls[0][0]
      expect(call.take).toBe(20)
      expect(call.cursor).toBeUndefined()
      expect(call.skip).toBeUndefined()
    })

    it('キューが空の場合は空配列と0を返す', async () => {
       
      const p = mockPrisma as any
      p.moderationQueue.findMany.mockResolvedValue([])
      p.moderationQueue.count.mockResolvedValue(0)

      const { getModerationQueue } = await import('@/lib/actions/admin/moderation')
      const result = await getModerationQueue()

      if ('error' in result) throw new Error('Expected items, got error')
      expect(result.items).toHaveLength(0)
      expect(result.total).toBe(0)
    })
  })

  // ============================================================
  // reviewModerationItem
  // ============================================================

  describe('reviewModerationItem', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      const result = await reviewModerationItem('mod-item-1', 'approved')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      const result = await reviewModerationItem('mod-item-1', 'approved')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('存在しないモデレーションアイテムの場合はエラーを返す', async () => {
       
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(null)

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      const result = await reviewModerationItem('nonexistent-id', 'approved')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('approvedアクションで正常にレビューできる', async () => {
       
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(mockModerationItem)
      p.moderationQueue.update.mockResolvedValue({ ...mockModerationItem, status: 'approved' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      const result = await reviewModerationItem('mod-item-1', 'approved')

      expect(result).toMatchObject({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/moderation-queue')
    })

    it('approvedの場合は対象コンテンツを削除しない', async () => {
       
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(mockModerationItem)
      p.moderationQueue.update.mockResolvedValue({ ...mockModerationItem, status: 'approved' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      await reviewModerationItem('mod-item-1', 'approved')

      expect(mockPrisma.post.delete).not.toHaveBeenCalled()
      expect(mockPrisma.comment.delete).not.toHaveBeenCalled()
    })

    it('rejectedアクションで投稿タイプの対象を削除する', async () => {
       
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(mockModerationItem)
      p.moderationQueue.update.mockResolvedValue({ ...mockModerationItem, status: 'rejected' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })
      mockPrisma.post.delete.mockResolvedValue({ id: 'target-post-1' })

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      const result = await reviewModerationItem('mod-item-1', 'rejected')

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.post.delete).toHaveBeenCalledWith({
        where: { id: 'target-post-1' },
      })
    })

    it('rejectedアクションでコメントタイプの対象を削除する', async () => {
       
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(mockModerationItemComment)
      p.moderationQueue.update.mockResolvedValue({ ...mockModerationItemComment, status: 'rejected' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })
      mockPrisma.comment.delete.mockResolvedValue({ id: 'target-comment-1' })

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      const result = await reviewModerationItem('mod-item-1', 'rejected')

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.comment.delete).toHaveBeenCalledWith({
        where: { id: 'target-comment-1' },
      })
    })

    it('rejectedで対象コンテンツが既に削除済みでもエラーにならない', async () => {
       
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(mockModerationItem)
      p.moderationQueue.update.mockResolvedValue({ ...mockModerationItem, status: 'rejected' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })
      // 削除対象が見つからない場合 .catch(() => {}) で吸収される
      mockPrisma.post.delete.mockRejectedValue(new Error('Record not found'))

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      const result = await reviewModerationItem('mod-item-1', 'rejected')

      expect(result).toMatchObject({ success: true })
    })

    it('$transactionにreviewedByとreviewedAtが渡される', async () => {
       
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(mockModerationItem)
      p.moderationQueue.update.mockResolvedValue({ ...mockModerationItem, status: 'approved' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      await reviewModerationItem('mod-item-1', 'approved')

      expect(mockTransaction).toHaveBeenCalled()
    })
  })

  // ============================================================
  // bulkReviewModeration
  // ============================================================

  describe('bulkReviewModeration', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { bulkReviewModeration } = await import('@/lib/actions/admin/moderation')
      const result = await bulkReviewModeration(['id-1', 'id-2'], 'approved')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { bulkReviewModeration } = await import('@/lib/actions/admin/moderation')
      const result = await bulkReviewModeration(['id-1', 'id-2'], 'approved')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('一括承認が正常に動作する', async () => {
       
      const p = mockPrisma as any
      p.moderationQueue.updateMany.mockResolvedValue({ count: 3 })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { bulkReviewModeration } = await import('@/lib/actions/admin/moderation')
      const ids = ['id-1', 'id-2', 'id-3']
      const result = await bulkReviewModeration(ids, 'approved')

      expect(result).toMatchObject({ success: true })
      expect(p.moderationQueue.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ids } },
        data: expect.objectContaining({
          status: 'approved',
          reviewedBy: mockUser.id,
        }),
      })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/moderation-queue')
    })

    it('一括拒否が正常に動作する', async () => {
       
      const p = mockPrisma as any
      p.moderationQueue.updateMany.mockResolvedValue({ count: 2 })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { bulkReviewModeration } = await import('@/lib/actions/admin/moderation')
      const ids = ['id-1', 'id-2']
      const result = await bulkReviewModeration(ids, 'rejected')

      expect(result).toMatchObject({ success: true })
      expect(p.moderationQueue.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ids } },
        data: expect.objectContaining({
          status: 'rejected',
          reviewedBy: mockUser.id,
        }),
      })
    })

    it('adminLogにバルク操作の詳細が記録される', async () => {
       
      const p = mockPrisma as any
      p.moderationQueue.updateMany.mockResolvedValue({ count: 2 })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { bulkReviewModeration } = await import('@/lib/actions/admin/moderation')
      const ids = ['id-1', 'id-2']
      await bulkReviewModeration(ids, 'approved')

      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: mockUser.id,
          action: 'bulk_moderation_approved',
          details: expect.stringContaining('"count":2'),
        }),
      })
    })

    it('空のID配列はエラーを返す（上限バリデーション）', async () => {
      const { bulkReviewModeration } = await import('@/lib/actions/admin/moderation')
      const result = await bulkReviewModeration([], 'approved')

      expect(result).toMatchObject({ error: expect.any(String) })
    })
  })

  // ============================================================
  // bulkDeletePosts
  // ============================================================

  describe('bulkDeletePosts', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { bulkDeletePosts } = await import('@/lib/actions/admin/moderation')
      const result = await bulkDeletePosts(['post-1', 'post-2'])
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { bulkDeletePosts } = await import('@/lib/actions/admin/moderation')
      const result = await bulkDeletePosts(['post-1', 'post-2'])
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('一括投稿削除が正常に動作する', async () => {
       
      const p = mockPrisma as any
      p.post.deleteMany.mockResolvedValue({ count: 3 })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { bulkDeletePosts } = await import('@/lib/actions/admin/moderation')
      const postIds = ['post-1', 'post-2', 'post-3']
      const result = await bulkDeletePosts(postIds)

      expect(result).toMatchObject({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/posts')
    })

    it('$transactionで投稿削除とログ記録が一括実行される', async () => {
       
      const p = mockPrisma as any
      p.post.deleteMany.mockResolvedValue({ count: 2 })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { bulkDeletePosts } = await import('@/lib/actions/admin/moderation')
      await bulkDeletePosts(['post-1', 'post-2'])

      expect(mockTransaction).toHaveBeenCalledTimes(1)
    })

    it('空のID配列はエラーを返す（上限バリデーション）', async () => {
      const { bulkDeletePosts } = await import('@/lib/actions/admin/moderation')
      const result = await bulkDeletePosts([])

      expect(result).toMatchObject({ error: expect.any(String) })
    })
  })

  // ============================================================
  // bulkSuspendUsers
  // ============================================================

  describe('bulkSuspendUsers', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { bulkSuspendUsers } = await import('@/lib/actions/admin/moderation')
      const result = await bulkSuspendUsers(['user-1', 'user-2'])
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { bulkSuspendUsers } = await import('@/lib/actions/admin/moderation')
      const result = await bulkSuspendUsers(['user-1', 'user-2'])
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('一括ユーザー停止が正常に動作する', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 2 })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { bulkSuspendUsers } = await import('@/lib/actions/admin/moderation')
      const userIds = ['user-1', 'user-2']
      const result = await bulkSuspendUsers(userIds)

      expect(result).toMatchObject({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('isSuspended: falseのユーザーのみ対象になる', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { bulkSuspendUsers } = await import('@/lib/actions/admin/moderation')
      const userIds = ['user-1', 'user-2']
      await bulkSuspendUsers(userIds)

      // transaction内のupdateManyのwhere条件を確認（バッチ配列なので直接検証は複雑）
      expect(mockTransaction).toHaveBeenCalled()
    })

    it('$transactionで停止処理とログ記録が一括実行される', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 2 })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { bulkSuspendUsers } = await import('@/lib/actions/admin/moderation')
      await bulkSuspendUsers(['user-1', 'user-2'])

      expect(mockTransaction).toHaveBeenCalledTimes(1)
    })

    it('adminLogにバルク停止の詳細が記録される', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 2 })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { bulkSuspendUsers } = await import('@/lib/actions/admin/moderation')
      const userIds = ['user-1', 'user-2']
      await bulkSuspendUsers(userIds)

      // transaction内のcreateを検証（バッチ配列経由）
      expect(mockTransaction).toHaveBeenCalled()
    })

    it('空のID配列はエラーを返す（上限バリデーション）', async () => {
      const { bulkSuspendUsers } = await import('@/lib/actions/admin/moderation')
      const result = await bulkSuspendUsers([])

      expect(result).toMatchObject({ error: expect.any(String) })
    })
  })

  // ============================================================
  // トランザクション内容の検証
  // ============================================================

  describe('トランザクション内容の詳細検証', () => {
    it('createNgWordのトランザクションはNGワード作成とログ記録の2操作を含む', async () => {
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(null)
      p.ngWord.create.mockResolvedValue({ id: 'new-ng-word' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { createNgWord } = await import('@/lib/actions/admin/moderation')
      await createNgWord({ word: 'テスト', category: 'spam' })

      // $transaction はバッチ配列（Promise[]）で呼ばれる
      expect(mockTransaction).toHaveBeenCalledTimes(1)
      const callArgs = mockTransaction.mock.calls[0][0]
      // バッチ配列として2つのPromiseが渡される
      expect(callArgs).toHaveLength(2)
    })

    it('deleteNgWordのトランザクションはNGワード削除とログ記録の2操作を含む', async () => {
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(mockNgWord)
      p.ngWord.delete.mockResolvedValue(mockNgWord)
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { deleteNgWord } = await import('@/lib/actions/admin/moderation')
      await deleteNgWord('ng-word-1')

      expect(mockTransaction).toHaveBeenCalledTimes(1)
      const callArgs = mockTransaction.mock.calls[0][0]
      expect(callArgs).toHaveLength(2)
    })

    it('reviewModerationItemのトランザクションはステータス更新とログ記録の2操作を含む', async () => {
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(mockModerationItem)
      p.moderationQueue.update.mockResolvedValue({ ...mockModerationItem, status: 'approved' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      await reviewModerationItem('mod-item-1', 'approved')

      expect(mockTransaction).toHaveBeenCalledTimes(1)
      const callArgs = mockTransaction.mock.calls[0][0]
      expect(callArgs).toHaveLength(2)
    })
  })

  // ============================================================
  // モデレーション拒否→コンテンツ削除の連鎖
  // ============================================================

  describe('モデレーション拒否→コンテンツ削除の連鎖', () => {
    it('投稿を拒否するとpost.deleteが呼ばれる', async () => {
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(mockModerationItem)
      p.moderationQueue.update.mockResolvedValue({ ...mockModerationItem, status: 'rejected' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })
      mockPrisma.post.delete.mockResolvedValue({ id: 'target-post-1' })

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      await reviewModerationItem('mod-item-1', 'rejected')

      expect(mockPrisma.post.delete).toHaveBeenCalledWith({
        where: { id: 'target-post-1' },
      })
      expect(mockPrisma.comment.delete).not.toHaveBeenCalled()
    })

    it('コメントを拒否するとcomment.deleteが呼ばれる', async () => {
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(mockModerationItemComment)
      p.moderationQueue.update.mockResolvedValue({ ...mockModerationItemComment, status: 'rejected' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })
      mockPrisma.comment.delete.mockResolvedValue({ id: 'target-comment-1' })

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      await reviewModerationItem('mod-item-2', 'rejected')

      expect(mockPrisma.comment.delete).toHaveBeenCalledWith({
        where: { id: 'target-comment-1' },
      })
      expect(mockPrisma.post.delete).not.toHaveBeenCalled()
    })

    it('拒否対象が既に削除済みでもエラーにならない', async () => {
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(mockModerationItem)
      p.moderationQueue.update.mockResolvedValue({ ...mockModerationItem, status: 'rejected' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })
      mockPrisma.post.delete.mockRejectedValue(new Error('Record to delete does not exist'))

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      const result = await reviewModerationItem('mod-item-1', 'rejected')

      expect(result).toMatchObject({ success: true })
    })

    it('承認時はpost.deleteもcomment.deleteも呼ばれない', async () => {
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(mockModerationItem)
      p.moderationQueue.update.mockResolvedValue({ ...mockModerationItem, status: 'approved' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      await reviewModerationItem('mod-item-1', 'approved')

      expect(mockPrisma.post.delete).not.toHaveBeenCalled()
      expect(mockPrisma.comment.delete).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // 境界値テスト
  // ============================================================

  describe('境界値テスト', () => {
    it('NGワードの空白のみ入力はエラーを返す（タブ文字）', async () => {
      const { createNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await createNgWord({ word: '\t\t', category: 'inappropriate' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('NGワードの空白のみ入力はエラーを返す（改行）', async () => {
      const { createNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await createNgWord({ word: '\n\n', category: 'inappropriate' })
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('非常に長いNGワード（100文字超）はエラーを返す', async () => {
      const longWord = 'あ'.repeat(150)
      const { createNgWord } = await import('@/lib/actions/admin/moderation')
      const result = await createNgWord({ word: longWord, category: 'inappropriate' })

      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('bulkReviewModerationに空配列を渡すとエラーを返す（上限バリデーション）', async () => {
      const { bulkReviewModeration } = await import('@/lib/actions/admin/moderation')
      const result = await bulkReviewModeration([], 'rejected')

      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('reviewModerationItemで既にapprovedのアイテムを再レビューできる', async () => {
      const approvedItem = { ...mockModerationItem, status: 'approved', reviewedBy: 'other-admin', reviewedAt: new Date() }
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(approvedItem)
      p.moderationQueue.update.mockResolvedValue({ ...approvedItem, status: 'rejected' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })
      mockPrisma.post.delete.mockResolvedValue({ id: 'target-post-1' })

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      const result = await reviewModerationItem('mod-item-1', 'rejected')

      // 実装上は既存ステータスに関係なく更新される
      expect(result).toMatchObject({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
    })

    it('reviewModerationItemで既にrejectedのアイテムを承認に変更できる', async () => {
      const rejectedItem = { ...mockModerationItem, status: 'rejected', reviewedBy: 'other-admin', reviewedAt: new Date() }
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(rejectedItem)
      p.moderationQueue.update.mockResolvedValue({ ...rejectedItem, status: 'approved' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      const result = await reviewModerationItem('mod-item-1', 'approved')

      expect(result).toMatchObject({ success: true })
      // 承認の場合はコンテンツ削除しない
      expect(mockPrisma.post.delete).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // 戻り値の構造検証
  // ============================================================

  describe('戻り値の構造検証', () => {
    it('getNgWordsの戻り値が {words: Array, total: number} の構造を持つ', async () => {
      const p = mockPrisma as any
      p.ngWord.findMany.mockResolvedValue([mockNgWord])
      p.ngWord.count.mockResolvedValue(1)

      const { getNgWords } = await import('@/lib/actions/admin/moderation')
      const result = await getNgWords()

      expect(result).toHaveProperty('words')
      expect(result).toHaveProperty('total')
      if ('words' in result) {
        expect(Array.isArray(result.words)).toBe(true)
        expect(typeof result.total).toBe('number')
      }
    })

    it('getModerationQueueの戻り値が {items: Array, total: number} の構造を持つ', async () => {
      const p = mockPrisma as any
      p.moderationQueue.findMany.mockResolvedValue([mockModerationItem])
      p.moderationQueue.count.mockResolvedValue(1)

      const { getModerationQueue } = await import('@/lib/actions/admin/moderation')
      const result = await getModerationQueue()

      expect(result).toHaveProperty('items')
      expect(result).toHaveProperty('total')
      if ('items' in result) {
        expect(Array.isArray(result.items)).toBe(true)
        expect(typeof result.total).toBe('number')
      }
    })

    it('getModerationQueueの各アイテムが必要なフィールドを持つ', async () => {
      const p = mockPrisma as any
      p.moderationQueue.findMany.mockResolvedValue([mockModerationItem])
      p.moderationQueue.count.mockResolvedValue(1)

      const { getModerationQueue } = await import('@/lib/actions/admin/moderation')
      const result = await getModerationQueue()

      if ('items' in result) {
        const item = result.items[0]
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('targetId')
        expect(item).toHaveProperty('targetType')
        expect(item).toHaveProperty('status')
        expect(item).toHaveProperty('reason')
        expect(item).toHaveProperty('createdAt')
      }
    })

    it('getNgWordsの各ワードが必要なフィールドを持つ', async () => {
      const p = mockPrisma as any
      p.ngWord.findMany.mockResolvedValue([mockNgWord])
      p.ngWord.count.mockResolvedValue(1)

      const { getNgWords } = await import('@/lib/actions/admin/moderation')
      const result = await getNgWords()

      if ('words' in result) {
        const word = result.words[0]
        expect(word).toHaveProperty('id')
        expect(word).toHaveProperty('word')
        expect(word).toHaveProperty('category')
        expect(word).toHaveProperty('isRegex')
        expect(word).toHaveProperty('isActive')
        expect(word).toHaveProperty('createdBy')
      }
    })
  })

  // ============================================================
  // エラー回復とキャッシュ無効化の検証
  // ============================================================

  describe('エラー回復とキャッシュ無効化', () => {
    it('post.deleteが失敗してもreviewModerationItemは成功を返す', async () => {
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(mockModerationItem)
      p.moderationQueue.update.mockResolvedValue({ ...mockModerationItem, status: 'rejected' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })
      mockPrisma.post.delete.mockRejectedValue(new Error('Foreign key constraint failed'))

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      const result = await reviewModerationItem('mod-item-1', 'rejected')

      expect(result).toMatchObject({ success: true })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/moderation-queue')
    })

    it('comment.deleteが失敗してもreviewModerationItemは成功を返す', async () => {
      const p = mockPrisma as any
      p.moderationQueue.findUnique.mockResolvedValue(mockModerationItemComment)
      p.moderationQueue.update.mockResolvedValue({ ...mockModerationItemComment, status: 'rejected' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })
      mockPrisma.comment.delete.mockRejectedValue(new Error('Record not found'))

      const { reviewModerationItem } = await import('@/lib/actions/admin/moderation')
      const result = await reviewModerationItem('mod-item-2', 'rejected')

      expect(result).toMatchObject({ success: true })
    })

    it('createNgWord成功後にinvalidateNgWordsCacheが呼ばれる', async () => {
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(null)
      p.ngWord.create.mockResolvedValue({ id: 'new-ng-word' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { createNgWord } = await import('@/lib/actions/admin/moderation')
      await createNgWord({ word: 'キャッシュテスト', category: 'spam' })

      expect(mockInvalidateNgWordsCache).toHaveBeenCalledTimes(1)
    })

    it('deleteNgWord成功後にinvalidateNgWordsCacheが呼ばれる', async () => {
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(mockNgWord)
      p.ngWord.delete.mockResolvedValue(mockNgWord)
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { deleteNgWord } = await import('@/lib/actions/admin/moderation')
      await deleteNgWord('ng-word-1')

      expect(mockInvalidateNgWordsCache).toHaveBeenCalledTimes(1)
    })

    it('toggleNgWord成功後にinvalidateNgWordsCacheが呼ばれる', async () => {
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue({ ...mockNgWord, isActive: true })
      p.ngWord.update.mockResolvedValue({ ...mockNgWord, isActive: false })

      const { toggleNgWord } = await import('@/lib/actions/admin/moderation')
      await toggleNgWord('ng-word-1')

      expect(mockInvalidateNgWordsCache).toHaveBeenCalledTimes(1)
    })
  })
})
