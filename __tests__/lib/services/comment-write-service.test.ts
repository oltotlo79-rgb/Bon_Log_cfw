// @vitest-environment node
/**
 * lib/services/comment-write-service のユニットテスト
 *
 * createCommentV1 / deleteCommentV1 の
 * 所有権・可視性・上限・プレミアム・メディア URL 検証・TOCTOU・通知を網羅する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ──────────────────────────────────────────────────
// Mock: prisma
// ──────────────────────────────────────────────────
const mockPrismaCommentFindUnique = vi.fn()
const mockPrismaCommentCreate = vi.fn()
const mockPrismaCommentUpdate = vi.fn()
const mockPrismaCommentCount = vi.fn()
const mockPrismaTransaction = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    comment: {
      findUnique: (...args: unknown[]) => mockPrismaCommentFindUnique(...args),
      create: (...args: unknown[]) => mockPrismaCommentCreate(...args),
      update: (...args: unknown[]) => mockPrismaCommentUpdate(...args),
      count: (...args: unknown[]) => mockPrismaCommentCount(...args),
    },
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
}))

// ──────────────────────────────────────────────────
// Mock: isPremiumUser
// ──────────────────────────────────────────────────
const mockIsPremiumUser = vi.fn()
vi.mock('@/lib/premium', () => ({
  isPremiumUser: (...args: unknown[]) => mockIsPremiumUser(...args),
  getMembershipLimits: vi.fn(),
}))

// ──────────────────────────────────────────────────
// Mock: validateMediaCounts
// ──────────────────────────────────────────────────
const mockValidateMediaCounts = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  validateMediaCounts: (...args: unknown[]) => mockValidateMediaCounts(...args),
  checkDailyPostLimit: vi.fn(),
}))

// ──────────────────────────────────────────────────
// Mock: media URL validator
// ──────────────────────────────────────────────────
const mockAssertMediaUrls = vi.fn()
vi.mock('@/lib/services/media-url-validator', () => ({
  assertMediaUrlsFromOwnStorage: (...args: unknown[]) => mockAssertMediaUrls(...args),
}))

// ──────────────────────────────────────────────────
// Mock: post-visibility
// ──────────────────────────────────────────────────
const mockAssertCanViewPost = vi.fn()
vi.mock('@/lib/services/post-visibility', () => ({
  assertCanViewPost: (...args: unknown[]) => mockAssertCanViewPost(...args),
}))

// ──────────────────────────────────────────────────
// Mock: comment-notifications
// ──────────────────────────────────────────────────
const mockNotifyCommentParticipants = vi.fn()
vi.mock('@/lib/services/comment-notifications', () => ({
  notifyCommentParticipants: (...args: unknown[]) => mockNotifyCommentParticipants(...args),
}))

vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/utils', () => ({
  getStartOfToday: () => new Date('2026-06-17T00:00:00.000Z'),
}))

// ──────────────────────────────────────────────────
// Constants for tests
// ──────────────────────────────────────────────────
const COMMENT_OWNER_ID = 'user-commenter'
const POST_OWNER_ID = 'user-post-owner'
const OTHER_ID = 'user-other'
const POST_ID = 'post-cjld2'
const COMMENT_ID = 'comment-cjld2'

const validCommentInput = {
  content: 'テストコメント',
  parentId: null as string | null | undefined,
  mediaUrls: [] as string[],
  mediaTypes: [] as ('image' | 'video')[],
}

// ──────────────────────────────────────────────────
// createCommentV1
// ──────────────────────────────────────────────────
describe('createCommentV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPremiumUser.mockResolvedValue(false)
    mockValidateMediaCounts.mockResolvedValue(null)
    mockAssertMediaUrls.mockReturnValue(true)
    mockAssertCanViewPost.mockResolvedValue(true)
    mockNotifyCommentParticipants.mockResolvedValue(undefined)

    // デフォルトのトランザクション実装: 制限内でコメント作成成功
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          comment: {
            count: () => Promise.resolve(0),
            create: () => Promise.resolve({ id: COMMENT_ID, postId: POST_ID, userId: COMMENT_OWNER_ID }),
          },
        }),
    )
  })

  it('正常系: { ok: true, commentId } を返す', async () => {
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(POST_ID, validCommentInput, COMMENT_OWNER_ID)
    expect(result).toEqual({ ok: true, commentId: COMMENT_ID })
  })

  it('本文もメディアも空 → status 400', async () => {
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(
      POST_ID,
      { ...validCommentInput, content: '', mediaUrls: [] },
      COMMENT_OWNER_ID,
    )
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('501 文字の本文 → status 400', async () => {
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(
      POST_ID,
      { ...validCommentInput, content: 'a'.repeat(501) },
      COMMENT_OWNER_ID,
    )
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('500 文字の本文 → ok', async () => {
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(
      POST_ID,
      { ...validCommentInput, content: 'a'.repeat(500) },
      COMMENT_OWNER_ID,
    )
    expect(result).toMatchObject({ ok: true })
  })

  it('不可視投稿（assertCanViewPost=false）は 404', async () => {
    mockAssertCanViewPost.mockResolvedValue(false)
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(POST_ID, validCommentInput, COMMENT_OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('validateMediaCounts がエラーを返す → status 400', async () => {
    mockValidateMediaCounts.mockResolvedValue({ success: false, error: '画像は2枚までです' })
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(
      POST_ID,
      { ...validCommentInput, mediaUrls: ['/uploads/a.webp', '/uploads/b.webp', '/uploads/c.webp'], mediaTypes: ['image', 'image', 'image'] as ('image' | 'video')[] },
      COMMENT_OWNER_ID,
    )
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('外部 mediaUrls → status 400', async () => {
    mockAssertMediaUrls.mockReturnValue(false)
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(
      POST_ID,
      { ...validCommentInput, mediaUrls: ['https://evil.com/spy.gif'], mediaTypes: ['image' as const] },
      COMMENT_OWNER_ID,
    )
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('無料ユーザー: 動画を付けると validateMediaCounts がエラー（MAX_COMMENT_VIDEOS_FREE=0）', async () => {
    mockIsPremiumUser.mockResolvedValue(false)
    mockValidateMediaCounts.mockResolvedValue({ success: false, error: '動画の投稿はプレミアム会員限定です' })
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(
      POST_ID,
      { ...validCommentInput, mediaUrls: ['/uploads/v.mp4'], mediaTypes: ['video' as const] },
      COMMENT_OWNER_ID,
    )
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('プレミアムユーザー: 動画 1 本は validateMediaCounts が通る', async () => {
    mockIsPremiumUser.mockResolvedValue(true)
    mockValidateMediaCounts.mockResolvedValue(null)
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(
      POST_ID,
      { ...validCommentInput, mediaUrls: ['/uploads/v.mp4'], mediaTypes: ['video' as const] },
      COMMENT_OWNER_ID,
    )
    expect(result).toMatchObject({ ok: true })
  })

  it('1日コメント上限超過（tx内で count >= DAILY_COMMENT_LIMIT）→ status 429', async () => {
    // DAILY_COMMENT_LIMIT = 100 なので 100 を返す
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          comment: {
            count: () => Promise.resolve(100),
            create: vi.fn(),
          },
        }),
    )
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(POST_ID, validCommentInput, COMMENT_OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 429 })
  })

  it('TOCTOU: count チェックと create が同一 tx 内で実行される', async () => {
    const txFn = vi.fn().mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          comment: {
            count: () => Promise.resolve(0),
            create: () => Promise.resolve({ id: COMMENT_ID }),
          },
        }),
    )
    mockPrismaTransaction.mockImplementation(txFn)
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    await createCommentV1(POST_ID, validCommentInput, COMMENT_OWNER_ID)
    expect(txFn).toHaveBeenCalledTimes(1)
  })

  it('通知: notifyCommentParticipants が呼ばれる', async () => {
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    await createCommentV1(POST_ID, validCommentInput, COMMENT_OWNER_ID)
    // void 呼び出しのため、少しだけ待つ
    await new Promise((r) => setTimeout(r, 10))
    expect(mockNotifyCommentParticipants).toHaveBeenCalledWith(
      POST_ID,
      COMMENT_ID,
      COMMENT_OWNER_ID,
      null,
    )
  })

  it('通知が失敗してもコメント作成は成功する（best-effort）', async () => {
    mockNotifyCommentParticipants.mockRejectedValue(new Error('Notification failed'))
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(POST_ID, validCommentInput, COMMENT_OWNER_ID)
    expect(result).toMatchObject({ ok: true })
  })

  it('tx が例外を throw → { ok: false, status: 500 }', async () => {
    mockPrismaTransaction.mockRejectedValue(new Error('DB crash'))
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(POST_ID, validCommentInput, COMMENT_OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 500 })
  })

  it('tx が Error以外の値を throw しても { ok: false, status: 500 } を返す（非Error rejection の防御）', async () => {
    mockPrismaTransaction.mockRejectedValue('raw rejection string')
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(POST_ID, validCommentInput, COMMENT_OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 500, error: expect.any(String) })
  })

  it('通知が Error以外の値で reject しても、ログ処理でクラッシュせずコメント作成は成功する', async () => {
    mockNotifyCommentParticipants.mockRejectedValue('raw notification rejection')
    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(POST_ID, validCommentInput, COMMENT_OWNER_ID)
    await new Promise((r) => setTimeout(r, 10))
    expect(result).toMatchObject({ ok: true })
  })

  it('mediaTypes が mediaUrls より短い場合、対応する型は image にフォールバックする', async () => {
    let capturedMediaCreate: { url: string; type: string; sortOrder: number }[] | undefined
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          comment: {
            count: () => Promise.resolve(0),
            create: (args: { data: { media?: { create: { url: string; type: string; sortOrder: number }[] } } }) => {
              capturedMediaCreate = args.data.media?.create
              return Promise.resolve({ id: COMMENT_ID })
            },
          },
        }),
    )

    const { createCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await createCommentV1(
      POST_ID,
      { ...validCommentInput, mediaUrls: ['/uploads/a.webp'], mediaTypes: [] },
      COMMENT_OWNER_ID,
    )

    expect(result).toMatchObject({ ok: true })
    expect(capturedMediaCreate?.[0]?.type).toBe('image')
  })

  // ────────────────────────────────────────────────
  // parentId (返信) のバリデーション
  // ────────────────────────────────────────────────
  describe('parentId (返信コメント) のバリデーション', () => {
    it('parentId が有効（同一投稿・非表示でない・未削除）なら作成できる', async () => {
      mockPrismaCommentFindUnique.mockResolvedValue({
        postId: POST_ID,
        isHidden: false,
        deletedAt: null,
      })
      const { createCommentV1 } = await import('@/lib/services/comment-write-service')
      const result = await createCommentV1(
        POST_ID,
        { ...validCommentInput, parentId: 'parent-1' },
        COMMENT_OWNER_ID,
      )
      expect(result).toMatchObject({ ok: true })
    })

    it('parentId が存在しない → 404', async () => {
      mockPrismaCommentFindUnique.mockResolvedValue(null)
      const { createCommentV1 } = await import('@/lib/services/comment-write-service')
      const result = await createCommentV1(
        POST_ID,
        { ...validCommentInput, parentId: 'parent-ghost' },
        COMMENT_OWNER_ID,
      )
      expect(result).toMatchObject({ ok: false, status: 404, error: expect.any(String) })
    })

    it('parentId が別の投稿に属する → 404', async () => {
      mockPrismaCommentFindUnique.mockResolvedValue({
        postId: 'other-post',
        isHidden: false,
        deletedAt: null,
      })
      const { createCommentV1 } = await import('@/lib/services/comment-write-service')
      const result = await createCommentV1(
        POST_ID,
        { ...validCommentInput, parentId: 'parent-1' },
        COMMENT_OWNER_ID,
      )
      expect(result).toMatchObject({ ok: false, status: 404 })
    })

    it('parentId が非表示コメント → 404', async () => {
      mockPrismaCommentFindUnique.mockResolvedValue({
        postId: POST_ID,
        isHidden: true,
        deletedAt: null,
      })
      const { createCommentV1 } = await import('@/lib/services/comment-write-service')
      const result = await createCommentV1(
        POST_ID,
        { ...validCommentInput, parentId: 'parent-1' },
        COMMENT_OWNER_ID,
      )
      expect(result).toMatchObject({ ok: false, status: 404 })
    })

    it('parentId が削除済みコメント → 404', async () => {
      mockPrismaCommentFindUnique.mockResolvedValue({
        postId: POST_ID,
        isHidden: false,
        deletedAt: new Date(),
      })
      const { createCommentV1 } = await import('@/lib/services/comment-write-service')
      const result = await createCommentV1(
        POST_ID,
        { ...validCommentInput, parentId: 'parent-1' },
        COMMENT_OWNER_ID,
      )
      expect(result).toMatchObject({ ok: false, status: 404 })
    })
  })
})

// ──────────────────────────────────────────────────
// deleteCommentV1
// ──────────────────────────────────────────────────
describe('deleteCommentV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrismaCommentFindUnique.mockResolvedValue({
      userId: COMMENT_OWNER_ID,
      postId: POST_ID,
      post: { userId: POST_OWNER_ID },
    })
    mockPrismaCommentUpdate.mockResolvedValue(undefined)
  })

  it('正常系: コメント所有者が削除 → { ok: true }', async () => {
    const { deleteCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await deleteCommentV1(COMMENT_ID, COMMENT_OWNER_ID)
    expect(result).toEqual({ ok: true })
  })

  it('正常系: 投稿所有者がコメントを削除できる', async () => {
    const { deleteCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await deleteCommentV1(COMMENT_ID, POST_OWNER_ID)
    expect(result).toEqual({ ok: true })
  })

  it('コメント所有者でも投稿所有者でもない → 403', async () => {
    const { deleteCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await deleteCommentV1(COMMENT_ID, OTHER_ID)
    expect(result).toMatchObject({ ok: false, status: 403 })
  })

  it('存在しないコメント → 404', async () => {
    mockPrismaCommentFindUnique.mockResolvedValue(null)
    const { deleteCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await deleteCommentV1(COMMENT_ID, COMMENT_OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('soft delete: prisma.comment.update が deletedAt で呼ばれる', async () => {
    const { deleteCommentV1 } = await import('@/lib/services/comment-write-service')
    await deleteCommentV1(COMMENT_ID, COMMENT_OWNER_ID)
    expect(mockPrismaCommentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: COMMENT_ID },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    )
  })

  it('prisma.comment.update が例外を throw → { ok: false, status: 500 }', async () => {
    mockPrismaCommentUpdate.mockRejectedValue(new Error('DB error'))
    const { deleteCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await deleteCommentV1(COMMENT_ID, COMMENT_OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 500 })
  })

  it('prisma.comment.update が Error以外の値を throw しても { ok: false, status: 500 } を返す', async () => {
    mockPrismaCommentUpdate.mockRejectedValue('raw db rejection')
    const { deleteCommentV1 } = await import('@/lib/services/comment-write-service')
    const result = await deleteCommentV1(COMMENT_ID, COMMENT_OWNER_ID)
    expect(result).toMatchObject({ ok: false, status: 500, error: expect.any(String) })
  })
})
