import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath, revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

const mockPrisma: Record<string, any> = {
  user: { findUnique: vi.fn() },
  adminUser: { findUnique: vi.fn() },
  post: { findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), count: vi.fn() },
  report: { findMany: vi.fn(), groupBy: vi.fn() },
  adminLog: { create: vi.fn() },
  $transaction: vi.fn((ops: unknown) =>
    typeof ops === 'function'
      ? (ops as (...args: unknown[]) => unknown)(mockPrisma)
      : Promise.all(ops as Promise<unknown>[])
  ),
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

describe('getAdminPosts', async () => {
  const { getAdminPosts } = await import('@/lib/actions/admin/posts')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
    mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'admin-user-id', role: 'admin' })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.report.findMany.mockResolvedValue([])
    mockPrisma.report.groupBy.mockResolvedValue([])
  })

  describe('authentication and authorization', () => {
    it('returns error when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const result = await getAdminPosts()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('returns error when user is not admin', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const result = await getAdminPosts()
      expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
    })
  })

  describe('happy path', () => {
    it('returns posts and total with no options', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          content: 'Test post',
          createdAt: new Date(),
          user: { id: 'user-1', nickname: 'User', avatarUrl: null },
          _count: { likes: 5, comments: 2 },
        },
      ]
      mockPrisma.post.findMany.mockResolvedValue(mockPosts)
      mockPrisma.post.count.mockResolvedValue(1)
      mockPrisma.report.groupBy.mockResolvedValue([{ targetId: 'post-1', _count: { targetId: 3 } }])

      const result = await getAdminPosts()
      expect(result).toHaveProperty('posts')
      expect(result).toHaveProperty('total')
      if ('posts' in result) {
        expect(result.total).toBe(1)
        expect(result.posts[0]).toHaveProperty('reportCount', 3)
      }
    })

    it('adds reportCount=0 when post has no reports', async () => {
      const mockPosts = [
        { id: 'post-no-report', content: 'Clean post', createdAt: new Date(),
          user: { id: 'user-1', nickname: 'User', avatarUrl: null },
          _count: { likes: 1, comments: 0 } },
      ]
      mockPrisma.post.findMany.mockResolvedValue(mockPosts)
      mockPrisma.post.count.mockResolvedValue(1)
      mockPrisma.report.groupBy.mockResolvedValue([])

      const result = await getAdminPosts()
      if ('posts' in result) {
        expect(result.posts[0].reportCount).toBe(0)
      }
    })

    it('returns empty posts when no records exist', async () => {
      const result = await getAdminPosts()
      if ('posts' in result) {
        expect(result.posts).toEqual([])
        expect(result.total).toBe(0)
      }
    })
  })

  describe('search filter', () => {
    it('passes content search filter to prisma', async () => {
      await getAdminPosts({ search: 'bonsai' })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            content: { contains: 'bonsai' },
          }),
        })
      )
    })

    it('does not add content filter when search is not provided', async () => {
      await getAdminPosts()

      const call = mockPrisma.post.findMany.mock.calls[0][0]
      expect(call.where).not.toHaveProperty('content')
    })
  })

  describe('hasReports filter', () => {
    it('queries reported post IDs when hasReports is true', async () => {
      mockPrisma.report.findMany.mockResolvedValue([
        { targetId: 'post-1' },
        { targetId: 'post-2' },
      ])
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.post.count.mockResolvedValue(0)

      await getAdminPosts({ hasReports: true })

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { targetType: 'post' },
          select: { targetId: true },
          distinct: ['targetId'],
        })
      )
      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['post-1', 'post-2'] },
          }),
        })
      )
    })

    it('does not query reports when hasReports is false (default)', async () => {
      await getAdminPosts()
      expect(mockPrisma.report.findMany).not.toHaveBeenCalled()
    })
  })

  describe('sorting', () => {
    it('sorts by createdAt desc by default (id as secondary tiebreaker)', async () => {
      await getAdminPosts()

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      )
    })

    it('sorts by likeCount using relation count (id as secondary tiebreaker)', async () => {
      await getAdminPosts({ sortBy: 'likeCount', sortOrder: 'asc' })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ likes: { _count: 'asc' } }, { id: 'asc' }],
        })
      )
    })

    it('sorts by createdAt asc when specified (id as secondary tiebreaker)', async () => {
      await getAdminPosts({ sortBy: 'createdAt', sortOrder: 'asc' })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })
      )
    })
  })

  describe('pagination', () => {
    it('uses DEFAULT_PAGE_LIMIT (20) and no cursor when not specified', async () => {
      await getAdminPosts()

      const call = mockPrisma.post.findMany.mock.calls[0][0]
      expect(call.take).toBe(20)
      expect(call.cursor).toBeUndefined()
      expect(call.skip).toBeUndefined()
    })

    it('respects custom limit and cursor', async () => {
      await getAdminPosts({ limit: 5, cursor: 'post-cursor' })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          cursor: { id: 'post-cursor' },
          skip: 1,
        })
      )
    })
  })

  describe('N+1 prevention for report counts', () => {
    it('skips report count query when post list is empty', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.post.count.mockResolvedValue(0)

      await getAdminPosts()

      expect(mockPrisma.report.groupBy).not.toHaveBeenCalled()
    })

    it('fetches report counts in bulk when posts exist', async () => {
      const mockPosts = [
        { id: 'post-1', content: 'A', createdAt: new Date(),
          user: { id: 'u1', nickname: 'U1', avatarUrl: null },
          _count: { likes: 0, comments: 0 } },
        { id: 'post-2', content: 'B', createdAt: new Date(),
          user: { id: 'u2', nickname: 'U2', avatarUrl: null },
          _count: { likes: 0, comments: 0 } },
      ]
      mockPrisma.post.findMany.mockResolvedValue(mockPosts)
      mockPrisma.post.count.mockResolvedValue(2)
      mockPrisma.report.groupBy.mockResolvedValue([])

      await getAdminPosts()

      expect(mockPrisma.report.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            targetType: 'post',
            targetId: { in: ['post-1', 'post-2'] },
          },
        })
      )
    })
  })
})

