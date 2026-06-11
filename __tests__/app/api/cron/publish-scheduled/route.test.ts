// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    scheduledPost: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    post: { create: vi.fn() },
    postMedia: { createMany: vi.fn() },
    postGenre: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/cron-auth', () => ({
  verifyCronAuth: vi.fn(),
}))

vi.mock('@/lib/constants/limits', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/constants/limits')>()
  return { ...actual, CRON_BATCH_SIZE: 50, CRON_FUNCTION_TIMEOUT_SECONDS: 60 }
})

vi.mock('@/lib/premium', () => ({
  getMembershipLimits: vi.fn().mockResolvedValue({ maxPostLength: 500, maxImages: 4, maxVideos: 0, maxDailyPosts: 20, canSchedulePost: false, canViewAnalytics: false }),
  isPremiumUser: vi.fn().mockResolvedValue(false),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ allowed: true, count: 0, limit: 50 }),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {},
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))

vi.mock('@/lib/constants/status', () => ({
  SCHEDULED_POST_STATUS: {
    PENDING: 'pending',
    PUBLISHED: 'published',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
  },
}))

vi.mock('@/lib/constants/errors', () => ({
  API_ERR_UNAUTHORIZED: 'Unauthorized',
  API_ERR_INTERNAL_SERVER_ERROR: 'Internal server error',
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

function createRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/publish-scheduled', {
    method: 'GET',
    headers: {
      authorization: 'Bearer test-signature',
      'x-cron-timestamp': String(Date.now()),
    },
  })
}

