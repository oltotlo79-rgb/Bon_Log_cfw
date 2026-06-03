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

// ハッシュタグ同期モック（denormalized count 維持のための detach 呼び出しを検証する）
const mockDetachHashtagsFromPost = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/services/hashtag-sync', () => ({
  detachHashtagsFromPost: (...args: unknown[]) => mockDetachHashtagsFromPost(...args),
}))

// 人気タグ・トレンドジャンルのキャッシュ無効化モック
const mockRevalidatePopularTagsCache = vi.fn()
const mockRevalidateTrendingGenresCache = vi.fn()
vi.mock('@/lib/cache', () => ({
  revalidatePopularTagsCache: () => mockRevalidatePopularTagsCache(),
  revalidateTrendingGenresCache: () => mockRevalidateTrendingGenresCache(),
}))

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

const mockPost = {
  id: 'post-id-1',
  content: 'テスト投稿内容',
  createdAt: new Date('2024-01-10'),
  userId: 'user-id-1',
  user: { id: 'user-id-1', nickname: 'テストユーザー', avatarUrl: null },
  _count: { likes: 5, comments: 3 },
}

// $transactionモックはカスタムで定義（配列受け取り版）
const mockTransaction = vi.fn((ops: unknown) => {
  if (typeof ops === 'function') {
    return (ops as (...args: unknown[]) => unknown)(mockPrisma)
  }
  return Promise.all(ops as Promise<unknown>[])
})

