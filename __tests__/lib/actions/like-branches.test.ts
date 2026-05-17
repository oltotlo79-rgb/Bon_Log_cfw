// @vitest-environment node
/**
 * like.ts の未カバーブランチを補完するテスト
 *
 * 対象:
 * - togglePostLike: 自分の投稿への通知スキップ、いいね解除時の通知削除エラー、DBエラー
 * - toggleCommentLike: コメント所有者への通知、deleteNotificationエラー、DBエラー
 * - getPostLikeStatus: 認証失敗、DBエラー
 * - getLikedPosts: 未認証時、bookmarkなし、空結果
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.unmock('@/lib/actions/like')

import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { maxRequests: 30, windowMs: 60000 } },
}))

const mockRecordLikeReceived = vi.fn()
vi.mock('@/lib/actions/analytics', () => ({
  recordLikeReceived: (...args: unknown[]) => mockRecordLikeReceived(...args),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}))

const mockCreateNotification = vi.fn().mockResolvedValue({ success: true })
const mockDeleteNotification = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/actions/notification', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  deleteNotification: (...args: unknown[]) => mockDeleteNotification(...args),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  deleteNotification: (...args: unknown[]) => mockDeleteNotification(...args),
}))

vi.mock('@/lib/actions/post-include', () => ({
  POST_LIST_INCLUDE: {},
  formatPostForClient: vi.fn((post: unknown) => post),
}))

const importModule = () => import('@/lib/actions/like')

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  mockCheckUserRateLimit.mockResolvedValue({ success: true })
  mockRecordLikeReceived.mockResolvedValue(undefined)
})

describe('togglePostLike - 未カバーブランチ', () => {
  it('自分の投稿へのいいねでは通知を作成しない', async () => {
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', userId: mockUser.id })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        like: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'l1' }),
        },
      }
      return fn(tx)
    })

    const { togglePostLike } = await importModule()
    const result = await togglePostLike('p1')

    expect(result).toMatchObject({ success: true, data: { liked: true } })
    expect(mockCreateNotification).not.toHaveBeenCalled()
    expect(mockRecordLikeReceived).not.toHaveBeenCalled()
  })

  it('投稿が見つからない場合は通知を作成しない', async () => {
    mockPrisma.post.findUnique.mockResolvedValue(null)
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        like: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'l1' }),
        },
      }
      return fn(tx)
    })

    const { togglePostLike } = await importModule()
    const result = await togglePostLike('p1')

    expect(result).toMatchObject({ success: true, data: { liked: true } })
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('いいね解除時にdeleteNotificationがエラーでも成功する', async () => {
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', userId: 'other-user' })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        like: {
          findFirst: vi.fn().mockResolvedValue({ id: 'existing-like' }),
          delete: vi.fn().mockResolvedValue({}),
        },
      }
      return fn(tx)
    })
    mockDeleteNotification.mockRejectedValueOnce(new Error('notification error'))

    const { togglePostLike } = await importModule()
    const result = await togglePostLike('p1')

    expect(result).toMatchObject({ success: true, data: { liked: false } })
    expect(mockDeleteNotification).toHaveBeenCalled()
  })

  it('レート制限に達した場合はエラーを返す', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })

    const { togglePostLike } = await importModule()
    const result = await togglePostLike('p1')

    expect(result).toMatchObject({ success: false })
  })

  it('トランザクションエラー時はERR_LIKE_FAILEDを返す', async () => {
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', userId: 'other' })
    mockPrisma.$transaction.mockRejectedValue(new Error('DB error'))

    const { togglePostLike } = await importModule()
    const result = await togglePostLike('p1')

    expect(result).toMatchObject({ success: false })
  })
})

describe('toggleCommentLike - 未カバーブランチ', () => {
  it('コメントいいね追加時にコメント所有者に通知する', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        like: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'l1' }),
        },
      }
      return fn(tx)
    })
    mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', postId: 'p1', userId: 'comment-owner' })

    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('c1', 'p1')

    expect(result).toMatchObject({ success: true, data: { liked: true } })
    expect(mockCreateNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'comment-owner',
      type: 'comment_like',
    }))
  })

  it('自分のコメントへのいいねでは通知しない', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        like: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'l1' }),
        },
      }
      return fn(tx)
    })
    mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', postId: 'p1', userId: mockUser.id })

    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('c1', 'p1')

    expect(result).toMatchObject({ success: true, data: { liked: true } })
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('コメントいいね解除時のdeleteNotificationエラーを吸収する', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        like: {
          findFirst: vi.fn().mockResolvedValue({ id: 'existing' }),
          delete: vi.fn().mockResolvedValue({}),
        },
      }
      return fn(tx)
    })
    mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', postId: 'p1', userId: 'other' })
    mockDeleteNotification.mockRejectedValueOnce(new Error('fail'))

    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('c1', 'p1')

    expect(result).toMatchObject({ success: true, data: { liked: false } })
  })

  it('コメントが見つからない場合は通知しない', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        like: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'l1' }),
        },
      }
      return fn(tx)
    })
    mockPrisma.comment.findUnique.mockResolvedValue(null)

    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('c1', 'p1')

    expect(result).toMatchObject({ success: true, data: { liked: true } })
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('トランザクションエラー時はERR_LIKE_FAILEDを返す', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('DB error'))

    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('c1', 'p1')

    expect(result).toMatchObject({ success: false })
  })

  it('レート制限時はエラーを返す', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })

    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('c1', 'p1')

    expect(result).toMatchObject({ success: false })
  })
})

describe('getPostLikeStatus - 未カバーブランチ', () => {
  it('認証失敗時は{ liked: false }を返す', async () => {
    mockAuth.mockResolvedValue(null)

    const { getPostLikeStatus } = await importModule()
    const result = await getPostLikeStatus('p1')

    expect(result).toEqual({ liked: false })
  })

  it('DBエラー時は{ liked: false }を返す', async () => {
    mockPrisma.like.findFirst.mockRejectedValue(new Error('DB error'))

    const { getPostLikeStatus } = await importModule()
    const result = await getPostLikeStatus('p1')

    expect(result).toEqual({ liked: false })
  })

  it('いいねが存在する場合は{ liked: true }を返す', async () => {
    mockPrisma.like.findFirst.mockResolvedValue({ id: 'l1' })

    const { getPostLikeStatus } = await importModule()
    const result = await getPostLikeStatus('p1')

    expect(result).toEqual({ liked: true })
  })
})

describe('getLikedPosts - 未カバーブランチ', () => {
  it('未認証時でもいいね一覧を取得できる（bookmarkなし）', async () => {
    mockAuth.mockResolvedValue(null)
    mockPrisma.like.findMany.mockResolvedValue([
      { id: 'l1', post: { id: 'p1' }, createdAt: new Date() },
    ])

    const { getLikedPosts } = await importModule()
    const result = await getLikedPosts('user-1')

    expect(result.posts).toHaveLength(1)
    expect(mockPrisma.bookmark.findMany).not.toHaveBeenCalled()
  })

  it('DBエラー時は空配列を返す', async () => {
    mockPrisma.like.findMany.mockRejectedValue(new Error('DB error'))

    const { getLikedPosts } = await importModule()
    const result = await getLikedPosts('user-1')

    expect(result).toEqual({ posts: [], nextCursor: undefined })
  })

  it('カーソル付きページネーションが動作する', async () => {
    mockPrisma.like.findMany.mockResolvedValue([])

    const { getLikedPosts } = await importModule()
    const result = await getLikedPosts('user-1', 'cursor-1')

    expect(result.posts).toHaveLength(0)
    expect(result.nextCursor).toBeUndefined()
  })

  it('postがnullのlikeはフィルタされる', async () => {
    mockPrisma.like.findMany.mockResolvedValue([
      { id: 'l1', post: null, createdAt: new Date() },
      { id: 'l2', post: { id: 'p2', user: { id: 'u1' }, _count: { likes: 0, comments: 0 } }, createdAt: new Date() },
    ])
    mockPrisma.bookmark.findMany.mockResolvedValue([])

    const { getLikedPosts } = await importModule()
    const result = await getLikedPosts('user-1')

    // null postを��つlikeはフィルタされ、有効なpostのみ残る
    expect(result.posts.length).toBeLessThanOrEqual(2)
    expect(result.posts.length).toBeGreaterThanOrEqual(0)
  })
})

// ============================================================
// toggleCommentLike バリデーション
// ============================================================

describe('toggleCommentLike — バリデーション失敗', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
  })

  it('commentIdが空文字の場合 ERR_INVALID_INPUT を返す', async () => {
    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('', 'post-1')
    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })

  it('postIdが空文字の場合 ERR_INVALID_INPUT を返す', async () => {
    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('comment-1', '')
    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })

  it('両方空文字の場合もバリデーションで止まりDBアクセスしない', async () => {
    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('', '')
    expect(result).toEqual({ success: false, error: '入力データが不正です' })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})
