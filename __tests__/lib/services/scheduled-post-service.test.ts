// @vitest-environment node
/**
 * lib/services/scheduled-post-service のユニットテスト
 *
 * listScheduledPostsV1 / getScheduledPostV1 / createScheduledPostV1 /
 * updateScheduledPostV1 / cancelScheduledPostV1 / deleteScheduledPostV1 の
 * プレミアム判定・所有者ガード・状態制約・上限・mediaUrls 検証・cancel vs delete を網羅する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ──────────────────────────────────────────────────
// Mock: prisma
// ──────────────────────────────────────────────────
const mockScheduledPostFindMany = vi.fn()
const mockScheduledPostFindUnique = vi.fn()
const mockScheduledPostCreate = vi.fn()
const mockScheduledPostUpdate = vi.fn()
const mockScheduledPostDelete = vi.fn()
const mockScheduledPostCount = vi.fn()
const mockScheduledPostMediaDeleteMany = vi.fn()
const mockScheduledPostGenreDeleteMany = vi.fn()
const mockTransaction = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    scheduledPost: {
      findMany: (...args: unknown[]) => mockScheduledPostFindMany(...args),
      findUnique: (...args: unknown[]) => mockScheduledPostFindUnique(...args),
      create: (...args: unknown[]) => mockScheduledPostCreate(...args),
      update: (...args: unknown[]) => mockScheduledPostUpdate(...args),
      delete: (...args: unknown[]) => mockScheduledPostDelete(...args),
      count: (...args: unknown[]) => mockScheduledPostCount(...args),
    },
    scheduledPostMedia: {
      deleteMany: (...args: unknown[]) => mockScheduledPostMediaDeleteMany(...args),
    },
    scheduledPostGenre: {
      deleteMany: (...args: unknown[]) => mockScheduledPostGenreDeleteMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

// ──────────────────────────────────────────────────
// Mock: isPremiumUser / getMembershipLimits
// ──────────────────────────────────────────────────
const mockIsPremiumUser = vi.fn()
const mockGetMembershipLimits = vi.fn()
vi.mock('@/lib/premium', () => ({
  isPremiumUser: (...args: unknown[]) => mockIsPremiumUser(...args),
  getMembershipLimits: (...args: unknown[]) => mockGetMembershipLimits(...args),
}))

// ──────────────────────────────────────────────────
// Mock: validateMediaCounts
// ──────────────────────────────────────────────────
const mockValidateMediaCounts = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  validateMediaCounts: (...args: unknown[]) => mockValidateMediaCounts(...args),
}))

// ──────────────────────────────────────────────────
// Mock: assertMediaUrlsFromOwnStorage
// ──────────────────────────────────────────────────
const mockAssertMediaUrls = vi.fn()
vi.mock('@/lib/services/media-url-validator', () => ({
  assertMediaUrlsFromOwnStorage: (...args: unknown[]) => mockAssertMediaUrls(...args),
}))

// ──────────────────────────────────────────────────
// Mock: deleteMediaFiles
// ──────────────────────────────────────────────────
const mockDeleteMediaFiles = vi.fn()
vi.mock('@/lib/services/media-cleanup', () => ({
  deleteMediaFiles: (...args: unknown[]) => mockDeleteMediaFiles(...args),
}))

// ──────────────────────────────────────────────────
// Mock: POST_GENRE_RELATION（Prisma include 定数）
// ──────────────────────────────────────────────────
vi.mock('@/lib/prisma/shared-includes', () => ({
  POST_GENRE_RELATION: {
    select: {
      genre: { select: { id: true, name: true } },
    },
  },
}))

// ──────────────────────────────────────────────────
// テストデータ
// ──────────────────────────────────────────────────
const OWNER_ID = 'user-owner'
const OTHER_ID = 'user-other'
const SP_ID = 'sp-test-01'

const PREMIUM_LIMITS = {
  maxPostLength: 2000,
  maxImages: 6,
  maxVideos: 1,
  maxDailyPosts: 40,
  canSchedulePost: true,
  canViewAnalytics: true,
}

/** 有効な未来の日時（現在から1時間後） */
function futureISO(offsetMs = 60 * 60 * 1000): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

