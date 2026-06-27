// @vitest-environment node
/**
 * lib/services/like-service のユニットテスト
 *
 * addPostLike / removePostLike / togglePostLikePrimitive の
 * 正常系・冪等性・不存在投稿・通知発火を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPost = { userId: 'author-id', isHidden: false }

const mockPrisma = {
  post: { findUnique: vi.fn() },
  like: {
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  follow: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockCanViewPostByAuthor = vi.fn()
vi.mock('@/lib/services/post-visibility', () => ({
  canViewPostByAuthor: (...args: unknown[]) => mockCanViewPostByAuthor(...args),
}))

const mockCreateNotification = vi.fn()
const mockDeleteNotification = vi.fn()
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  deleteNotification: (...args: unknown[]) => mockDeleteNotification(...args),
}))

const mockRecordLikeReceivedService = vi.fn()
vi.mock('@/lib/services/analytics-recording', () => ({
  recordLikeReceivedService: (...args: unknown[]) => mockRecordLikeReceivedService(...args),
}))

vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

describe('addPostLike', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.post.findUnique.mockResolvedValue(mockPost)
    mockCanViewPostByAuthor.mockResolvedValue(true)
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
    mockPrisma.like.findFirst.mockResolvedValue(null)
    mockPrisma.like.create.mockResolvedValue({})
    mockPrisma.like.count.mockResolvedValue(5)
    mockCreateNotification.mockResolvedValue(undefined)
    mockRecordLikeReceivedService.mockResolvedValue(undefined)
  })

  it('いいね付与 → { found: true, liked: true, likeCount }', async () => {
    const { addPostLike } = await import('@/lib/services/like-service')
    const result = await addPostLike('post-1', 'user-1')

    expect(result).toEqual({ found: true, liked: true, likeCount: 5 })
  })

  it('不存在投稿は { found: false }', async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce(null)
    const { addPostLike } = await import('@/lib/services/like-service')
    const result = await addPostLike('post-ghost', 'user-1')

    expect(result).toEqual({ found: false })
  })

  it('isHidden 投稿は { found: false }', async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({ userId: 'author-id', isHidden: true })
    const { addPostLike } = await import('@/lib/services/like-service')
    const result = await addPostLike('post-hidden', 'user-1')

    expect(result).toEqual({ found: false })
  })

  it('閲覧不可（canViewPostByAuthor false）は { found: false }', async () => {
    mockCanViewPostByAuthor.mockResolvedValueOnce(false)
    const { addPostLike } = await import('@/lib/services/like-service')
    const result = await addPostLike('post-1', 'user-1')

    expect(result).toEqual({ found: false })
  })

  it('既にいいね済みでも like.create を呼ばず { found: true, liked: true } を返す（冪等）', async () => {
    mockPrisma.like.findFirst.mockResolvedValueOnce({ id: 'like-existing' })
    const { addPostLike } = await import('@/lib/services/like-service')
    const result = await addPostLike('post-1', 'user-1')

    expect(result).toMatchObject({ found: true, liked: true })
    expect(mockPrisma.like.create).not.toHaveBeenCalled()
  })

  it('自分への投稿いいねでは通知を送らない', async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({ userId: 'user-1', isHidden: false })
    mockCreateNotification.mockResolvedValue(undefined)
    const { addPostLike } = await import('@/lib/services/like-service')
    await addPostLike('post-1', 'user-1')

    await new Promise((r) => setTimeout(r, 10))
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('他人の投稿にいいね → createNotification が like タイプで呼ばれる', async () => {
    mockCreateNotification.mockResolvedValue(undefined)
    const { addPostLike } = await import('@/lib/services/like-service')
    await addPostLike('post-1', 'user-liker')

    await new Promise((r) => setTimeout(r, 10))
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'like', postId: 'post-1' }),
    )
  })

  it('likeCount がいいね操作後の like.count の戻り値と一致する', async () => {
    mockPrisma.like.count.mockResolvedValueOnce(42)
    const { addPostLike } = await import('@/lib/services/like-service')
    const result = await addPostLike('post-1', 'user-1')

    expect((result as { likeCount: number }).likeCount).toBe(42)
  })

  it('新規いいね時は createNotification が1回呼ばれる', async () => {
    mockCreateNotification.mockResolvedValue(undefined)
    const { addPostLike } = await import('@/lib/services/like-service')
    await addPostLike('post-1', 'user-liker')

    await new Promise((r) => setTimeout(r, 10))
    expect(mockCreateNotification).toHaveBeenCalledTimes(1)
  })

  it('新規いいね時は recordLikeReceivedService が1回呼ばれる', async () => {
    mockRecordLikeReceivedService.mockResolvedValue(undefined)
    const { addPostLike } = await import('@/lib/services/like-service')
    await addPostLike('post-1', 'user-liker')

    await new Promise((r) => setTimeout(r, 10))
    expect(mockRecordLikeReceivedService).toHaveBeenCalledTimes(1)
    expect(mockRecordLikeReceivedService).toHaveBeenCalledWith('author-id')
  })

  it('既にいいね済みの場合 createNotification が呼ばれない（冪等副作用ゼロ）', async () => {
    mockPrisma.like.findFirst.mockResolvedValueOnce({ id: 'like-existing' })
    const { addPostLike } = await import('@/lib/services/like-service')
    await addPostLike('post-1', 'user-liker')

    await new Promise((r) => setTimeout(r, 10))
    expect(mockCreateNotification).toHaveBeenCalledTimes(0)
  })

  it('既にいいね済みの場合 recordLikeReceivedService が呼ばれない（冪等副作用ゼロ）', async () => {
    mockPrisma.like.findFirst.mockResolvedValueOnce({ id: 'like-existing' })
    const { addPostLike } = await import('@/lib/services/like-service')
    await addPostLike('post-1', 'user-liker')

    await new Promise((r) => setTimeout(r, 10))
    expect(mockRecordLikeReceivedService).toHaveBeenCalledTimes(0)
  })
})

describe('removePostLike', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.post.findUnique.mockResolvedValue(mockPost)
    mockCanViewPostByAuthor.mockResolvedValue(true)
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
    mockPrisma.like.findFirst.mockResolvedValue({ id: 'like-1' })
    mockPrisma.like.delete.mockResolvedValue({})
    mockPrisma.like.count.mockResolvedValue(4)
    mockDeleteNotification.mockResolvedValue(undefined)
  })

  it('いいね解除 → { found: true, liked: false, likeCount }', async () => {
    const { removePostLike } = await import('@/lib/services/like-service')
    const result = await removePostLike('post-1', 'user-1')

    expect(result).toEqual({ found: true, liked: false, likeCount: 4 })
  })

  it('不存在投稿は { found: false }', async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce(null)
    const { removePostLike } = await import('@/lib/services/like-service')
    const result = await removePostLike('post-ghost', 'user-1')

    expect(result).toEqual({ found: false })
  })

  it('いいねしていない場合は like.delete を呼ばず { found: true, liked: false } を返す（冪等）', async () => {
    mockPrisma.like.findFirst.mockResolvedValueOnce(null)
    const { removePostLike } = await import('@/lib/services/like-service')
    const result = await removePostLike('post-1', 'user-1')

    expect(result).toMatchObject({ found: true, liked: false })
    expect(mockPrisma.like.delete).not.toHaveBeenCalled()
  })

  it('他人の投稿いいね解除 → deleteNotification が like タイプで呼ばれる', async () => {
    mockDeleteNotification.mockResolvedValue(undefined)
    const { removePostLike } = await import('@/lib/services/like-service')
    await removePostLike('post-1', 'user-liker')

    await new Promise((r) => setTimeout(r, 10))
    expect(mockDeleteNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'like', postId: 'post-1' }),
    )
  })

  it('自分の投稿のいいね解除では deleteNotification を呼ばない', async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({ userId: 'user-1', isHidden: false })
    const { removePostLike } = await import('@/lib/services/like-service')
    await removePostLike('post-1', 'user-1')

    await new Promise((r) => setTimeout(r, 10))
    expect(mockDeleteNotification).not.toHaveBeenCalled()
  })

  it('likeCount が操作後の count 値と一致する', async () => {
    mockPrisma.like.count.mockResolvedValueOnce(0)
    const { removePostLike } = await import('@/lib/services/like-service')
    const result = await removePostLike('post-1', 'user-1')

    expect((result as { likeCount: number }).likeCount).toBe(0)
  })

  it('実際にいいね削除した場合 deleteNotification が1回呼ばれる（いいねあり）', async () => {
    mockDeleteNotification.mockResolvedValue(undefined)
    const { removePostLike } = await import('@/lib/services/like-service')
    await removePostLike('post-1', 'user-liker')

    await new Promise((r) => setTimeout(r, 10))
    expect(mockDeleteNotification).toHaveBeenCalledTimes(1)
  })

  it('いいねなし状態への再送では deleteNotification が呼ばれない（冪等副作用ゼロ）', async () => {
    mockPrisma.like.findFirst.mockResolvedValueOnce(null)
    const { removePostLike } = await import('@/lib/services/like-service')
    await removePostLike('post-1', 'user-liker')

    await new Promise((r) => setTimeout(r, 10))
    expect(mockDeleteNotification).toHaveBeenCalledTimes(0)
  })
})

describe('togglePostLikePrimitive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.post.findUnique.mockResolvedValue(mockPost)
    mockCanViewPostByAuthor.mockResolvedValue(true)
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<boolean>) => fn(mockPrisma),
    )
    mockPrisma.like.findFirst.mockResolvedValue(null)
    mockPrisma.like.create.mockResolvedValue({})
    mockPrisma.like.delete.mockResolvedValue({})
    mockPrisma.like.count.mockResolvedValue(6)
    mockCreateNotification.mockResolvedValue(undefined)
    mockDeleteNotification.mockResolvedValue(undefined)
    mockRecordLikeReceivedService.mockResolvedValue(undefined)
  })

  it('未いいねの場合 like.create を呼んで liked: true を返す', async () => {
    const { togglePostLikePrimitive } = await import('@/lib/services/like-service')
    const result = await togglePostLikePrimitive('post-1', 'user-liker')

    expect(result).toMatchObject({ found: true, liked: true })
    expect(mockPrisma.like.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.like.delete).not.toHaveBeenCalled()
  })

  it('いいね済みの場合 like.delete を呼んで liked: false を返す', async () => {
    mockPrisma.like.findFirst.mockResolvedValueOnce({ id: 'like-existing' })
    const { togglePostLikePrimitive } = await import('@/lib/services/like-service')
    const result = await togglePostLikePrimitive('post-1', 'user-liker')

    expect(result).toMatchObject({ found: true, liked: false })
    expect(mockPrisma.like.delete).toHaveBeenCalledWith({ where: { id: 'like-existing' } })
    expect(mockPrisma.like.create).not.toHaveBeenCalled()
  })

  it('不存在投稿は { found: false }', async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce(null)
    const { togglePostLikePrimitive } = await import('@/lib/services/like-service')
    const result = await togglePostLikePrimitive('post-ghost', 'user-1')

    expect(result).toEqual({ found: false })
  })

  it('isHidden 投稿は { found: false }', async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({ userId: 'author-id', isHidden: true })
    const { togglePostLikePrimitive } = await import('@/lib/services/like-service')
    const result = await togglePostLikePrimitive('post-1', 'user-1')

    expect(result).toEqual({ found: false })
  })

  it('閲覧不可（canViewPostByAuthor false）は { found: false }', async () => {
    mockCanViewPostByAuthor.mockResolvedValueOnce(false)
    const { togglePostLikePrimitive } = await import('@/lib/services/like-service')
    const result = await togglePostLikePrimitive('post-1', 'user-1')

    expect(result).toEqual({ found: false })
  })

  it('他人の投稿へいいね（liked=true）: createNotification と recordLikeReceivedService が呼ばれる', async () => {
    const { togglePostLikePrimitive } = await import('@/lib/services/like-service')
    await togglePostLikePrimitive('post-1', 'user-liker')

    await new Promise((r) => setTimeout(r, 10))
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'like', postId: 'post-1' }),
    )
    expect(mockRecordLikeReceivedService).toHaveBeenCalledWith('author-id')
  })

  it('他人の投稿のいいね解除（liked=false）: deleteNotification が呼ばれる', async () => {
    mockPrisma.like.findFirst.mockResolvedValueOnce({ id: 'like-existing' })
    const { togglePostLikePrimitive } = await import('@/lib/services/like-service')
    await togglePostLikePrimitive('post-1', 'user-liker')

    await new Promise((r) => setTimeout(r, 10))
    expect(mockDeleteNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'like', postId: 'post-1' }),
    )
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('自分の投稿トグルでは通知は送らない（post.userId === userId）', async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({ userId: 'user-self', isHidden: false })
    const { togglePostLikePrimitive } = await import('@/lib/services/like-service')
    await togglePostLikePrimitive('post-1', 'user-self')

    await new Promise((r) => setTimeout(r, 10))
    expect(mockCreateNotification).not.toHaveBeenCalled()
    expect(mockDeleteNotification).not.toHaveBeenCalled()
    expect(mockRecordLikeReceivedService).not.toHaveBeenCalled()
  })

  it('likeCount が操作後の count 値と一致する', async () => {
    mockPrisma.like.count.mockResolvedValueOnce(10)
    const { togglePostLikePrimitive } = await import('@/lib/services/like-service')
    const result = await togglePostLikePrimitive('post-1', 'user-liker')

    expect((result as { likeCount: number }).likeCount).toBe(10)
  })
})

describe('removePostLike — 追加ガードケース', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.post.findUnique.mockResolvedValue(mockPost)
    mockCanViewPostByAuthor.mockResolvedValue(true)
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
    mockPrisma.like.findFirst.mockResolvedValue({ id: 'like-1' })
    mockPrisma.like.delete.mockResolvedValue({})
    mockPrisma.like.count.mockResolvedValue(4)
    mockDeleteNotification.mockResolvedValue(undefined)
  })

  it('isHidden 投稿は { found: false }', async () => {
    mockPrisma.post.findUnique.mockResolvedValueOnce({ userId: 'author-id', isHidden: true })
    const { removePostLike } = await import('@/lib/services/like-service')
    const result = await removePostLike('post-hidden', 'user-1')

    expect(result).toEqual({ found: false })
  })

  it('閲覧不可（canViewPostByAuthor false）は { found: false }', async () => {
    mockCanViewPostByAuthor.mockResolvedValueOnce(false)
    const { removePostLike } = await import('@/lib/services/like-service')
    const result = await removePostLike('post-1', 'user-1')

    expect(result).toEqual({ found: false })
  })
})

describe('通知エラーハンドラー', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.post.findUnique.mockResolvedValue(mockPost)
    mockCanViewPostByAuthor.mockResolvedValue(true)
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
    mockPrisma.like.findFirst.mockResolvedValue(null)
    mockPrisma.like.create.mockResolvedValue({})
    mockPrisma.like.delete.mockResolvedValue({})
    mockPrisma.like.count.mockResolvedValue(5)
  })

  it('addPostLike: createNotification が例外をスローしても { found: true } を返す（エラー握りつぶし）', async () => {
    mockCreateNotification.mockRejectedValue(new Error('通知失敗'))
    mockRecordLikeReceivedService.mockResolvedValue(undefined)

    const { addPostLike } = await import('@/lib/services/like-service')
    const result = await addPostLike('post-1', 'user-liker')

    expect(result).toMatchObject({ found: true, liked: true })
    await new Promise((r) => setTimeout(r, 20))
  })

  it('addPostLike: recordLikeReceivedService が例外をスローしても { found: true } を返す', async () => {
    mockCreateNotification.mockResolvedValue(undefined)
    mockRecordLikeReceivedService.mockRejectedValue(new Error('analytics失敗'))

    const { addPostLike } = await import('@/lib/services/like-service')
    const result = await addPostLike('post-1', 'user-liker')

    expect(result).toMatchObject({ found: true, liked: true })
    await new Promise((r) => setTimeout(r, 20))
  })

  it('removePostLike: deleteNotification が例外をスローしても { found: true } を返す', async () => {
    mockPrisma.like.findFirst.mockResolvedValue({ id: 'like-1' })
    mockDeleteNotification.mockRejectedValue(new Error('通知削除失敗'))

    const { removePostLike } = await import('@/lib/services/like-service')
    const result = await removePostLike('post-1', 'user-liker')

    expect(result).toMatchObject({ found: true, liked: false })
    await new Promise((r) => setTimeout(r, 20))
  })

  it('togglePostLikePrimitive: createNotification が例外をスローしても { found: true } を返す', async () => {
    mockCreateNotification.mockRejectedValue(new Error('通知失敗'))
    mockRecordLikeReceivedService.mockResolvedValue(undefined)

    const { togglePostLikePrimitive } = await import('@/lib/services/like-service')
    const result = await togglePostLikePrimitive('post-1', 'user-liker')

    expect(result).toMatchObject({ found: true, liked: true })
    await new Promise((r) => setTimeout(r, 20))
  })

  it('togglePostLikePrimitive: recordLikeReceivedService が例外をスローしても { found: true } を返す', async () => {
    mockCreateNotification.mockResolvedValue(undefined)
    mockRecordLikeReceivedService.mockRejectedValue(new Error('analytics失敗'))

    const { togglePostLikePrimitive } = await import('@/lib/services/like-service')
    const result = await togglePostLikePrimitive('post-1', 'user-liker')

    expect(result).toMatchObject({ found: true, liked: true })
    await new Promise((r) => setTimeout(r, 20))
  })

  it('togglePostLikePrimitive: deleteNotification が例外をスローしても { found: true } を返す（解除時）', async () => {
    mockPrisma.like.findFirst.mockResolvedValue({ id: 'like-existing' })
    mockDeleteNotification.mockRejectedValue(new Error('通知削除失敗'))

    const { togglePostLikePrimitive } = await import('@/lib/services/like-service')
    const result = await togglePostLikePrimitive('post-1', 'user-liker')

    expect(result).toMatchObject({ found: true, liked: false })
    await new Promise((r) => setTimeout(r, 20))
  })
})
