// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const VIEWER = 'viewer-id'
const AUTHOR = 'author-id'

describe('post-visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('canViewAuthorContent', () => {
    it('本人は常に閲覧できる（停止・非公開でも）', async () => {
      const { canViewAuthorContent } = await import('@/lib/services/post-visibility')
      const result = await canViewAuthorContent(AUTHOR, AUTHOR, { isPublic: false, isSuspended: true })
      expect(result).toBe(true)
      expect(mockPrisma.follow.findUnique).not.toHaveBeenCalled()
    })

    it('停止ユーザーは本人以外には不可', async () => {
      const { canViewAuthorContent } = await import('@/lib/services/post-visibility')
      expect(await canViewAuthorContent(VIEWER, AUTHOR, { isPublic: true, isSuspended: true })).toBe(false)
    })

    it('公開アカウントは誰でも閲覧可', async () => {
      const { canViewAuthorContent } = await import('@/lib/services/post-visibility')
      expect(await canViewAuthorContent(undefined, AUTHOR, { isPublic: true, isSuspended: false })).toBe(true)
    })

    it('非公開アカウントは未ログインには不可', async () => {
      const { canViewAuthorContent } = await import('@/lib/services/post-visibility')
      expect(await canViewAuthorContent(undefined, AUTHOR, { isPublic: false, isSuspended: false })).toBe(false)
    })

    it('非公開アカウントはフォロワーには可', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue({ followerId: VIEWER })
      const { canViewAuthorContent } = await import('@/lib/services/post-visibility')
      expect(await canViewAuthorContent(VIEWER, AUTHOR, { isPublic: false, isSuspended: false })).toBe(true)
    })

    it('非公開アカウントは非フォロワーには不可', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      const { canViewAuthorContent } = await import('@/lib/services/post-visibility')
      expect(await canViewAuthorContent(VIEWER, AUTHOR, { isPublic: false, isSuspended: false })).toBe(false)
    })
  })

  describe('canViewPostByAuthor', () => {
    it('著者が存在しなければ不可', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const { canViewPostByAuthor } = await import('@/lib/services/post-visibility')
      expect(await canViewPostByAuthor(VIEWER, AUTHOR)).toBe(false)
    })

    it('本人なら著者照会せず可', async () => {
      const { canViewPostByAuthor } = await import('@/lib/services/post-visibility')
      expect(await canViewPostByAuthor(AUTHOR, AUTHOR)).toBe(true)
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('公開著者は閲覧可', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: true, isSuspended: false })
      const { canViewPostByAuthor } = await import('@/lib/services/post-visibility')
      expect(await canViewPostByAuthor(VIEWER, AUTHOR)).toBe(true)
    })
  })

  describe('assertCanViewPost', () => {
    it('投稿が存在しなければ不可', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)
      const { assertCanViewPost } = await import('@/lib/services/post-visibility')
      expect(await assertCanViewPost(VIEWER, 'post-id')).toBe(false)
    })

    it('非表示投稿は不可', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ isHidden: true, userId: AUTHOR })
      const { assertCanViewPost } = await import('@/lib/services/post-visibility')
      expect(await assertCanViewPost(VIEWER, 'post-id')).toBe(false)
    })

    it('停止著者の投稿は本人以外不可', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ isHidden: false, userId: AUTHOR })
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: true, isSuspended: true })
      const { assertCanViewPost } = await import('@/lib/services/post-visibility')
      expect(await assertCanViewPost(VIEWER, 'post-id')).toBe(false)
    })

    it('公開著者の表示投稿は可', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ isHidden: false, userId: AUTHOR })
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: true, isSuspended: false })
      const { assertCanViewPost } = await import('@/lib/services/post-visibility')
      expect(await assertCanViewPost(VIEWER, 'post-id')).toBe(true)
    })
  })

  describe('visibleAuthorFilter / visiblePostWhere / visibleUserWhere', () => {
    it('未ログインは公開かつ非停止のみ', async () => {
      const { visibleAuthorFilter } = await import('@/lib/services/post-visibility')
      expect(visibleAuthorFilter()).toEqual({ isSuspended: false, OR: [{ isPublic: true }] })
    })

    it('ログイン時は自分自身・フォロー中の非公開も含む', async () => {
      const { visibleAuthorFilter } = await import('@/lib/services/post-visibility')
      expect(visibleAuthorFilter(VIEWER)).toEqual({
        isSuspended: false,
        OR: [
          { isPublic: true },
          { id: VIEWER },
          { followers: { some: { followerId: VIEWER } } },
        ],
      })
    })

    it('visiblePostWhere は非表示除外と著者条件を合成する', async () => {
      const { visiblePostWhere } = await import('@/lib/services/post-visibility')
      expect(visiblePostWhere()).toEqual({
        isHidden: false,
        user: { isSuspended: false, OR: [{ isPublic: true }] },
      })
    })

    it('visibleUserWhere は visibleAuthorFilter と同一', async () => {
      const { visibleUserWhere, visibleAuthorFilter } = await import('@/lib/services/post-visibility')
      expect(visibleUserWhere(VIEWER)).toEqual(visibleAuthorFilter(VIEWER))
    })
  })

  describe('getVisiblePostIds', () => {
    it('空配列なら DB を引かず空 Set を返す', async () => {
      const { getVisiblePostIds } = await import('@/lib/services/post-visibility')
      const result = await getVisiblePostIds(VIEWER, [])
      expect(result.size).toBe(0)
      expect(mockPrisma.post.findMany).not.toHaveBeenCalled()
    })

    it('visiblePostWhere で絞った可視 ID のみ返す', async () => {
      mockPrisma.post.findMany.mockResolvedValue([{ id: 'a' }, { id: 'c' }])
      const { getVisiblePostIds } = await import('@/lib/services/post-visibility')
      const result = await getVisiblePostIds(VIEWER, ['a', 'b', 'c'])
      expect([...result].sort()).toEqual(['a', 'c'])
      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: ['a', 'b', 'c'] }, isHidden: false }),
          select: { id: true },
        }),
      )
    })
  })

  describe('redactNonVisibleNestedPosts', () => {
    it('不可視な引用元/リポスト元を null に落とす', async () => {
      mockPrisma.post.findMany.mockResolvedValue([{ id: 'visible-quote' }])
      const { redactNonVisibleNestedPosts } = await import('@/lib/services/post-visibility')
      const posts = [
        { id: 'p1', repostPostId: null, quotePost: { id: 'visible-quote' }, repostPost: null },
        { id: 'p2', repostPostId: null, quotePost: { id: 'hidden-quote' }, repostPost: null },
      ]
      const result = await redactNonVisibleNestedPosts(VIEWER, posts)
      expect(result).toHaveLength(2)
      expect(result[0]!.quotePost).toEqual({ id: 'visible-quote' })
      expect(result[1]!.quotePost).toBeNull()
    })

    it('純粋リポストで対象が不可視なら一覧から除外する', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])
      const { redactNonVisibleNestedPosts } = await import('@/lib/services/post-visibility')
      const posts = [
        { id: 'repost-row', repostPostId: 'gone', quotePost: null, repostPost: { id: 'gone' } },
        { id: 'normal', repostPostId: null, quotePost: null, repostPost: null },
      ]
      const result = await redactNonVisibleNestedPosts(VIEWER, posts)
      expect(result.map((p) => p.id)).toEqual(['normal'])
    })

    it('ネストが無ければ DB を引かずそのまま返す', async () => {
      const { redactNonVisibleNestedPosts } = await import('@/lib/services/post-visibility')
      const posts = [{ id: 'p1', repostPostId: null, quotePost: null, repostPost: null }]
      const result = await redactNonVisibleNestedPosts(VIEWER, posts)
      expect(result).toHaveLength(1)
      expect(mockPrisma.post.findMany).not.toHaveBeenCalled()
    })
  })
})
