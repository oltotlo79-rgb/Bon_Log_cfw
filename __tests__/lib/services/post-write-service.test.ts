// @vitest-environment node
/**
 * lib/services/post-write-service のユニットテスト
 *
 * createPostV1 / updatePostV1 / deletePostV1 の
 * 所有権・上限・プレミアム・メディア URL 検証・R2 クリーンアップを網羅する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { DEFAULT_POLL_DURATION_SECONDS } from '@/lib/constants/limits'

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
const mockPrismaBonsaiFindUnique = vi.fn()

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
    bonsai: {
      findUnique: (...args: unknown[]) => mockPrismaBonsaiFindUnique(...args),
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
const mockCanViewAuthorContent = vi.fn()
vi.mock('@/lib/services/post-visibility', () => ({
  assertCanViewPost: (...args: unknown[]) => mockAssertCanViewPost(...args),
  canViewAuthorContent: (...args: unknown[]) => mockCanViewAuthorContent(...args),
}))

const mockCreateNotification = vi.fn()
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
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
    mockPrismaBonsaiFindUnique.mockResolvedValue(null)
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

  describe('アンケート付き投稿', () => {
    it('有効な選択肢でアンケート付き投稿を作成できる', async () => {
      const { createPostV1 } = await import('@/lib/services/post-write-service')
      const result = await createPostV1(
        {
          ...validInput,
          poll: { options: ['選択肢A', '選択肢B'], durationSeconds: 3600 },
        },
        OWNER_ID,
      )
      expect(result).toMatchObject({ ok: true })
      const callArgs = mockPrismaPostCreate.mock.calls[0]?.[0] as {
        data: { poll?: { create: { duration: number; options: { create: { text: string; sortOrder: number }[] } } } }
      }
      expect(callArgs.data.poll?.create.duration).toBe(3600)
      expect(callArgs.data.poll?.create.options.create).toEqual([
        { text: '選択肢A', sortOrder: 0 },
        { text: '選択肢B', sortOrder: 1 },
      ])
    })

    it('poll.durationSeconds に DEFAULT_POLL_DURATION_SECONDS を指定した場合その値が duration として保存される', async () => {
      const { createPostV1 } = await import('@/lib/services/post-write-service')
      await createPostV1(
        { ...validInput, poll: { options: ['A', 'B'], durationSeconds: DEFAULT_POLL_DURATION_SECONDS } },
        OWNER_ID,
      )
      const callArgs = mockPrismaPostCreate.mock.calls[0]?.[0] as {
        data: { poll?: { create: { duration: number } } }
      }
      expect(callArgs.data.poll?.create.duration).toBe(DEFAULT_POLL_DURATION_SECONDS)
    })

    it('空白のみの選択肢は ERR_POLL_OPTION_TOO_LONG / status 400（Zod未検証呼び出しへの防御）', async () => {
      const { createPostV1 } = await import('@/lib/services/post-write-service')
      const result = await createPostV1(
        { ...validInput, poll: { options: ['   ', '選択肢B'], durationSeconds: 3600 } },
        OWNER_ID,
      )
      expect(result).toMatchObject({ ok: false, status: 400 })
      expect(mockPrismaPostCreate).not.toHaveBeenCalled()
    })

    it('上限文字数を超える選択肢は status 400（Zod未検証呼び出しへの防御）', async () => {
      const { createPostV1 } = await import('@/lib/services/post-write-service')
      const result = await createPostV1(
        { ...validInput, poll: { options: ['a'.repeat(51), '選択肢B'], durationSeconds: 3600 } },
        OWNER_ID,
      )
      expect(result).toMatchObject({ ok: false, status: 400 })
    })

    it('poll を指定しない場合 post.create の data.poll は undefined', async () => {
      const { createPostV1 } = await import('@/lib/services/post-write-service')
      await createPostV1(validInput, OWNER_ID)
      const callArgs = mockPrismaPostCreate.mock.calls[0]?.[0] as { data: { poll?: unknown } }
      expect(callArgs.data.poll).toBeUndefined()
    })
  })

  describe('bonsaiId 紐付け', () => {
    it('自分の盆栽 ID を指定: post.create の data.bonsaiId に反映される', async () => {
      mockPrismaBonsaiFindUnique.mockResolvedValue({ userId: OWNER_ID })
      const { createPostV1 } = await import('@/lib/services/post-write-service')
      const result = await createPostV1({ ...validInput, bonsaiId: 'bonsai-1' }, OWNER_ID)

      expect(result).toMatchObject({ ok: true })
      const callArgs = mockPrismaPostCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
      expect(callArgs?.data?.bonsaiId).toBe('bonsai-1')
      expect(mockPrismaBonsaiFindUnique).toHaveBeenCalledWith({
        where: { id: 'bonsai-1' },
        select: { userId: true },
      })
    })

    it('他人の盆栽 ID を指定: ERR_BONSAI_NOT_FOUND / status 404（IDOR対策）', async () => {
      mockPrismaBonsaiFindUnique.mockResolvedValue({ userId: OTHER_ID })
      const { createPostV1 } = await import('@/lib/services/post-write-service')
      const { ERR_BONSAI_NOT_FOUND } = await import('@/lib/constants/errors')
      const result = await createPostV1({ ...validInput, bonsaiId: 'bonsai-not-mine' }, OWNER_ID)

      expect(result).toMatchObject({ ok: false, status: 404, error: ERR_BONSAI_NOT_FOUND })
      expect(mockPrismaPostCreate).not.toHaveBeenCalled()
    })

    it('存在しない盆栽 ID を指定: ERR_BONSAI_NOT_FOUND / status 404', async () => {
      mockPrismaBonsaiFindUnique.mockResolvedValue(null)
      const { createPostV1 } = await import('@/lib/services/post-write-service')
      const { ERR_BONSAI_NOT_FOUND } = await import('@/lib/constants/errors')
      const result = await createPostV1({ ...validInput, bonsaiId: 'nonexistent-bonsai' }, OWNER_ID)

      expect(result).toMatchObject({ ok: false, status: 404, error: ERR_BONSAI_NOT_FOUND })
      expect(mockPrismaPostCreate).not.toHaveBeenCalled()
    })

    it('bonsaiId 未指定（後方互換）: post.create の data.bonsaiId は null、所有権チェックは行わない', async () => {
      const { createPostV1 } = await import('@/lib/services/post-write-service')
      const result = await createPostV1(validInput, OWNER_ID)

      expect(result).toMatchObject({ ok: true })
      const callArgs = mockPrismaPostCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
      expect(callArgs?.data?.bonsaiId).toBeNull()
      expect(mockPrismaBonsaiFindUnique).not.toHaveBeenCalled()
    })

    it('bonsaiId が null 指定: post.create の data.bonsaiId は null', async () => {
      const { createPostV1 } = await import('@/lib/services/post-write-service')
      const result = await createPostV1({ ...validInput, bonsaiId: null }, OWNER_ID)

      expect(result).toMatchObject({ ok: true })
      const callArgs = mockPrismaPostCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
      expect(callArgs?.data?.bonsaiId).toBeNull()
      expect(mockPrismaBonsaiFindUnique).not.toHaveBeenCalled()
    })
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
    mockPrismaBonsaiFindUnique.mockResolvedValue(null)
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

  describe('bonsaiId 紐付け', () => {
    it('自分の盆栽 ID を指定: transaction の post.update に data.bonsaiId が反映される', async () => {
      mockPrismaBonsaiFindUnique.mockResolvedValue({ userId: OWNER_ID })
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
      const result = await updatePostV1(POST_ID, { ...validInput, bonsaiId: 'bonsai-1' }, OWNER_ID)

      expect(result).toMatchObject({ ok: true })
      expect(capturedUpdateData.bonsaiId).toBe('bonsai-1')
    })

    it('他人の盆栽 ID を指定: ERR_BONSAI_NOT_FOUND / status 404（IDOR対策）', async () => {
      mockPrismaBonsaiFindUnique.mockResolvedValue({ userId: OTHER_ID })
      const { updatePostV1 } = await import('@/lib/services/post-write-service')
      const { ERR_BONSAI_NOT_FOUND } = await import('@/lib/constants/errors')
      const result = await updatePostV1(POST_ID, { ...validInput, bonsaiId: 'bonsai-not-mine' }, OWNER_ID)

      expect(result).toMatchObject({ ok: false, status: 404, error: ERR_BONSAI_NOT_FOUND })
      expect(mockPrismaTransaction).not.toHaveBeenCalled()
    })

    it('存在しない盆栽 ID を指定: ERR_BONSAI_NOT_FOUND / status 404', async () => {
      mockPrismaBonsaiFindUnique.mockResolvedValue(null)
      const { updatePostV1 } = await import('@/lib/services/post-write-service')
      const { ERR_BONSAI_NOT_FOUND } = await import('@/lib/constants/errors')
      const result = await updatePostV1(POST_ID, { ...validInput, bonsaiId: 'nonexistent-bonsai' }, OWNER_ID)

      expect(result).toMatchObject({ ok: false, status: 404, error: ERR_BONSAI_NOT_FOUND })
      expect(mockPrismaTransaction).not.toHaveBeenCalled()
    })

    it('bonsaiId 未指定（キー省略）: 現状維持のため所有権チェックせず data に bonsaiId キーを含めない', async () => {
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
      const result = await updatePostV1(POST_ID, validInput, OWNER_ID)

      expect(result).toMatchObject({ ok: true })
      expect('bonsaiId' in capturedUpdateData).toBe(false)
      expect(mockPrismaBonsaiFindUnique).not.toHaveBeenCalled()
    })

    it('bonsaiId: null を指定: 紐付け解除のため data.bonsaiId が null で更新される', async () => {
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
      const result = await updatePostV1(POST_ID, { ...validInput, bonsaiId: null }, OWNER_ID)

      expect(result).toMatchObject({ ok: true })
      expect(capturedUpdateData.bonsaiId).toBeNull()
      expect(mockPrismaBonsaiFindUnique).not.toHaveBeenCalled()
    })
  })
})

// ──────────────────────────────────────────────────
// createQuoteV1
// ──────────────────────────────────────────────────
describe('createQuoteV1', () => {
  const QUOTE_POST_ID = 'post-quoted'
  const validQuoteInput = {
    content: '引用コメント',
    genreIds: [] as string[],
    mediaUrls: [] as string[],
    mediaTypes: [] as ('image' | 'video')[],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMembershipLimits.mockResolvedValue(FREE_LIMITS)
    mockValidateMediaCounts.mockResolvedValue(null)
    mockAssertMediaUrls.mockReturnValue(true)
    mockCheckDailyPostLimit.mockResolvedValue(null)
    mockCanViewAuthorContent.mockResolvedValue(true)
    mockPrismaPostFindUnique.mockResolvedValue({
      userId: OTHER_ID,
      isHidden: false,
      user: { isPublic: true, isSuspended: false },
    })
    mockPrismaPostCreate.mockResolvedValue({ id: POST_ID })
    mockAttachHashtags.mockResolvedValue(undefined)
    mockNotifyMentioned.mockResolvedValue(undefined)
    mockCreateNotification.mockResolvedValue(undefined)
  })

  it('正常系: 引用投稿が作成されて { ok: true, postId } を返す', async () => {
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    const result = await createQuoteV1(QUOTE_POST_ID, validQuoteInput, OWNER_ID)
    expect(result).toEqual({ ok: true, postId: POST_ID })
    expect(mockPrismaPostCreate).toHaveBeenCalledTimes(1)
  })

  it('content が空文字なら ERR_QUOTE_REQUIRED / status 400', async () => {
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    const result = await createQuoteV1(QUOTE_POST_ID, { ...validQuoteInput, content: '' }, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 400 })
    expect(mockPrismaPostCreate).not.toHaveBeenCalled()
  })

  it('無料プラン: 501文字の本文で status 400', async () => {
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    const result = await createQuoteV1(
      QUOTE_POST_ID,
      { ...validQuoteInput, content: 'a'.repeat(501) },
      OWNER_ID,
    )
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('ジャンル4件超過で status 400', async () => {
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    const result = await createQuoteV1(
      QUOTE_POST_ID,
      { ...validQuoteInput, genreIds: ['g1', 'g2', 'g3', 'g4'] },
      OWNER_ID,
    )
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('validateMediaCounts がエラーを返すと status 400', async () => {
    mockValidateMediaCounts.mockResolvedValue({ success: false, error: 'ERR_IMAGE_LIMIT' })
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    const result = await createQuoteV1(
      QUOTE_POST_ID,
      { ...validQuoteInput, mediaUrls: ['/uploads/a.webp'], mediaTypes: ['image' as const] },
      OWNER_ID,
    )
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('外部 mediaUrls で assertMediaUrlsFromOwnStorage が false → status 400', async () => {
    mockAssertMediaUrls.mockReturnValue(false)
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    const result = await createQuoteV1(
      QUOTE_POST_ID,
      { ...validQuoteInput, mediaUrls: ['https://evil.example.com/spy.gif'], mediaTypes: ['image' as const] },
      OWNER_ID,
    )
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('引用元投稿が存在しない → ERR_POST_NOT_FOUND / status 404', async () => {
    mockPrismaPostFindUnique.mockResolvedValue(null)
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    const result = await createQuoteV1(QUOTE_POST_ID, validQuoteInput, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('引用元投稿が非表示 → status 404', async () => {
    mockPrismaPostFindUnique.mockResolvedValue({
      userId: OTHER_ID,
      isHidden: true,
      user: { isPublic: true, isSuspended: false },
    })
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    const result = await createQuoteV1(QUOTE_POST_ID, validQuoteInput, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('引用元投稿の著者が非公開/停止で閲覧不可 (canViewAuthorContent=false) → status 404', async () => {
    mockCanViewAuthorContent.mockResolvedValue(false)
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    const result = await createQuoteV1(QUOTE_POST_ID, validQuoteInput, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('1日投稿上限超過で status 429', async () => {
    mockCheckDailyPostLimit.mockResolvedValue({ success: false, error: '1日の投稿上限に達しました' })
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    const result = await createQuoteV1(QUOTE_POST_ID, validQuoteInput, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 429 })
  })

  it('prisma.post.create が例外を throw → { ok: false, status: 500 }', async () => {
    mockPrismaPostCreate.mockRejectedValue(new Error('DB crash'))
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    const result = await createQuoteV1(QUOTE_POST_ID, validQuoteInput, OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 500 })
  })

  it('mediaUrls / genreIds が post.create の data に反映される', async () => {
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    await createQuoteV1(
      QUOTE_POST_ID,
      {
        ...validQuoteInput,
        mediaUrls: ['/uploads/a.webp'],
        mediaTypes: ['image' as const],
        genreIds: ['genre-1'],
      },
      OWNER_ID,
    )
    const callArgs = mockPrismaPostCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(callArgs.data.media).toBeDefined()
    expect(callArgs.data.genres).toBeDefined()
    expect(callArgs.data.quotePostId).toBe(QUOTE_POST_ID)
  })

  it('引用元投稿の所有者が自分自身のときは通知を送らない', async () => {
    mockPrismaPostFindUnique.mockResolvedValue({
      userId: OWNER_ID,
      isHidden: false,
      user: { isPublic: true, isSuspended: false },
    })
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    const result = await createQuoteV1(QUOTE_POST_ID, validQuoteInput, OWNER_ID)
    expect(result).toMatchObject({ ok: true })
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('引用元投稿の所有者が他人のときは createNotification が呼ばれる', async () => {
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    await createQuoteV1(QUOTE_POST_ID, validQuoteInput, OWNER_ID)
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OTHER_ID,
        actorId: OWNER_ID,
        type: 'quote',
        postId: POST_ID,
      }),
    )
  })

  it('attachHashtagsToPost が例外をスローしても ok: true を返す（エラー握りつぶし）', async () => {
    mockAttachHashtags.mockRejectedValue(new Error('hashtag失敗'))
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    const result = await createQuoteV1(QUOTE_POST_ID, validQuoteInput, OWNER_ID)
    expect(result).toMatchObject({ ok: true })
  })

  it('notifyMentionedUsers が例外をスローしても ok: true を返す（エラー握りつぶし）', async () => {
    mockNotifyMentioned.mockRejectedValue(new Error('mention失敗'))
    const { createQuoteV1 } = await import('@/lib/services/post-write-service')
    const result = await createQuoteV1(QUOTE_POST_ID, validQuoteInput, OWNER_ID)
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

// ──────────────────────────────────────────────────
// createPostV1Schema (route handler が safeParse する Zod schema)
// ──────────────────────────────────────────────────
describe('createPostV1Schema', () => {
  it('空白のみの選択肢は refine により無効と判定される', async () => {
    const { createPostV1Schema } = await import('@/lib/services/post-write-service')
    const result = createPostV1Schema.safeParse({
      poll: { options: ['   ', '選択肢B'], durationSeconds: 3600 },
    })
    expect(result.success).toBe(false)
  })

  it('非空の選択肢は refine を通過する', async () => {
    const { createPostV1Schema } = await import('@/lib/services/post-write-service')
    const result = createPostV1Schema.safeParse({
      poll: { options: ['選択肢A', '選択肢B'], durationSeconds: 3600 },
    })
    expect(result.success).toBe(true)
  })

  it('VALID_POLL_DURATIONS に含まれない durationSeconds は無効', async () => {
    const { createPostV1Schema } = await import('@/lib/services/post-write-service')
    const result = createPostV1Schema.safeParse({
      poll: { options: ['選択肢A', '選択肢B'], durationSeconds: 999 },
    })
    expect(result.success).toBe(false)
  })

  it('VALID_POLL_DURATIONS に含まれる durationSeconds は有効', async () => {
    const { createPostV1Schema } = await import('@/lib/services/post-write-service')
    const result = createPostV1Schema.safeParse({
      poll: { options: ['選択肢A', '選択肢B'], durationSeconds: 21600 },
    })
    expect(result.success).toBe(true)
  })

  it('poll を省略すると default 値で成功する', async () => {
    const { createPostV1Schema } = await import('@/lib/services/post-write-service')
    const result = createPostV1Schema.safeParse({})
    expect(result.success).toBe(true)
  })
})