/** 30日超の日時 */
function tooFarISO(): string {
  return new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString()
}

const MOCK_SP_RAW = {
  id: SP_ID,
  userId: OWNER_ID,
  content: 'テスト予約投稿',
  scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
  status: 'pending' as const,
  publishedPostId: null,
  createdAt: new Date(),
  media: [],
  genres: [],
}

const validCreateInput = {
  content: 'テスト内容',
  scheduledAt: futureISO(),
  genreIds: [] as string[],
  mediaUrls: [] as string[],
  mediaTypes: [] as ('image' | 'video')[],
}

// ──────────────────────────────────────────────────
// listScheduledPostsV1
// ──────────────────────────────────────────────────
describe('listScheduledPostsV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPremiumUser.mockResolvedValue(true)
    mockScheduledPostFindMany.mockResolvedValue([MOCK_SP_RAW])
  })

  it('プレミアムユーザーは { ok: true, items, nextCursor } を返す', async () => {
    const { listScheduledPostsV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await listScheduledPostsV1(OWNER_ID, undefined, 20)
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('unexpected error')
    expect(Array.isArray(result.items)).toBe(true)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({ id: SP_ID, status: 'pending' })
  })

  it('非プレミアムユーザーは { ok: false, status: 403 } を返す', async () => {
    mockIsPremiumUser.mockResolvedValue(false)
    const { listScheduledPostsV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await listScheduledPostsV1(OWNER_ID, undefined, 20)
    expect(result).toMatchObject({ ok: false, status: 403 })
  })

  it('取得件数が limit と同じとき nextCursor に最後の id を返す', async () => {
    mockScheduledPostFindMany.mockResolvedValue([MOCK_SP_RAW])
    const { listScheduledPostsV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await listScheduledPostsV1(OWNER_ID, undefined, 1)
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('unexpected error')
    expect(result.nextCursor).toBe(SP_ID)
  })

  it('取得件数が limit 未満のとき nextCursor は null', async () => {
    const { listScheduledPostsV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await listScheduledPostsV1(OWNER_ID, undefined, 20)
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('unexpected error')
    expect(result.nextCursor).toBeNull()
  })

  it('cursor 引数がある場合 prisma に cursor + skip が渡る', async () => {
    const { listScheduledPostsV1 } = await import('@/lib/services/scheduled-post-service')
    await listScheduledPostsV1(OWNER_ID, 'cursor-id', 20)
    const call = mockScheduledPostFindMany.mock.calls[0]?.[0]
    expect(call).toMatchObject({ cursor: { id: 'cursor-id' }, skip: 1 })
  })

  it('空配列のとき items は [] で nextCursor は null', async () => {
    mockScheduledPostFindMany.mockResolvedValue([])
    const { listScheduledPostsV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await listScheduledPostsV1(OWNER_ID, undefined, 20)
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('unexpected error')
    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })

  it('items の各フィールド形状（scheduledAt は ISO 文字列）が正しい', async () => {
    const { listScheduledPostsV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await listScheduledPostsV1(OWNER_ID, undefined, 20)
    if (!result.ok) throw new Error('unexpected error')
    const item = result.items[0]
    expect(typeof item?.scheduledAt).toBe('string')
    expect(typeof item?.createdAt).toBe('string')
    expect(typeof item?.id).toBe('string')
  })
})

// ──────────────────────────────────────────────────
// getScheduledPostV1
// ──────────────────────────────────────────────────
describe('getScheduledPostV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPremiumUser.mockResolvedValue(true)
    mockScheduledPostFindUnique.mockResolvedValue(MOCK_SP_RAW)
  })

  it('所有者かつプレミアムは { ok: true, item } を返す', async () => {
    const { getScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await getScheduledPostV1(OWNER_ID, SP_ID)
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('unexpected error')
    expect(result.item.id).toBe(SP_ID)
  })

  it('非プレミアムは { ok: false, status: 403 }', async () => {
    mockIsPremiumUser.mockResolvedValue(false)
    const { getScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await getScheduledPostV1(OWNER_ID, SP_ID)
    expect(result).toMatchObject({ ok: false, status: 403 })
  })

  it('存在しない ID は { ok: false, status: 404 }', async () => {
    mockScheduledPostFindUnique.mockResolvedValue(null)
    const { getScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await getScheduledPostV1(OWNER_ID, 'nonexistent')
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('他人の予約投稿は { ok: false, status: 404 }（存在を秘匿）', async () => {
    const { getScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await getScheduledPostV1(OTHER_ID, SP_ID)
    expect(result).toMatchObject({ ok: false, status: 404 })
  })
})

// ──────────────────────────────────────────────────
// createScheduledPostV1
// ──────────────────────────────────────────────────
describe('createScheduledPostV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPremiumUser.mockResolvedValue(true)
    mockGetMembershipLimits.mockResolvedValue(PREMIUM_LIMITS)
    mockValidateMediaCounts.mockResolvedValue(null)
    mockAssertMediaUrls.mockReturnValue(true)
    mockScheduledPostCount.mockResolvedValue(0)
    mockScheduledPostCreate.mockResolvedValue({ id: SP_ID })
  })

  it('正常系: { ok: true, id } を返す', async () => {
    const { createScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await createScheduledPostV1(OWNER_ID, validCreateInput)
    expect(result).toMatchObject({ ok: true, id: SP_ID })
    expect(mockScheduledPostCreate).toHaveBeenCalledOnce()
  })

  it('非プレミアムは { ok: false, status: 403 }', async () => {
    mockIsPremiumUser.mockResolvedValue(false)
    const { createScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await createScheduledPostV1(OWNER_ID, validCreateInput)
    expect(result).toMatchObject({ ok: false, status: 403 })
    expect(mockScheduledPostCreate).not.toHaveBeenCalled()
  })

  it('過去日時で scheduledAt を渡すと { ok: false, status: 400 }', async () => {
    const { createScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await createScheduledPostV1(OWNER_ID, {
      ...validCreateInput,
      scheduledAt: new Date(Date.now() - 1000).toISOString(),
    })
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('30 日先超過の scheduledAt で { ok: false, status: 400 }', async () => {
    const { createScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await createScheduledPostV1(OWNER_ID, {
      ...validCreateInput,
      scheduledAt: tooFarISO(),
    })
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('不正な日付文字列で { ok: false, status: 400 }', async () => {
    const { createScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await createScheduledPostV1(OWNER_ID, {
      ...validCreateInput,
      scheduledAt: 'not-a-date',
    })
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('content と mediaUrls が両方空で { ok: false, status: 400 }', async () => {
    const { createScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await createScheduledPostV1(OWNER_ID, {
      ...validCreateInput,
      content: '',
      mediaUrls: [],
    })
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('2000 文字超の content で { ok: false, status: 400 }', async () => {
    const { createScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await createScheduledPostV1(OWNER_ID, {
      ...validCreateInput,
      content: 'a'.repeat(2001),
    })
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('2000 文字ちょうどの content は通る', async () => {
    const { createScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await createScheduledPostV1(OWNER_ID, {
      ...validCreateInput,
      content: 'a'.repeat(2000),
    })
    expect(result).toMatchObject({ ok: true })
  })

  it('ジャンル 4 件超過で { ok: false, status: 400 }', async () => {
    const { createScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await createScheduledPostV1(OWNER_ID, {
      ...validCreateInput,
      genreIds: ['g1', 'g2', 'g3', 'g4'],
    })
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('validateMediaCounts が error を返すと { ok: false, status: 400 }', async () => {
    mockValidateMediaCounts.mockResolvedValue({ success: false, error: '画像は6枚までです' })
    const { createScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await createScheduledPostV1(OWNER_ID, {
      ...validCreateInput,
      mediaUrls: ['/uploads/a.jpg'],
      mediaTypes: ['image' as const],
    })
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('外部 mediaUrls で assertMediaUrlsFromOwnStorage が false → { ok: false, status: 400 }', async () => {
    mockAssertMediaUrls.mockReturnValue(false)
    const { createScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await createScheduledPostV1(OWNER_ID, {
      ...validCreateInput,
      mediaUrls: ['https://evil.example.com/spy.gif'],
      mediaTypes: ['image' as const],
    })
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('保留 10 件超過で { ok: false, status: 400 }', async () => {
    mockScheduledPostCount.mockResolvedValue(10)
    const { createScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await createScheduledPostV1(OWNER_ID, validCreateInput)
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('保留 9 件は通る', async () => {
    mockScheduledPostCount.mockResolvedValue(9)
    const { createScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await createScheduledPostV1(OWNER_ID, validCreateInput)
    expect(result).toMatchObject({ ok: true })
  })

  it('prisma.scheduledPost.create に正しく userId が渡る', async () => {
    const { createScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    await createScheduledPostV1(OWNER_ID, validCreateInput)
    const callArg = mockScheduledPostCreate.mock.calls[0]?.[0]
    expect(callArg?.data?.userId).toBe(OWNER_ID)
  })
})

// ──────────────────────────────────────────────────
// updateScheduledPostV1
// ──────────────────────────────────────────────────
describe('updateScheduledPostV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPremiumUser.mockResolvedValue(true)
    mockGetMembershipLimits.mockResolvedValue(PREMIUM_LIMITS)
    mockValidateMediaCounts.mockResolvedValue(null)
    mockAssertMediaUrls.mockReturnValue(true)
    mockScheduledPostFindUnique.mockResolvedValue({
      userId: OWNER_ID,
      status: 'pending',
    })
    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          scheduledPostMedia: { deleteMany: mockScheduledPostMediaDeleteMany },
          scheduledPostGenre: { deleteMany: mockScheduledPostGenreDeleteMany },
          scheduledPost: { update: mockScheduledPostUpdate },
        }),
    )
    mockScheduledPostMediaDeleteMany.mockResolvedValue(undefined)
    mockScheduledPostGenreDeleteMany.mockResolvedValue(undefined)
    mockScheduledPostUpdate.mockResolvedValue({ id: SP_ID })
  })

  it('正常系: { ok: true } を返す', async () => {
    const { updateScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await updateScheduledPostV1(OWNER_ID, SP_ID, validCreateInput)
    expect(result).toMatchObject({ ok: true })
  })

  it('非プレミアムは { ok: false, status: 403 }', async () => {
    mockIsPremiumUser.mockResolvedValue(false)
    const { updateScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await updateScheduledPostV1(OWNER_ID, SP_ID, validCreateInput)
    expect(result).toMatchObject({ ok: false, status: 403 })
  })

  it('存在しない ID は { ok: false, status: 404 }', async () => {
    mockScheduledPostFindUnique.mockResolvedValue(null)
    const { updateScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await updateScheduledPostV1(OWNER_ID, 'nonexistent', validCreateInput)
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('他人の予約投稿は { ok: false, status: 404 }', async () => {
    const { updateScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await updateScheduledPostV1(OTHER_ID, SP_ID, validCreateInput)
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('published 状態の投稿は編集不可 → { ok: false, status: 400 }', async () => {
    mockScheduledPostFindUnique.mockResolvedValue({ userId: OWNER_ID, status: 'published' })
    const { updateScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await updateScheduledPostV1(OWNER_ID, SP_ID, validCreateInput)
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('cancelled 状態の投稿は編集不可 → { ok: false, status: 400 }', async () => {
    mockScheduledPostFindUnique.mockResolvedValue({ userId: OWNER_ID, status: 'cancelled' })
    const { updateScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await updateScheduledPostV1(OWNER_ID, SP_ID, validCreateInput)
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('failed 状態の投稿は編集不可 → { ok: false, status: 400 }', async () => {
    mockScheduledPostFindUnique.mockResolvedValue({ userId: OWNER_ID, status: 'failed' })
    const { updateScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await updateScheduledPostV1(OWNER_ID, SP_ID, validCreateInput)
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('外部 mediaUrls で { ok: false, status: 400 }', async () => {
    mockAssertMediaUrls.mockReturnValue(false)
    const { updateScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await updateScheduledPostV1(OWNER_ID, SP_ID, {
      ...validCreateInput,
      mediaUrls: ['https://evil.example.com/spy.gif'],
      mediaTypes: ['image' as const],
    })
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('2000 文字超の content で { ok: false, status: 400 }', async () => {
    const { updateScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await updateScheduledPostV1(OWNER_ID, SP_ID, {
      ...validCreateInput,
      content: 'a'.repeat(2001),
    })
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('$transaction 内で scheduledPostMedia.deleteMany が呼ばれる', async () => {
    const { updateScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    await updateScheduledPostV1(OWNER_ID, SP_ID, validCreateInput)
    expect(mockScheduledPostMediaDeleteMany).toHaveBeenCalled()
    expect(mockScheduledPostGenreDeleteMany).toHaveBeenCalled()
  })
})

// ──────────────────────────────────────────────────
// cancelScheduledPostV1（ソフトキャンセル）
// ──────────────────────────────────────────────────
describe('cancelScheduledPostV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockScheduledPostFindUnique.mockResolvedValue({
      userId: OWNER_ID,
      status: 'pending',
    })
    mockScheduledPostUpdate.mockResolvedValue({ id: SP_ID })
  })

  it('正常系: { ok: true } を返す', async () => {
    const { cancelScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await cancelScheduledPostV1(OWNER_ID, SP_ID)
    expect(result).toMatchObject({ ok: true })
  })

  it('status が cancelled になるよう update が呼ばれる', async () => {
    const { cancelScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    await cancelScheduledPostV1(OWNER_ID, SP_ID)
    const call = mockScheduledPostUpdate.mock.calls[0]?.[0]
    expect(call?.data?.status).toBe('cancelled')
  })

  it('cancel は delete を呼ばない（ソフトキャンセル・DB 残存）', async () => {
    const { cancelScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    await cancelScheduledPostV1(OWNER_ID, SP_ID)
    expect(mockScheduledPostDelete).not.toHaveBeenCalled()
    expect(mockDeleteMediaFiles).not.toHaveBeenCalled()
  })

  it('存在しない ID は { ok: false, status: 404 }', async () => {
    mockScheduledPostFindUnique.mockResolvedValue(null)
    const { cancelScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await cancelScheduledPostV1(OWNER_ID, 'nonexistent')
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('他人の予約投稿は { ok: false, status: 404 }', async () => {
    const { cancelScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await cancelScheduledPostV1(OTHER_ID, SP_ID)
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('published 状態はキャンセル不可 → { ok: false, status: 400 }', async () => {
    mockScheduledPostFindUnique.mockResolvedValue({ userId: OWNER_ID, status: 'published' })
    const { cancelScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await cancelScheduledPostV1(OWNER_ID, SP_ID)
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('cancelled 状態はキャンセル不可 → { ok: false, status: 400 }', async () => {
    mockScheduledPostFindUnique.mockResolvedValue({ userId: OWNER_ID, status: 'cancelled' })
    const { cancelScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await cancelScheduledPostV1(OWNER_ID, SP_ID)
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('failed 状態はキャンセル不可 → { ok: false, status: 400 }', async () => {
    mockScheduledPostFindUnique.mockResolvedValue({ userId: OWNER_ID, status: 'failed' })
    const { cancelScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await cancelScheduledPostV1(OWNER_ID, SP_ID)
    expect(result).toMatchObject({ ok: false, status: 400 })
  })
})

// ──────────────────────────────────────────────────
// deleteScheduledPostV1（ハード削除）
// ──────────────────────────────────────────────────
describe('deleteScheduledPostV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockScheduledPostFindUnique.mockResolvedValue({
      userId: OWNER_ID,
      status: 'pending',
      media: [{ url: 'https://cdn.example.com/media/test.jpg' }],
    })
    mockScheduledPostDelete.mockResolvedValue({ id: SP_ID })
    mockDeleteMediaFiles.mockResolvedValue(undefined)
  })

  it('正常系: { ok: true } を返す', async () => {
    const { deleteScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await deleteScheduledPostV1(OWNER_ID, SP_ID)
    expect(result).toMatchObject({ ok: true })
  })

  it('scheduledPost.delete が呼ばれる（ハード削除）', async () => {
    const { deleteScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    await deleteScheduledPostV1(OWNER_ID, SP_ID)
    expect(mockScheduledPostDelete).toHaveBeenCalledOnce()
  })

  it('deleteMediaFiles が呼ばれてストレージ実体も回収する', async () => {
    const { deleteScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    await deleteScheduledPostV1(OWNER_ID, SP_ID)
    expect(mockDeleteMediaFiles).toHaveBeenCalledOnce()
    expect(mockDeleteMediaFiles).toHaveBeenCalledWith(['https://cdn.example.com/media/test.jpg'])
  })

  it('media が空のとき deleteMediaFiles に空配列が渡る', async () => {
    mockScheduledPostFindUnique.mockResolvedValue({
      userId: OWNER_ID,
      status: 'pending',
      media: [],
    })
    const { deleteScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    await deleteScheduledPostV1(OWNER_ID, SP_ID)
    expect(mockDeleteMediaFiles).toHaveBeenCalledWith([])
  })

  it('存在しない ID は { ok: false, status: 404 }', async () => {
    mockScheduledPostFindUnique.mockResolvedValue(null)
    const { deleteScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await deleteScheduledPostV1(OWNER_ID, 'nonexistent')
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('他人の予約投稿は { ok: false, status: 404 }', async () => {
    const { deleteScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await deleteScheduledPostV1(OTHER_ID, SP_ID)
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('published 状態は削除不可 → { ok: false, status: 400 }', async () => {
    mockScheduledPostFindUnique.mockResolvedValue({
      userId: OWNER_ID,
      status: 'published',
      media: [],
    })
    const { deleteScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await deleteScheduledPostV1(OWNER_ID, SP_ID)
    expect(result).toMatchObject({ ok: false, status: 400 })
    expect(mockScheduledPostDelete).not.toHaveBeenCalled()
  })

  it('cancelled 状態は削除可能', async () => {
    mockScheduledPostFindUnique.mockResolvedValue({
      userId: OWNER_ID,
      status: 'cancelled',
      media: [],
    })
    const { deleteScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await deleteScheduledPostV1(OWNER_ID, SP_ID)
    expect(result).toMatchObject({ ok: true })
    expect(mockScheduledPostDelete).toHaveBeenCalled()
  })

  it('failed 状態は削除可能', async () => {
    mockScheduledPostFindUnique.mockResolvedValue({
      userId: OWNER_ID,
      status: 'failed',
      media: [],
    })
    const { deleteScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    const result = await deleteScheduledPostV1(OWNER_ID, SP_ID)
    expect(result).toMatchObject({ ok: true })
    expect(mockScheduledPostDelete).toHaveBeenCalled()
  })

  it('delete と cancel の違い: delete は scheduledPost.delete を呼ぶ', async () => {
    const { deleteScheduledPostV1 } = await import('@/lib/services/scheduled-post-service')
    await deleteScheduledPostV1(OWNER_ID, SP_ID)
    expect(mockScheduledPostDelete).toHaveBeenCalledOnce()
    expect(mockScheduledPostUpdate).not.toHaveBeenCalled()
  })
})
