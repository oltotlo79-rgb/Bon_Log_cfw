// @vitest-environment node
import { vi } from 'vitest'

// server-only をスキップ
vi.mock('server-only', () => ({}))

const mockFindMany = vi.fn()
const mockUpdate = vi.fn()
const mockTransaction = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    scheduledPost: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/lib/constants/status', () => ({
  SCHEDULED_POST_STATUS: {
    PENDING: 'pending',
    PUBLISHED: 'published',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
  },
}))

vi.mock('@/lib/constants/limits', () => ({
  CRON_BATCH_SIZE: 50,
}))

describe('publishDueScheduledPosts', async () => {
  const { publishDueScheduledPosts } = await import('@/lib/services/scheduled-post-publisher')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('公開対象がない場合 publishedCount:0 failedCount:0 を返す', async () => {
    mockFindMany.mockResolvedValueOnce([])

    const result = await publishDueScheduledPosts()

    expect(result).toEqual({ publishedCount: 0, failedCount: 0 })
    expect(mockFindMany).toHaveBeenCalledTimes(1)
  })

  it('pending 投稿を正常に公開し publishedCount をインクリメントする', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'sp-1',
        userId: 'user-1',
        content: '予約投稿の内容',
        user: { id: 'user-1', isSuspended: false },
        media: [],
        genres: [],
      },
    ])
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      const txMock = {
        post: { create: vi.fn().mockResolvedValue({ id: 'post-new' }) },
        postMedia: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
        postGenre: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
        scheduledPost: { update: vi.fn().mockResolvedValue({}) },
      }
      await fn(txMock)
    })

    const result = await publishDueScheduledPosts()

    expect(result.publishedCount).toBe(1)
    expect(result.failedCount).toBe(0)
  })

  it('メディアとジャンル付きの予約投稿を $transaction 経由で公開する', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'sp-media',
        userId: 'user-1',
        content: 'メディア付き',
        user: { id: 'user-1', isSuspended: false },
        media: [
          { url: 'https://cdn/image.jpg', type: 'image', sortOrder: 0 },
        ],
        genres: [{ genreId: 'genre-1' }],
      },
    ])

    let capturedTx: {
      post: { create: ReturnType<typeof vi.fn> }
      postMedia: { createMany: ReturnType<typeof vi.fn> }
      postGenre: { createMany: ReturnType<typeof vi.fn> }
      scheduledPost: { update: ReturnType<typeof vi.fn> }
    } | null = null
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      const txMock = {
        post: { create: vi.fn().mockResolvedValue({ id: 'post-with-media' }) },
        postMedia: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
        postGenre: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
        scheduledPost: { update: vi.fn().mockResolvedValue({}) },
      }
      capturedTx = txMock
      await fn(txMock)
    })

    const result = await publishDueScheduledPosts()

    expect(result.publishedCount).toBe(1)
    expect(capturedTx).not.toBeNull()
    expect(capturedTx!.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          content: 'メディア付き',
        }),
      })
    )
    expect(capturedTx!.postMedia?.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ url: 'https://cdn/image.jpg' }),
        ]),
      })
    )
    expect(capturedTx!.postGenre?.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ genreId: 'genre-1' }),
        ]),
      })
    )
  })

  it('isSuspended=true のユーザーの予約投稿は公開せず FAILED に更新する', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'sp-suspended',
        userId: 'user-suspended',
        content: '停止ユーザーの予約投稿',
        user: { id: 'user-suspended', isSuspended: true },
        media: [],
        genres: [],
      },
    ])
    mockUpdate.mockResolvedValueOnce({})

    const result = await publishDueScheduledPosts()

    expect(result.publishedCount).toBe(0)
    expect(result.failedCount).toBe(1)
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'sp-suspended' },
      data: { status: 'failed' },
    })
  })

  it('user が null（存在しない）の場合も FAILED に更新する', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'sp-no-user',
        userId: 'user-deleted',
        content: 'ユーザー不在の予約投稿',
        user: null,
        media: [],
        genres: [],
      },
    ])
    mockUpdate.mockResolvedValueOnce({})

    const result = await publishDueScheduledPosts()

    expect(result.publishedCount).toBe(0)
    expect(result.failedCount).toBe(1)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'sp-no-user' },
      data: { status: 'failed' },
    })
  })

  it('$transaction エラー時に FAILED に更新し failedCount をインクリメントする', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'sp-error',
        userId: 'user-1',
        content: 'エラーになる投稿',
        user: { id: 'user-1', isSuspended: false },
        media: [],
        genres: [],
      },
    ])
    mockTransaction.mockRejectedValueOnce(new Error('DB transaction failed'))
    mockUpdate.mockResolvedValueOnce({})

    const result = await publishDueScheduledPosts()

    expect(result.publishedCount).toBe(0)
    expect(result.failedCount).toBe(1)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'sp-error' },
      data: { status: 'failed' },
    })
  })

  it('一部が失敗しても残りの投稿を続けて処理する', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'sp-fail',
        userId: 'user-1',
        content: '失敗する投稿',
        user: { id: 'user-1', isSuspended: false },
        media: [],
        genres: [],
      },
      {
        id: 'sp-ok',
        userId: 'user-2',
        content: '成功する投稿',
        user: { id: 'user-2', isSuspended: false },
        media: [],
        genres: [],
      },
    ])

    let callCount = 0
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      callCount++
      if (callCount === 1) throw new Error('First transaction failed')
      const txMock = {
        post: { create: vi.fn().mockResolvedValue({ id: 'post-ok' }) },
        postMedia: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
        postGenre: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
        scheduledPost: { update: vi.fn().mockResolvedValue({}) },
      }
      await fn(txMock)
    })
    mockUpdate.mockResolvedValueOnce({})

    const result = await publishDueScheduledPosts()

    expect(result.publishedCount).toBe(1)
    expect(result.failedCount).toBe(1)
  })

  it('findMany に CRON_BATCH_SIZE を take として渡す', async () => {
    mockFindMany.mockResolvedValueOnce([])

    await publishDueScheduledPosts()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    )
  })

  it('findMany の where に status: pending と scheduledAt: lte を指定する', async () => {
    mockFindMany.mockResolvedValueOnce([])

    await publishDueScheduledPosts()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'pending',
          scheduledAt: expect.objectContaining({ lte: expect.any(Date) }),
        }),
      })
    )
  })

  it('ステータス更新が失敗しても握りつぶして failedCount はインクリメントされる', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'sp-update-fail',
        userId: 'user-1',
        content: 'ステータス更新失敗',
        user: { id: 'user-1', isSuspended: false },
        media: [],
        genres: [],
      },
    ])
    mockTransaction.mockRejectedValueOnce(new Error('Transaction failed'))
    mockUpdate.mockRejectedValueOnce(new Error('Update also failed'))

    const result = await publishDueScheduledPosts()

    expect(result.failedCount).toBe(1)
  })

  it('メディアなしの場合 postMedia.createMany が呼ばれない', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'sp-no-media',
        userId: 'user-1',
        content: 'メディアなし',
        user: { id: 'user-1', isSuspended: false },
        media: [],
        genres: [],
      },
    ])

    const mockMediaCreateMany = vi.fn()
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      const txMock = {
        post: { create: vi.fn().mockResolvedValue({ id: 'post-no-media' }) },
        postMedia: { createMany: mockMediaCreateMany },
        postGenre: { createMany: vi.fn().mockResolvedValue({}) },
        scheduledPost: { update: vi.fn().mockResolvedValue({}) },
      }
      await fn(txMock)
    })

    await publishDueScheduledPosts()

    expect(mockMediaCreateMany).not.toHaveBeenCalled()
  })

  it('ジャンルなしの場合 postGenre.createMany が呼ばれない', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'sp-no-genre',
        userId: 'user-1',
        content: 'ジャンルなし',
        user: { id: 'user-1', isSuspended: false },
        media: [],
        genres: [],
      },
    ])

    const mockGenreCreateMany = vi.fn()
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      const txMock = {
        post: { create: vi.fn().mockResolvedValue({ id: 'post-no-genre' }) },
        postMedia: { createMany: vi.fn().mockResolvedValue({}) },
        postGenre: { createMany: mockGenreCreateMany },
        scheduledPost: { update: vi.fn().mockResolvedValue({}) },
      }
      await fn(txMock)
    })

    await publishDueScheduledPosts()

    expect(mockGenreCreateMany).not.toHaveBeenCalled()
  })
})