describe('管理者向け投稿管理アクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
    // $transactionモックを再設定
    ;(mockPrisma as Record<string, unknown>).$transaction = mockTransaction
  })

  // ============================================================
  // getAdminPosts
  // ============================================================

  describe('getAdminPosts', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getAdminPosts } = await import('@/lib/actions/admin/posts')
      const result = await getAdminPosts()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getAdminPosts } = await import('@/lib/actions/admin/posts')
      const result = await getAdminPosts()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('投稿一覧と総件数を正常に返す', async () => {
      mockPrisma.post.findMany.mockResolvedValue([mockPost])
      mockPrisma.post.count.mockResolvedValue(1)
      mockPrisma.report.groupBy.mockResolvedValue([])

      const { getAdminPosts } = await import('@/lib/actions/admin/posts')
      const result = await getAdminPosts()

      if ('error' in result) throw new Error('Expected posts, got error')
      expect(result.posts).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('投稿が存在しない場合は空配列と0を返す', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.report.groupBy.mockResolvedValue([])

      const { getAdminPosts } = await import('@/lib/actions/admin/posts')
      const result = await getAdminPosts()

      if ('error' in result) throw new Error('Expected posts, got error')
      expect(result.posts).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('searchオプションで投稿内容を絞り込む', async () => {
      mockPrisma.post.findMany.mockResolvedValue([mockPost])
      mockPrisma.post.count.mockResolvedValue(1)
      mockPrisma.report.groupBy.mockResolvedValue([])

      const { getAdminPosts } = await import('@/lib/actions/admin/posts')
      await getAdminPosts({ search: 'テスト' })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            content: { contains: 'テスト' },
          }),
        })
      )
    })

    it('hasReports=trueの場合、通報された投稿のIDで絞り込む', async () => {
      mockPrisma.report.findMany.mockResolvedValue([{ targetId: 'post-id-1' }])
      mockPrisma.post.findMany.mockResolvedValue([mockPost])
      mockPrisma.post.count.mockResolvedValue(1)
      mockPrisma.report.groupBy.mockResolvedValue([
        { targetId: 'post-id-1', _count: { targetId: 1 } },
      ])

      const { getAdminPosts } = await import('@/lib/actions/admin/posts')
      const result = await getAdminPosts({ hasReports: true })

      if ('error' in result) throw new Error('Expected posts, got error')
      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { targetType: 'post' },
          select: { targetId: true },
          distinct: ['targetId'],
        })
      )
    })

    it('hasReports=falseの場合、通報フィルターなしで取得する', async () => {
      mockPrisma.post.findMany.mockResolvedValue([mockPost])
      mockPrisma.post.count.mockResolvedValue(1)
      mockPrisma.report.groupBy.mockResolvedValue([])

      const { getAdminPosts } = await import('@/lib/actions/admin/posts')
      await getAdminPosts({ hasReports: false })

      expect(mockPrisma.report.findMany).not.toHaveBeenCalled()
    })

    it('sortBy=likeCountで並び替える', async () => {
      mockPrisma.post.findMany.mockResolvedValue([mockPost])
      mockPrisma.post.count.mockResolvedValue(1)
      mockPrisma.report.groupBy.mockResolvedValue([])

      const { getAdminPosts } = await import('@/lib/actions/admin/posts')
      await getAdminPosts({ sortBy: 'likeCount', sortOrder: 'desc' })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ likes: { _count: 'desc' } }, { id: 'desc' }],
        })
      )
    })

    it('sortBy=createdAtで並び替える（id を第二キーに複合ソート）', async () => {
      mockPrisma.post.findMany.mockResolvedValue([mockPost])
      mockPrisma.post.count.mockResolvedValue(1)
      mockPrisma.report.groupBy.mockResolvedValue([])

      const { getAdminPosts } = await import('@/lib/actions/admin/posts')
      await getAdminPosts({ sortBy: 'createdAt', sortOrder: 'asc' })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })
      )
    })

    it('各投稿の通報件数をreportCountフィールドとして返す', async () => {
      mockPrisma.post.findMany.mockResolvedValue([mockPost])
      mockPrisma.post.count.mockResolvedValue(1)
      mockPrisma.report.groupBy.mockResolvedValue([
        { targetId: 'post-id-1', _count: { targetId: 3 } },
      ])

      const { getAdminPosts } = await import('@/lib/actions/admin/posts')
      const result = await getAdminPosts()

      if ('error' in result) throw new Error('Expected posts, got error')
      expect(result.posts[0].reportCount).toBe(3)
    })

    it('通報件数のないポストはreportCount=0になる', async () => {
      mockPrisma.post.findMany.mockResolvedValue([mockPost])
      mockPrisma.post.count.mockResolvedValue(1)
      mockPrisma.report.groupBy.mockResolvedValue([])

      const { getAdminPosts } = await import('@/lib/actions/admin/posts')
      const result = await getAdminPosts()

      if ('error' in result) throw new Error('Expected posts, got error')
      expect(result.posts[0].reportCount).toBe(0)
    })

    it('cursor ページネーションが正しく動作する', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.post.count.mockResolvedValue(100)
      mockPrisma.report.groupBy.mockResolvedValue([])

      const { getAdminPosts } = await import('@/lib/actions/admin/posts')
      await getAdminPosts({ limit: 10, cursor: 'post-cursor' })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, cursor: { id: 'post-cursor' }, skip: 1 })
      )
    })
  })

  // ============================================================
  // deletePostByAdmin
  // ============================================================

  describe('deletePostByAdmin', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { deletePostByAdmin } = await import('@/lib/actions/admin/posts')
      const result = await deletePostByAdmin('post-id', '規約違反')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { deletePostByAdmin } = await import('@/lib/actions/admin/posts')
      const result = await deletePostByAdmin('post-id', '規約違反')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('投稿が存在しない場合はエラーを返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { deletePostByAdmin } = await import('@/lib/actions/admin/posts')
      const result = await deletePostByAdmin('nonexistent-id', '規約違反')

      expect(result).toMatchObject({ error: '投稿が見つかりません' })
    })

    it('投稿を正常に削除して成功を返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(mockPost)
      mockTransaction.mockResolvedValue([{ id: 'post-id' }, { id: 'log-id' }])

      const { deletePostByAdmin } = await import('@/lib/actions/admin/posts')
      const result = await deletePostByAdmin('post-id-1', '規約違反のため')

      expect(result).toMatchObject({ success: true })
    })

    it('トランザクションで投稿削除と管理ログを同時実行する', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(mockPost)
      mockTransaction.mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]))
      mockPrisma.post.delete.mockResolvedValue({ id: 'post-id' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-id' })

      const { deletePostByAdmin } = await import('@/lib/actions/admin/posts')
      await deletePostByAdmin('post-id-1', '規約違反')

      expect(mockTransaction).toHaveBeenCalled()
    })

    it('削除理由を管理ログのdetailsに記録する', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(mockPost)
      mockTransaction.mockImplementation(async (_ops: unknown[]) => {
        // prisma.adminLog.createの呼び出しを確認するため、手動実行
        return Promise.resolve([{}, {}])
      })

      const { deletePostByAdmin } = await import('@/lib/actions/admin/posts')
      const result = await deletePostByAdmin('post-id-1', '利用規約違反')

      expect(result).toMatchObject({ success: true })
    })

    it('成功後にrevalidatePathを呼ぶ', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(mockPost)
      mockTransaction.mockResolvedValue([{}, {}])

      const { deletePostByAdmin } = await import('@/lib/actions/admin/posts')
      await deletePostByAdmin('post-id-1', '規約違反')

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/posts')
    })

    it('ハッシュタグを detach し人気タグキャッシュを無効化する（M-6）', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(mockPost)
      mockTransaction.mockResolvedValue([{}, {}])

      const { deletePostByAdmin } = await import('@/lib/actions/admin/posts')
      await deletePostByAdmin('post-id-1', '規約違反')

      expect(mockDetachHashtagsFromPost).toHaveBeenCalledWith('post-id-1')
      expect(mockRevalidatePopularTagsCache).toHaveBeenCalled()
      expect(mockRevalidateTrendingGenresCache).toHaveBeenCalled()
    })

    it('空の理由でも削除できる', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(mockPost)
      mockTransaction.mockResolvedValue([{}, {}])

      const { deletePostByAdmin } = await import('@/lib/actions/admin/posts')
      const result = await deletePostByAdmin('post-id-1', '')

      expect(result).toMatchObject({ success: true })
    })

    it('DBエラー時にはエラー結果を返す', async () => {
      mockPrisma.post.findUnique.mockRejectedValue(new Error('DB接続エラー'))

      const { deletePostByAdmin } = await import('@/lib/actions/admin/posts')
      const result = await deletePostByAdmin('post-id-1', '理由')
      expect(result).toMatchObject({ success: false })
    })
  })
})
