// @vitest-environment node
/**
 * lib/services/repost-service の addRepost / removeRepost ユニットテスト。
 *
 * 自己リポスト禁止・閲覧権限チェック・日次上限・冪等性（既存リポストの重複防止、
 * P2002 競合時のフォールバック）・通知発火を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockPostFindUnique = vi.fn()
const mockPostCount = vi.fn()
const mockPostDeleteMany = vi.fn()
const mockTxPostFindFirst = vi.fn()
const mockTxPostFindUnique = vi.fn()
const mockTxPostCreate = vi.fn()

const mockTx = {
  post: {
    findFirst: (...args: unknown[]) => mockTxPostFindFirst(...args),
    findUnique: (...args: unknown[]) => mockTxPostFindUnique(...args),
    create: (...args: unknown[]) => mockTxPostCreate(...args),
  },
}

const mockTransaction = vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx))

vi.mock('@/lib/db', () => ({
  prisma: {
    post: {
      findUnique: (...args: unknown[]) => mockPostFindUnique(...args),
      count: (...args: unknown[]) => mockPostCount(...args),
      deleteMany: (...args: unknown[]) => mockPostDeleteMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(args[0] as (tx: typeof mockTx) => unknown),
  },
}))

const mockCreateNotification = vi.fn()
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}))

const mockAssertCanViewPost = vi.fn()
vi.mock('@/lib/services/post-visibility', () => ({
  assertCanViewPost: (...args: unknown[]) => mockAssertCanViewPost(...args),
}))

const mockCheckDailyPostLimit = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  checkDailyPostLimit: (...args: unknown[]) => mockCheckDailyPostLimit(...args),
}))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  default: { error: (...args: unknown[]) => mockLoggerError(...args) },
}))

const USER_ID = 'user-viewer-001'
const AUTHOR_ID = 'user-author-001'
const POST_ID = 'post-target-001'

describe('addRepost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAssertCanViewPost.mockResolvedValue(true)
    mockCheckDailyPostLimit.mockResolvedValue(null)
    mockCreateNotification.mockResolvedValue(undefined)
  })

  it('対象投稿が存在しない場合は 404 POST_NOT_FOUND を返す', async () => {
    mockPostFindUnique.mockResolvedValueOnce(null)

    const { addRepost } = await import('@/lib/services/repost-service')
    const result = await addRepost(POST_ID, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 404 })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('自己リポストの場合は 400 SELF_ACTION を返す', async () => {
    mockPostFindUnique.mockResolvedValueOnce({ userId: USER_ID })

    const { addRepost } = await import('@/lib/services/repost-service')
    const result = await addRepost(POST_ID, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 400 })
    if (result.ok) throw new Error('ok=true')
    const { ERR_SELF_ACTION } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_SELF_ACTION)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('閲覧権限がない場合（非表示・非公開・停止著者）は 404 POST_NOT_FOUND を返す', async () => {
    mockPostFindUnique.mockResolvedValueOnce({ userId: AUTHOR_ID })
    mockAssertCanViewPost.mockResolvedValueOnce(false)

    const { addRepost } = await import('@/lib/services/repost-service')
    const result = await addRepost(POST_ID, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 404 })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('日次投稿上限に達している場合は 429 を返す', async () => {
    mockPostFindUnique.mockResolvedValueOnce({ userId: AUTHOR_ID })
    mockCheckDailyPostLimit.mockResolvedValueOnce({ success: false, error: '1日の投稿上限に達しました' })

    const { addRepost } = await import('@/lib/services/repost-service')
    const result = await addRepost(POST_ID, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 429, error: '1日の投稿上限に達しました' })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('正常系: 新規リポストを作成し、投稿主に通知を送り repostCount を返す', async () => {
    mockPostFindUnique.mockResolvedValueOnce({ userId: AUTHOR_ID })
    mockTxPostFindFirst.mockResolvedValueOnce(null) // 重複なし
    mockTxPostFindUnique.mockResolvedValueOnce({ userId: AUTHOR_ID })
    mockTxPostCreate.mockResolvedValueOnce({ id: 'new-repost-id' })
    mockPostCount.mockResolvedValueOnce(3)

    const { addRepost } = await import('@/lib/services/repost-service')
    const result = await addRepost(POST_ID, USER_ID)

    expect(result).toEqual({ ok: true, reposted: true, repostCount: 3 })
    expect(mockTxPostCreate).toHaveBeenCalledWith({
      data: { userId: USER_ID, repostPostId: POST_ID },
    })
    expect(mockCreateNotification).toHaveBeenCalledWith({
      userId: AUTHOR_ID,
      actorId: USER_ID,
      type: 'repost',
      postId: POST_ID,
    })
  })

  it('冪等性: 既にリポスト済みの場合は create を呼ばず現在の repostCount を返す', async () => {
    mockPostFindUnique.mockResolvedValueOnce({ userId: AUTHOR_ID })
    mockTxPostFindFirst.mockResolvedValueOnce({ id: 'existing-repost-id' })
    mockPostCount.mockResolvedValueOnce(5)

    const { addRepost } = await import('@/lib/services/repost-service')
    const result = await addRepost(POST_ID, USER_ID)

    expect(result).toEqual({ ok: true, reposted: true, repostCount: 5 })
    expect(mockTxPostCreate).not.toHaveBeenCalled()
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('トランザクション内で対象投稿が消えていた場合は 404 POST_NOT_FOUND を返す', async () => {
    mockPostFindUnique.mockResolvedValueOnce({ userId: AUTHOR_ID })
    mockTxPostFindFirst.mockResolvedValueOnce(null)
    mockTxPostFindUnique.mockResolvedValueOnce(null)

    const { addRepost } = await import('@/lib/services/repost-service')
    const result = await addRepost(POST_ID, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 404 })
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('自己リポストは通知を送らない（targetUserId === userId）', async () => {
    // 投稿の作者は他人だが、トランザクション内の target 再取得時点で作者が userId 自身になっているケース
    mockPostFindUnique.mockResolvedValueOnce({ userId: AUTHOR_ID })
    mockTxPostFindFirst.mockResolvedValueOnce(null)
    mockTxPostFindUnique.mockResolvedValueOnce({ userId: USER_ID })
    mockTxPostCreate.mockResolvedValueOnce({ id: 'new-repost-id' })
    mockPostCount.mockResolvedValueOnce(1)

    const { addRepost } = await import('@/lib/services/repost-service')
    const result = await addRepost(POST_ID, USER_ID)

    expect(result).toEqual({ ok: true, reposted: true, repostCount: 1 })
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('並行リクエストによる P2002（unique constraint）は冪等 ON 扱いにフォールバックする', async () => {
    const { Prisma } = await import('@prisma/client')
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.0.0',
      meta: { target: ['userId', 'repostPostId'] },
    })
    mockPostFindUnique.mockResolvedValueOnce({ userId: AUTHOR_ID })
    mockTransaction.mockRejectedValueOnce(p2002)
    mockPostCount.mockResolvedValueOnce(7)

    const { addRepost } = await import('@/lib/services/repost-service')
    const result = await addRepost(POST_ID, USER_ID)

    expect(result).toEqual({ ok: true, reposted: true, repostCount: 7 })
  })

  it('P2002 以外の DB エラーは 500 REPOST_FAILED を返しログに記録する', async () => {
    mockPostFindUnique.mockResolvedValueOnce({ userId: AUTHOR_ID })
    mockTransaction.mockRejectedValueOnce(new Error('DB connection lost'))

    const { addRepost } = await import('@/lib/services/repost-service')
    const result = await addRepost(POST_ID, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 500 })
    if (result.ok) throw new Error('ok=true')
    const { ERR_REPOST_FAILED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_REPOST_FAILED)
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

describe('removeRepost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('元投稿が存在しない場合は 404 POST_NOT_FOUND を返す', async () => {
    mockPostFindUnique.mockResolvedValueOnce(null)

    const { removeRepost } = await import('@/lib/services/repost-service')
    const result = await removeRepost(POST_ID, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 404 })
    expect(mockPostDeleteMany).not.toHaveBeenCalled()
  })

  it('正常系: リポストを削除し repostCount を返す', async () => {
    mockPostFindUnique.mockResolvedValueOnce({ id: POST_ID })
    mockPostDeleteMany.mockResolvedValueOnce({ count: 1 })
    mockPostCount.mockResolvedValueOnce(2)

    const { removeRepost } = await import('@/lib/services/repost-service')
    const result = await removeRepost(POST_ID, USER_ID)

    expect(result).toEqual({ ok: true, reposted: false, repostCount: 2 })
    expect(mockPostDeleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, repostPostId: POST_ID },
    })
  })

  it('冪等性: リポストが存在しなくても成功として repostCount を返す', async () => {
    mockPostFindUnique.mockResolvedValueOnce({ id: POST_ID })
    mockPostDeleteMany.mockResolvedValueOnce({ count: 0 })
    mockPostCount.mockResolvedValueOnce(0)

    const { removeRepost } = await import('@/lib/services/repost-service')
    const result = await removeRepost(POST_ID, USER_ID)

    expect(result).toEqual({ ok: true, reposted: false, repostCount: 0 })
  })

  it('DB エラー時は 500 REPOST_FAILED を返しログに記録する', async () => {
    mockPostFindUnique.mockResolvedValueOnce({ id: POST_ID })
    mockPostDeleteMany.mockRejectedValueOnce(new Error('DB connection lost'))

    const { removeRepost } = await import('@/lib/services/repost-service')
    const result = await removeRepost(POST_ID, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 500 })
    if (result.ok) throw new Error('ok=true')
    const { ERR_REPOST_FAILED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_REPOST_FAILED)
    expect(mockLoggerError).toHaveBeenCalled()
  })
})
