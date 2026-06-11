// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockPost } from '../../utils/test-utils'

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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

describe('Bookmark Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    // 対象投稿は閲覧可能（本人の非表示でない投稿）を既定とする
    mockPrisma.post.findUnique.mockResolvedValue({
      id: mockPost.id,
      isHidden: false,
      userId: mockUser.id,
    })
  })

  describe('toggleBookmark', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { toggleBookmark } = await import('@/lib/actions/bookmark')
      const result = await toggleBookmark('post-id')

      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('ブックマークしていない場合は追加する', async () => {
      mockPrisma.bookmark.findUnique.mockResolvedValue(null)
      mockPrisma.bookmark.create.mockResolvedValue({
        id: 'bookmark-1',
        postId: 'post-id',
        userId: mockUser.id,
      })

      const { toggleBookmark } = await import('@/lib/actions/bookmark')
      const result = await toggleBookmark('post-id')

      expect(result).toEqual({ success: true, data: { bookmarked: true } })
      expect(mockPrisma.bookmark.create).toHaveBeenCalled()
    })

    it('ブックマーク済みの場合は解除する', async () => {
      mockPrisma.bookmark.findUnique.mockResolvedValue({
        id: 'bookmark-1',
        postId: 'post-id',
        userId: mockUser.id,
      })
      mockPrisma.bookmark.delete.mockResolvedValue({})

      const { toggleBookmark } = await import('@/lib/actions/bookmark')
      const result = await toggleBookmark('post-id')

      expect(result).toEqual({ success: true, data: { bookmarked: false } })
      expect(mockPrisma.bookmark.delete).toHaveBeenCalled()
    })
  })

  describe('getBookmarkStatus', async () => {
    it('ブックマーク状態を取得できる（ブックマーク済み）', async () => {
      mockPrisma.bookmark.findUnique.mockResolvedValue({
        id: 'bookmark-1',
        postId: 'post-id',
        userId: mockUser.id,
      })

      const { getBookmarkStatus } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkStatus('post-id')

      expect(result.bookmarked).toBe(true)
    })

    it('ブックマーク状態を取得できる（未ブックマーク）', async () => {
      mockPrisma.bookmark.findUnique.mockResolvedValue(null)

      const { getBookmarkStatus } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkStatus('post-id')

      expect(result.bookmarked).toBe(false)
    })

    it('未認証の場合はfalseを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getBookmarkStatus } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkStatus('post-id')

      expect(result.bookmarked).toBe(false)
    })
  })

  describe('getBookmarkedPosts', async () => {
    it('認証なしの場合は空のリストを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getBookmarkedPosts } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkedPosts()

      expect(result.posts).toEqual([])
      expect(result.nextCursor).toBeUndefined()
    })

    it('ブックマーク一覧を取得できる', async () => {
      const mockBookmarks = [
        {
          id: 'bookmark-1',
          postId: mockPost.id,
          userId: mockUser.id,
          post: {
            ...mockPost,
            _count: { likes: 5, comments: 3 },
            genres: [{ genre: { id: 'genre-1', name: '松柏類', category: '松柏類' } }],
          },
        },
      ]
      mockPrisma.bookmark.findMany.mockResolvedValue(mockBookmarks)
      mockPrisma.like.findMany.mockResolvedValue([])

      const { getBookmarkedPosts } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkedPosts()

      expect(result.posts).toHaveLength(1)
      expect(result.posts[0]!.id).toBe(mockPost.id)
      expect(result.posts[0]!.isBookmarked).toBe(true)
    })

    it('空のブックマーク一覧を取得できる', async () => {
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getBookmarkedPosts } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkedPosts()

      expect(result.posts).toHaveLength(0)
    })

    it('カーソルベースのページネーションが正しく動作する', async () => {
      const mockBookmarks = [
        {
          id: 'bookmark-2',
          postId: 'post-2',
          userId: mockUser.id,
          post: {
            ...mockPost,
            id: 'post-2',
            _count: { likes: 2, comments: 1 },
            genres: [],
          },
        },
      ]
      mockPrisma.bookmark.findMany.mockResolvedValue(mockBookmarks)
      mockPrisma.like.findMany.mockResolvedValue([])

      const { getBookmarkedPosts } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkedPosts('bookmark-1', 10)

      expect(result.posts).toHaveLength(1)
      expect(mockPrisma.bookmark.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'bookmark-1' },
          skip: 1,
          take: 10,
        }),
      )
    })

    it('巨大な limit は MAX_PAGE_LIMIT にクランプする（DoS 対策）', async () => {
      const { MAX_PAGE_LIMIT } = await import('@/lib/constants/limits')
      mockPrisma.bookmark.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])

      const { getBookmarkedPosts } = await import('@/lib/actions/bookmark')
      await getBookmarkedPosts(undefined, 1_000_000)

      expect(mockPrisma.bookmark.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: MAX_PAGE_LIMIT }),
      )
    })

    it('対象投稿の可視性で絞り込む（M-3: 非表示/非公開/停止著者を除外）', async () => {
      mockPrisma.bookmark.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])

      const { getBookmarkedPosts } = await import('@/lib/actions/bookmark')
      await getBookmarkedPosts()

      expect(mockPrisma.bookmark.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: mockUser.id,
            post: { isHidden: false, user: { isSuspended: false, OR: [{ isPublic: true }, { id: mockUser.id }, { followers: { some: { followerId: mockUser.id } } }] } },
          },
        }),
      )
    })
  })

  describe('toggleBookmark - edge cases', async () => {
    it('空のpostIdを渡すと入力不正エラーを返す', async () => {
      const { toggleBookmark } = await import('@/lib/actions/bookmark')
      const result = await toggleBookmark('')

      expect(result).toEqual({ success: false, error: '入力データが不正です' })
    })

    it('トランザクションが例外をスローするとブックマーク失敗エラーを返す', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'))

      const { toggleBookmark } = await import('@/lib/actions/bookmark')
      const result = await toggleBookmark('post-id')

      expect(result).toEqual({ success: false, error: 'ブックマーク操作に失敗しました' })
    })

    it('ブックマーク解除時に { bookmarked: false } を返す', async () => {
      mockPrisma.$transaction.mockResolvedValue(false)

      const { toggleBookmark } = await import('@/lib/actions/bookmark')
      const result = await toggleBookmark('post-id')

      expect(result).toEqual({ success: true, data: { bookmarked: false } })
    })
  })

  describe('getBookmarkStatus - edge cases', async () => {
    it('未認証の場合は { bookmarked: false } を返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getBookmarkStatus } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkStatus('post-id')

      expect(result).toEqual({ bookmarked: false })
    })

    it('DBエラー時は { bookmarked: false } を返す', async () => {
      mockPrisma.bookmark.findUnique.mockRejectedValue(new Error('DB error'))

      const { getBookmarkStatus } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkStatus('post-id')

      expect(result).toEqual({ bookmarked: false })
    })
  })

  describe('getBookmarkedPosts - edge cases', async () => {
    it('未認証の場合は空の結果を返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getBookmarkedPosts } = await import('@/lib/actions/bookmark')
      const result = await getBookmarkedPosts()

      expect(result).toEqual({ posts: [], nextCursor: undefined })
    })
  })
})