describe('GET /api/cron/publish-scheduled', async () => {
  const { prisma } = await import('@/lib/db')
  const { verifyCronAuth } = await import('@/lib/cron-auth')

  const mockVerify = verifyCronAuth as ReturnType<typeof vi.fn>
  const mockFindMany = prisma.scheduledPost.findMany as ReturnType<typeof vi.fn>
  const mockUpdate = prisma.scheduledPost.update as ReturnType<typeof vi.fn>
  const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('認証失敗時に401を返す', async () => {
    mockVerify.mockReturnValue({ valid: false, error: 'Invalid signature' })

    const { GET } = await import('@/app/api/cron/publish-scheduled/route')
    const response = await GET(createRequest())

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Invalid signature')
  })

  it('公開対象の投稿がない場合 publishedCount:0 を返す', async () => {
    mockVerify.mockReturnValue({ valid: true })
    mockFindMany.mockResolvedValue([])

    const { GET } = await import('@/app/api/cron/publish-scheduled/route')
    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.publishedCount).toBe(0)
  })

  it('予約投稿をメディア・ジャンル付きで正常に公開する', async () => {
    mockVerify.mockReturnValue({ valid: true })

    const scheduledPost = {
      id: 'sp1',
      userId: 'user1',
      content: 'Hello scheduled!',
      user: { id: 'user1', isSuspended: false },
      media: [
        { url: '/img1.jpg', type: 'image', sortOrder: 0 },
        { url: '/img2.jpg', type: 'image', sortOrder: 1 },
      ],
      genres: [{ genreId: 'genre1' }, { genreId: 'genre2' }],
    }
    mockFindMany.mockResolvedValue([scheduledPost])

    // $transaction は渡されたコールバックを実行する
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const txMock = {
        post: {
          create: vi.fn().mockResolvedValue({ id: 'post1' }),
        },
        postMedia: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
        postGenre: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
        scheduledPost: { update: vi.fn().mockResolvedValue({}) },
      }
      await fn(txMock)
      return undefined
    })

    const { GET } = await import('@/app/api/cron/publish-scheduled/route')
    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.publishedCount).toBe(1)
    expect(data.failedCount).toBe(0)
    expect(data.errors).toBeUndefined()
  })

  it('停止中ユーザーの投稿を FAILED にする', async () => {
    mockVerify.mockReturnValue({ valid: true })

    const scheduledPost = {
      id: 'sp2',
      userId: 'user2',
      content: 'Suspended user post',
      user: { id: 'user2', isSuspended: true },
      media: [],
      genres: [],
    }
    mockFindMany.mockResolvedValue([scheduledPost])
    mockUpdate.mockResolvedValue({})

    const { GET } = await import('@/app/api/cron/publish-scheduled/route')
    const response = await GET(createRequest())

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.publishedCount).toBe(0)
    expect(data.failedCount).toBe(1)
    // errors are no longer exposed in the response (logged server-side only)
    expect(data.errors).toBeUndefined()

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'sp2' },
      data: { status: 'failed' },
    })
  })

  it('ユーザーが存在しない場合も FAILED にする', async () => {
    mockVerify.mockReturnValue({ valid: true })

    const scheduledPost = {
      id: 'sp3',
      userId: 'user3',
      content: 'No user post',
      user: null,
      media: [],
      genres: [],
    }
    mockFindMany.mockResolvedValue([scheduledPost])
    mockUpdate.mockResolvedValue({})

    const { GET } = await import('@/app/api/cron/publish-scheduled/route')
    const response = await GET(createRequest())

    const data = await response.json()
    expect(data.failedCount).toBe(1)
  })

  it('トランザクションエラー時に FAILED にしつつ処理を続行する', async () => {
    mockVerify.mockReturnValue({ valid: true })

    const post1 = {
      id: 'sp4',
      userId: 'user4',
      content: 'Post 1',
      user: { id: 'user4', isSuspended: false },
      media: [],
      genres: [],
    }
    const post2 = {
      id: 'sp5',
      userId: 'user5',
      content: 'Post 2',
      user: { id: 'user5', isSuspended: false },
      media: [],
      genres: [],
    }

    mockFindMany.mockResolvedValue([post1, post2])

    let callCount = 0
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      callCount++
      if (callCount === 1) {
        throw new Error('DB transaction failed')
      }
      const txMock = {
        post: { create: vi.fn().mockResolvedValue({ id: 'post5' }) },
        postMedia: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
        postGenre: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
        scheduledPost: { update: vi.fn().mockResolvedValue({}) },
      }
      await fn(txMock)
    })
    mockUpdate.mockResolvedValue({})

    const { GET } = await import('@/app/api/cron/publish-scheduled/route')
    const response = await GET(createRequest())

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.publishedCount).toBe(1)
    expect(data.failedCount).toBe(1)
    // errors are no longer exposed in the response (logged server-side only)
    expect(data.errors).toBeUndefined()
  })

  it('予期しないエラーで500を返す', async () => {
    mockVerify.mockReturnValue({ valid: true })
    mockFindMany.mockRejectedValue(new Error('Unexpected DB crash'))

    const { GET } = await import('@/app/api/cron/publish-scheduled/route')
    const response = await GET(createRequest())

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error).toBe('Internal server error')
  })

  it('メディアなしの場合 postMedia.createMany が呼ばれない', async () => {
    mockVerify.mockReturnValue({ valid: true })
    mockFindMany.mockResolvedValue([
      {
        id: 'sp-no-media',
        userId: 'user1',
        content: 'No media post',
        user: { id: 'user1', isSuspended: false },
        media: [],
        genres: [],
      },
    ])

    const mockMediaCreateMany = vi.fn()
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const txMock = {
        post: { create: vi.fn().mockResolvedValue({ id: 'post-1' }) },
        postMedia: { createMany: mockMediaCreateMany },
        postGenre: { createMany: vi.fn().mockResolvedValue({}) },
        scheduledPost: { update: vi.fn().mockResolvedValue({}) },
      }
      await fn(txMock)
    })

    const { GET } = await import('@/app/api/cron/publish-scheduled/route')
    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.publishedCount).toBe(1)
    expect(mockMediaCreateMany).not.toHaveBeenCalled()
  })

  it('ジャンルなしの場合 postGenre.createMany が呼ばれない', async () => {
    mockVerify.mockReturnValue({ valid: true })
    mockFindMany.mockResolvedValue([
      {
        id: 'sp-no-genre',
        userId: 'user1',
        content: 'No genre post',
        user: { id: 'user1', isSuspended: false },
        media: [],
        genres: [],
      },
    ])

    const mockGenreCreateMany = vi.fn()
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const txMock = {
        post: { create: vi.fn().mockResolvedValue({ id: 'post-1' }) },
        postMedia: { createMany: vi.fn().mockResolvedValue({}) },
        postGenre: { createMany: mockGenreCreateMany },
        scheduledPost: { update: vi.fn().mockResolvedValue({}) },
      }
      await fn(txMock)
    })

    const { GET } = await import('@/app/api/cron/publish-scheduled/route')
    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.publishedCount).toBe(1)
    expect(mockGenreCreateMany).not.toHaveBeenCalled()
  })

  it('失敗ステータス更新に失敗しても処理を続行する', async () => {
    mockVerify.mockReturnValue({ valid: true })
    mockFindMany.mockResolvedValue([
      {
        id: 'sp-update-fail',
        userId: 'user1',
        content: 'Test post',
        user: { id: 'user1', isSuspended: false },
        media: [],
        genres: [],
      },
    ])

    mockTransaction.mockRejectedValue(new Error('Transaction failed'))
    mockUpdate.mockRejectedValue(new Error('Update failed'))

    const { GET } = await import('@/app/api/cron/publish-scheduled/route')
    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.failedCount).toBe(1)
  })

  it('複数の予約投稿を一括処理する', async () => {
    mockVerify.mockReturnValue({ valid: true })
    mockFindMany.mockResolvedValue([
      {
        id: 'sp-batch-1',
        userId: 'user1',
        content: 'Batch post 1',
        user: { id: 'user1', isSuspended: false },
        media: [],
        genres: [],
      },
      {
        id: 'sp-batch-2',
        userId: 'user2',
        content: 'Batch post 2',
        user: { id: 'user2', isSuspended: false },
        media: [],
        genres: [],
      },
    ])

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const txMock = {
        post: { create: vi.fn().mockResolvedValue({ id: 'post-1' }) },
        postMedia: { createMany: vi.fn().mockResolvedValue({}) },
        postGenre: { createMany: vi.fn().mockResolvedValue({}) },
        scheduledPost: { update: vi.fn().mockResolvedValue({}) },
      }
      await fn(txMock)
    })

    const { GET } = await import('@/app/api/cron/publish-scheduled/route')
    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.publishedCount).toBe(2)
    expect(data.failedCount).toBe(0)
  })
})