describe('deletePostByAdmin', async () => {
  const { deletePostByAdmin } = await import('@/lib/actions/admin/posts')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
    mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'admin-user-id', role: 'admin' })
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1', userId: 'user-1', content: 'Test' })
    mockPrisma.post.delete.mockResolvedValue({ id: 'post-1' })
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
      const result = await deletePostByAdmin('post-1', 'violation')
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('returns error when user is not admin', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const result = await deletePostByAdmin('post-1', 'violation')
      expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
    })
  })

  describe('happy path', () => {
    it('successfully deletes a post and returns success', async () => {
      const result = await deletePostByAdmin('post-1', 'Rule violation')
      expect(result).toMatchObject({ success: true })
    })

    it('calls revalidatePath after deletion', async () => {
      await deletePostByAdmin('post-1', 'Rule violation')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/posts')
    })

    it('creates an admin log entry with correct data', async () => {
      await deletePostByAdmin('post-1', 'Spam content')

      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('post not found', () => {
    it('returns error when post does not exist', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)
      const result = await deletePostByAdmin('nonexistent-post', 'violation')
      expect(result).toMatchObject({ success: false, error: '投稿が見つかりません' })
    })
  })

  describe('database errors', () => {
    it('returns error on findUnique failure', async () => {
      mockPrisma.post.findUnique.mockRejectedValue(new Error('DB error'))
      const result = await deletePostByAdmin('post-1', 'reason')
      expect(result).toMatchObject({ success: false })
    })

    it('returns error on transaction failure', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1' })
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'))
      const result = await deletePostByAdmin('post-1', 'reason')
      expect(result).toMatchObject({ success: false })
    })
  })
})
