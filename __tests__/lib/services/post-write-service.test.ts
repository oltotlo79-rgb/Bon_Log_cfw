// @vitest-environment node
/**
 * lib/services/post-write-service のユニットテスト
 *
 * createPostV1 / updatePostV1 / deletePostV1 の
 * 所有権・上限・プレミアム・メディア URL 検証・R2 クリーンアップを網羅する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ──────────────────────────────────────────────────
// Mock: prisma
// ──────────────────────────────────────────────────
const mockPrismaPostFindUnique = vi.fn()
const mockPrismaPostCreate = vi.fn()
const mockPrismaPostDelete = vi.fn()
const mockPrismaPostUpdate = vi.fn()
const mockPrismaPostCount = vi.fn()
const mockPrismaPostMediaDeleteMany = vi.fn()
const mockPrismaPostGenreDeleteMany = vi.fn()
const mockPrismaTransaction = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    post: {
      findUnique: (...args: unknown[]) => mockPrismaPostFindUnique(...args),
      create: (...args: unknown[]) => mockPrismaPostCreate(...args),
      delete: (...args: unknown[]) => mockPrismaPostDelete(...args),
      update: (...args: unknown[]) => mockPrismaPostUpdate(...args),
      count: (...args: unknown[]) => mockPrismaPostCount(...args),
    },
    postMedia: {
      deleteMany: (...args: unknown[]) => mockPrismaPostMediaDeleteMany(...args),
    },
    postGenre: {
      deleteMany: (...args: unknown[]) => mockPrismaPostGenreDeleteMany(...args),
    },
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
}))

// ──────────────────────────────────────────────────
// Mock: getMembershipLimits / isPremiumUser
// ──────────────────────────────────────────────────
const mockGetMembershipLimits = vi.fn()
vi.mock('@/lib/premium', () => ({
  getMembershipLimits: (...args: unknown[]) => mockGetMembershipLimits(...args),
  isPremiumUser: vi.fn(),
}))

// ──────────────────────────────────────────────────
// Mock: validateMediaCounts / checkDailyPostLimit
// ──────────────────────────────────────────────────
const mockValidateMediaCounts = vi.fn()
const mockCheckDailyPostLimit = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  validateMediaCounts: (...args: unknown[]) => mockValidateMediaCounts(...args),
  checkDailyPostLimit: (...args: unknown[]) => mockCheckDailyPostLimit(...args),
}))

// ──────────────────────────────────────────────────
// Mock: media URL validator
// ──────────────────────────────────────────────────
const mockAssertMediaUrls = vi.fn()
vi.mock('@/lib/services/media-url-validator', () => ({
  assertMediaUrlsFromOwnStorage: (...args: unknown[]) => mockAssertMediaUrls(...args),
}))

// ──────────────────────────────────────────────────
// Mock: hashtag / mention / storage
// ──────────────────────────────────────────────────
const mockAttachHashtags = vi.fn()
const mockDetachHashtags = vi.fn()
const mockExtractHashtags = vi.fn()
vi.mock('@/lib/services/hashtag-sync', () => ({
  attachHashtagsToPost: (...args: unknown[]) => mockAttachHashtags(...args),
  detachHashtagsFromPost: (...args: unknown[]) => mockDetachHashtags(...args),
  extractHashtags: (...args: unknown[]) => mockExtractHashtags(...args),
}))

const mockNotifyMentioned = vi.fn()
vi.mock('@/lib/services/mention', () => ({
  notifyMentionedUsers: (...args: unknown[]) => mockNotifyMentioned(...args),
}))

const mockDeleteMediaFiles = vi.fn()
vi.mock('@/lib/services/media-cleanup', () => ({
  deleteMediaFiles: (...args: unknown[]) => mockDeleteMediaFiles(...args),
}))

// fetchPostDetail は assertCanViewPost を経由して呼ばれることもあるが
// post-write-service 内の fetchCreatedPost は fetchPostDetail の再エクスポートなのでモック不要

const mockFetchPostDetail = vi.fn()
vi.mock('@/lib/services/post-read-service', () => ({
  fetchPostDetail: (...args: unknown[]) => mockFetchPostDetail(...args),
}))

const mockAssertCanViewPost = vi.fn()
vi.mock('@/lib/services/post-visibility', () => ({
  assertCanViewPost: (...args: unknown[]) => mockAssertCanViewPost(...args),
}))

vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// ──────────────────────────────────────────────────
// Constants for tests
// ──────────────────────────────────────────────────
const FREE_LIMITS = {
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 0,
  maxDailyPosts: 20,
  canSchedulePost: false,
  canViewAnalytics: false,
}
const PREMIUM_LIMITS = {
  maxPostLength: 2000,
  maxImages: 6,
  maxVideos: 1,
  maxDailyPosts: 40,
  canSchedulePost: true,
  canViewAnalytics: true,
}

const OWNER_ID = 'user-owner'
const OTHER_ID = 'user-other'
const POST_ID = 'post-cjld2'

const validInput = {
  content: 'こんにちは',
  genreIds: [] as string[],
  mediaUrls: [] as string[],
  mediaTypes: [] as ('image' | 'video')[],
}

// ──────────────────────────────────────────────────
// createPostV1
// ──────────────────────────────────────────────────
describe('createPostV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMembershipLimits.mockResolvedValue(FREE_LIMITS)
    mockValidateMediaCounts.mockResolvedValue(null)
    mockAssertMediaUrls.mockReturnValue(true)
    mockCheckDailyPostLimit.mockResolvedValue(null)
    mockPrismaPostCreate.mockResolvedValue({ id: POST_ID })
    mockAttachHashtags.mockResolvedValue(undefined)
    mockNotifyMentioned.mockResolvedValue(undefined)
  })

  it('正常系: 投稿が作成されて { ok: true, postId } を返す', async () => {
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    const result = await createPostV1(validInput, OWNER_ID)
    expect(result).toEqual({ ok: true, postId: POST_ID })
    expect(mockPrismaPostCreate).toHaveBeenCalledTimes(1)
  })

  it('本文もメディアも空なら ERR_CONTENT_REQUIRED / status 400', async () => {
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    const result = await createPostV1({ ...validInput, content: '', mediaUrls: [] }, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 400 })
    expect(mockPrismaPostCreate).not.toHaveBeenCalled()
  })

  it('無料プラン: 501 文字の本文で ERR_POST_CONTENT_TOO_LONG / status 400', async () => {
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    const result = await createPostV1({ ...validInput, content: 'a'.repeat(501) }, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('プレミアム: 2000 文字の本文は通る', async () => {
    mockGetMembershipLimits.mockResolvedValue(PREMIUM_LIMITS)
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    const result = await createPostV1({ ...validInput, content: 'a'.repeat(2000) }, OWNER_ID)
    expect(result).toMatchObject({ ok: true })
  })

  it('プレミアム: 2001 文字の本文で status 400', async () => {
    mockGetMembershipLimits.mockResolvedValue(PREMIUM_LIMITS)
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    const result = await createPostV1({ ...validInput, content: 'a'.repeat(2001) }, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('ジャンル 4 件超過で ERR_GENRE_LIMIT / status 400', async () => {
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    const result = await createPostV1(
      { ...validInput, genreIds: ['g1', 'g2', 'g3', 'g4'] },
      OWNER_ID,
    )
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('ジャンル 3 件は通る', async () => {
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    const result = await createPostV1(
      { ...validInput, genreIds: ['g1', 'g2', 'g3'] },
      OWNER_ID,
    )
    expect(result).toMatchObject({ ok: true })
  })

  it('validateMediaCounts が error を返すと status 400', async () => {
    mockValidateMediaCounts.mockResolvedValue({ success: false, error: 'ERR_IMAGE_LIMIT' })
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    const result = await createPostV1(
      { ...validInput, mediaUrls: ['/uploads/a.webp'], mediaTypes: ['image' as const] },
      OWNER_ID,
    )
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('外部 mediaUrls で assertMediaUrlsFromOwnStorage が false → status 400', async () => {
    mockAssertMediaUrls.mockReturnValue(false)
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    const result = await createPostV1(
      { ...validInput, mediaUrls: ['https://evil.example.com/spy.gif'], mediaTypes: ['image' as const] },
      OWNER_ID,
    )
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('1日投稿上限超過で status 429', async () => {
    mockCheckDailyPostLimit.mockResolvedValue({
      success: false,
      error: '1日の投稿上限に達しました',
    })
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    const result = await createPostV1(validInput, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 429 })
  })

  it('prisma.post.create が例外を throw → { ok: false, status: 500 }', async () => {
    mockPrismaPostCreate.mockRejectedValue(new Error('DB crash'))
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    const result = await createPostV1(validInput, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 500 })
  })

  it('mediaUrls が設定されている場合 post.create の data に media.create が含まれる', async () => {
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    await createPostV1(
      { ...validInput, mediaUrls: ['/uploads/img.webp'], mediaTypes: ['image' as const] },
      OWNER_ID,
    )
    const callArgs = mockPrismaPostCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(callArgs?.data?.media).toBeDefined()
  })

  it('genreIds が設定されている場合 post.create の data に genres.create が含まれる', async () => {
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    await createPostV1({ ...validInput, genreIds: ['genre-1', 'genre-2'] }, OWNER_ID)
    const callArgs = mockPrismaPostCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(callArgs?.data?.genres).toBeDefined()
  })

  it('content が空でも mediaUrls があれば ok: true、data.content は null', async () => {
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    const result = await createPostV1(
      { ...validInput, content: '', mediaUrls: ['/uploads/img.webp'], mediaTypes: ['image' as const] },
      OWNER_ID,
    )
    expect(result).toMatchObject({ ok: true })
    const callArgs = mockPrismaPostCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(callArgs?.data?.content).toBeNull()
  })

  it('attachHashtagsToPost が例外をスローしても ok: true を返す（エラー握りつぶし）', async () => {
    mockAttachHashtags.mockRejectedValue(new Error('hashtag失敗'))
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    const result = await createPostV1(validInput, OWNER_ID)
    expect(result).toMatchObject({ ok: true })
  })

  it('notifyMentionedUsers が例外をスローしても ok: true を返す（エラー握りつぶし）', async () => {
    mockNotifyMentioned.mockRejectedValue(new Error('mention失敗'))
    const { createPostV1 } = await import('@/lib/services/post-write-service')
    const result = await createPostV1(validInput, OWNER_ID)
    expect(result).toMatchObject({ ok: true })
  })
})

// ──────────────────────────────────────────────────
// updatePostV1
// ──────────────────────────────────────────────────
describe('updatePostV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMembershipLimits.mockResolvedValue(FREE_LIMITS)
    mockValidateMediaCounts.mockResolvedValue(null)
    mockAssertMediaUrls.mockReturnValue(true)
    mockPrismaPostFindUnique.mockResolvedValue({
      userId: OWNER_ID,
      repostPostId: null,
      media: [],
    })
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          postMedia: { deleteMany: mockPrismaPostMediaDeleteMany },
          postGenre: { deleteMany: mockPrismaPostGenreDeleteMany },
          post: { update: mockPrismaPostUpdate },
        }),
    )
    mockPrismaPostMediaDeleteMany.mockResolvedValue(undefined)
    mockPrismaPostGenreDeleteMany.mockResolvedValue(undefined)
    mockPrismaPostUpdate.mockResolvedValue({ id: POST_ID })
    mockDetachHashtags.mockResolvedValue(undefined)
    mockAttachHashtags.mockResolvedValue(undefined)
    mockDeleteMediaFiles.mockResolvedValue(undefined)
  })

  it('正常系: { ok: true, postId } を返す', async () => {
    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    const result = await updatePostV1(POST_ID, validInput, OWNER_ID)
    expect(result).toEqual({ ok: true, postId: POST_ID })
  })

  it('所有者でないユーザーは 403', async () => {
    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    const result = await updatePostV1(POST_ID, validInput, OTHER_ID)
    expect(result).toMatchObject({ ok: false, status: 403 })
  })

  it('存在しない投稿 ID は 404', async () => {
    mockPrismaPostFindUnique.mockResolvedValue(null)
    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    const result = await updatePostV1(POST_ID, validInput, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('純粋リポスト（repostPostId あり）は編集不可 → status 400', async () => {
    mockPrismaPostFindUnique.mockResolvedValue({
      userId: OWNER_ID,
      repostPostId: 'original-post',
      media: [],
    })
    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    const result = await updatePostV1(POST_ID, validInput, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('本文もメディアも空 → status 400', async () => {
    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    const result = await updatePostV1(POST_ID, { ...validInput, content: '', mediaUrls: [] }, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('無料: 501 文字本文 → status 400', async () => {
    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    const result = await updatePostV1(POST_ID, { ...validInput, content: 'a'.repeat(501) }, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('プレミアム: 2000 文字本文 → ok', async () => {
    mockGetMembershipLimits.mockResolvedValue(PREMIUM_LIMITS)
    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    const result = await updatePostV1(POST_ID, { ...validInput, content: 'a'.repeat(2000) }, OWNER_ID)
    expect(result).toMatchObject({ ok: true })
  })

  it('ジャンル 4 件超過 → status 400', async () => {
    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    const result = await updatePostV1(
      POST_ID,
      { ...validInput, genreIds: ['g1', 'g2', 'g3', 'g4'] },
      OWNER_ID,
    )
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('外部 mediaUrls → status 400', async () => {
    mockAssertMediaUrls.mockReturnValue(false)
    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    const result = await updatePostV1(
      POST_ID,
      { ...validInput, mediaUrls: ['https://evil.com/x.gif'], mediaTypes: ['image' as const] },
      OWNER_ID,
    )
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('削除されたメディア URL は deleteMediaFiles に渡される', async () => {
    mockPrismaPostFindUnique.mockResolvedValue({
      userId: OWNER_ID,
      repostPostId: null,
      media: [{ url: '/uploads/old.webp' }],
    })
    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    // new mediaUrls は空 → 旧 URL が削除対象
    await updatePostV1(POST_ID, validInput, OWNER_ID)
    expect(mockDeleteMediaFiles).toHaveBeenCalledWith(['/uploads/old.webp'])
  })

  it('$transaction が例外を throw → { ok: false, status: 500 }', async () => {
    mockPrismaTransaction.mockRejectedValue(new Error('TX crash'))
    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    const result = await updatePostV1(POST_ID, validInput, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 500 })
  })

  it('postId が空文字のとき → { ok: false, status: 400 }', async () => {
    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    const result = await updatePostV1('', validInput, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('mediaUrls が設定されている場合 transaction の post.update に media.create が含まれる', async () => {
    let capturedUpdateData: Record<string, unknown> = {}
    mockPrismaTransaction.mockImplementationOnce(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          postMedia: { deleteMany: mockPrismaPostMediaDeleteMany },
          postGenre: { deleteMany: mockPrismaPostGenreDeleteMany },
          post: {
            update: (args: { where: unknown; data: Record<string, unknown> }) => {
              capturedUpdateData = args.data
              return mockPrismaPostUpdate(args)
            },
          },
        }),
    )

    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    await updatePostV1(
      POST_ID,
      { ...validInput, mediaUrls: ['/uploads/img.webp'], mediaTypes: ['image' as const] },
      OWNER_ID,
    )

    expect(capturedUpdateData.media).toBeDefined()
  })

  it('genreIds が設定されている場合 transaction の post.update に genres.create が含まれる', async () => {
    let capturedUpdateData: Record<string, unknown> = {}
    mockPrismaTransaction.mockImplementationOnce(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          postMedia: { deleteMany: mockPrismaPostMediaDeleteMany },
          postGenre: { deleteMany: mockPrismaPostGenreDeleteMany },
          post: {
            update: (args: { where: unknown; data: Record<string, unknown> }) => {
              capturedUpdateData = args.data
              return mockPrismaPostUpdate(args)
            },
          },
        }),
    )

    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    await updatePostV1(POST_ID, { ...validInput, genreIds: ['genre-1'] }, OWNER_ID)

    expect(capturedUpdateData.genres).toBeDefined()
  })

  it('content が空でも mediaUrls があれば ok: true、transaction data.content は null', async () => {
    let capturedUpdateData: Record<string, unknown> = {}
    mockPrismaTransaction.mockImplementationOnce(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          postMedia: { deleteMany: mockPrismaPostMediaDeleteMany },
          postGenre: { deleteMany: mockPrismaPostGenreDeleteMany },
          post: {
            update: (args: { where: unknown; data: Record<string, unknown> }) => {
              capturedUpdateData = args.data
              return mockPrismaPostUpdate(args)
            },
          },
        }),
    )

    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    const result = await updatePostV1(
      POST_ID,
      { ...validInput, content: '', mediaUrls: ['/uploads/img.webp'], mediaTypes: ['image' as const] },
      OWNER_ID,
    )
    expect(result).toMatchObject({ ok: true })
    expect(capturedUpdateData.content).toBeNull()
  })

  it('attachHashtagsToPost が例外をスローしても ok: true を返す（エラー握りつぶし）', async () => {
    mockAttachHashtags.mockRejectedValue(new Error('hashtag失敗'))
    const { updatePostV1 } = await import('@/lib/services/post-write-service')
    const result = await updatePostV1(POST_ID, validInput, OWNER_ID)
    expect(result).toMatchObject({ ok: true })
  })
})

// ──────────────────────────────────────────────────
// fetchCreatedPost
// ──────────────────────────────────────────────────
describe('fetchCreatedPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchPostDetail.mockResolvedValue({ id: POST_ID, content: 'テスト投稿' })
  })

  it('fetchPostDetail の結果をそのまま返す', async () => {
    const { fetchCreatedPost } = await import('@/lib/services/post-write-service')
    const result = await fetchCreatedPost(POST_ID, OWNER_ID)
    expect(result).toMatchObject({ id: POST_ID })
    expect(mockFetchPostDetail).toHaveBeenCalledWith(POST_ID, OWNER_ID)
  })
})

// ──────────────────────────────────────────────────
// deletePostV1
// ──────────────────────────────────────────────────
describe('deletePostV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrismaPostFindUnique.mockResolvedValue({
      userId: OWNER_ID,
      media: [{ url: '/uploads/img.webp' }],
    })
    mockDetachHashtags.mockResolvedValue(undefined)
    mockPrismaPostDelete.mockResolvedValue(undefined)
    mockDeleteMediaFiles.mockResolvedValue(undefined)
  })

  it('正常系: { ok: true } を返す', async () => {
    const { deletePostV1 } = await import('@/lib/services/post-write-service')
    const result = await deletePostV1(POST_ID, OWNER_ID)
    expect(result).toEqual({ ok: true })
  })

  it('所有者でないユーザーは 403', async () => {
    const { deletePostV1 } = await import('@/lib/services/post-write-service')
    const result = await deletePostV1(POST_ID, OTHER_ID)
    expect(result).toMatchObject({ ok: false, status: 403 })
  })

  it('存在しない投稿 ID は 404', async () => {
    mockPrismaPostFindUnique.mockResolvedValue(null)
    const { deletePostV1 } = await import('@/lib/services/post-write-service')
    const result = await deletePostV1(POST_ID, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('メディアがある場合 deleteMediaFiles が呼ばれる', async () => {
    const { deletePostV1 } = await import('@/lib/services/post-write-service')
    await deletePostV1(POST_ID, OWNER_ID)
    expect(mockDeleteMediaFiles).toHaveBeenCalledWith(['/uploads/img.webp'])
  })

  it('メディアなしの場合も deleteMediaFiles は呼ばれる（空配列）', async () => {
    mockPrismaPostFindUnique.mockResolvedValue({ userId: OWNER_ID, media: [] })
    const { deletePostV1 } = await import('@/lib/services/post-write-service')
    await deletePostV1(POST_ID, OWNER_ID)
    expect(mockDeleteMediaFiles).toHaveBeenCalledWith([])
  })

  it('prisma.post.delete が例外を throw → { ok: false, status: 500 }', async () => {
    mockPrismaPostDelete.mockRejectedValue(new Error('FK constraint'))
    const { deletePostV1 } = await import('@/lib/services/post-write-service')
    const result = await deletePostV1(POST_ID, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 500 })
  })
})
