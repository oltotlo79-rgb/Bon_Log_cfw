// @vitest-environment node
/**
 * lib/services/storage-deletion-worker (processStorageDeletionJobs) のユニットテスト
 *
 * 1 cron 実行あたりのフロー:
 *   1. stale processing ジョブの pending 復帰
 *   2. pending かつ nextAttemptAt 到達済みジョブの取得（バッチサイズ上限）
 *   3. 条件付き UPDATE による claim（同時実行 cron との二重処理防止）
 *   4. deleteFile 実行 → 成功/404 は completed、失敗はリトライ or dead_letter
 *   5. 保持期間を過ぎた completed ジョブの削除
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  STORAGE_DELETION_BATCH_SIZE,
  STORAGE_DELETION_MAX_ATTEMPTS,
  ONE_MINUTE_MS,
} from '@/lib/constants/limits'

const mockUpdateMany = vi.fn()
const mockFindMany = vi.fn()
const mockUpdate = vi.fn()
const mockDeleteMany = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    storageDeletionJob: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
  },
}))

const mockDeleteFile = vi.fn()
vi.mock('@/lib/storage', () => ({
  deleteFile: (...args: unknown[]) => mockDeleteFile(...args),
}))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => {
  const impl = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args: unknown[]) => mockLoggerError(...args),
  }
  return { __esModule: true, default: impl, logger: impl }
})

describe('processStorageDeletionJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 既定: stale reclaim 0 件、候補 0 件、purge 0 件
    mockUpdateMany.mockResolvedValue({ count: 0 })
    mockFindMany.mockResolvedValue([])
    mockDeleteMany.mockResolvedValue({ count: 0 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('候補が無い場合は全カウント 0 で返す', async () => {
    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    const result = await processStorageDeletionJobs()

    expect(result).toEqual({
      claimedCount: 0,
      completedCount: 0,
      retriedCount: 0,
      deadLetteredCount: 0,
      reclaimedStaleCount: 0,
      purgedCompletedCount: 0,
    })
  })

  it('stale な processing ジョブを pending に戻し reclaimedStaleCount に反映する', async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 3 }) // reclaim call

    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    const result = await processStorageDeletionJobs()

    expect(result.reclaimedStaleCount).toBe(3)
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { status: 'processing', lockedAt: { lt: expect.any(Date) } },
      data: { status: 'pending', lockedAt: null },
    })
  })

  it('pending バッチ取得は STORAGE_DELETION_BATCH_SIZE 件・nextAttemptAt 到達済み・昇順で取得する', async () => {
    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    await processStorageDeletionJobs()

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { status: 'pending', nextAttemptAt: { lte: expect.any(Date) } },
      orderBy: { nextAttemptAt: 'asc' },
      take: STORAGE_DELETION_BATCH_SIZE,
      select: { id: true, url: true, attemptCount: true },
    })
  })

  it('削除成功時は claim → completed に更新し claimedCount/completedCount をカウントする', async () => {
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // reclaim
      .mockResolvedValueOnce({ count: 1 }) // claim success
    mockFindMany.mockResolvedValueOnce([{ id: 'job-1', url: '/uploads/a.webp', attemptCount: 0 }])
    mockDeleteFile.mockResolvedValueOnce({ success: true })

    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    const result = await processStorageDeletionJobs()

    expect(result.claimedCount).toBe(1)
    expect(result.completedCount).toBe(1)
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'job-1', status: 'pending' },
      data: { status: 'processing', lockedAt: expect.any(Date) },
    })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'completed', completedAt: expect.any(Date), lastError: null, lockedAt: null },
    })
  })

  it('404/ENOENT（notFound: true）も idempotent success として completed 扱いにする', async () => {
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    mockFindMany.mockResolvedValueOnce([{ id: 'job-404', url: '/uploads/gone.webp', attemptCount: 1 }])
    mockDeleteFile.mockResolvedValueOnce({ success: true, notFound: true })

    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    const result = await processStorageDeletionJobs()

    expect(result.completedCount).toBe(1)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-404' }, data: expect.objectContaining({ status: 'completed' }) }),
    )
  })

  it('claim に失敗した場合（他 cron が既に処理中）は claimedCount にカウントしない', async () => {
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // reclaim
      .mockResolvedValueOnce({ count: 0 }) // claim collision
    mockFindMany.mockResolvedValueOnce([{ id: 'job-2', url: '/uploads/b.webp', attemptCount: 0 }])

    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    const result = await processStorageDeletionJobs()

    expect(result.claimedCount).toBe(0)
    expect(mockDeleteFile).not.toHaveBeenCalled()
  })

  it('失敗時（リトライ上限未満）は attemptCount をインクリメントし backoff 付きで pending に戻す', async () => {
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    mockFindMany.mockResolvedValueOnce([{ id: 'job-3', url: '/uploads/c.webp', attemptCount: 2 }])
    mockDeleteFile.mockResolvedValueOnce({ success: false, error: 'transient error' })

    const before = Date.now()
    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    const result = await processStorageDeletionJobs()

    expect(result.retriedCount).toBe(1)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'job-3' },
      data: {
        status: 'pending',
        attemptCount: 3,
        nextAttemptAt: expect.any(Date),
        lastError: 'transient error',
        lockedAt: null,
      },
    })

    // backoff = min(5 * 2^(3-1), 240) = 20分
    const call = mockUpdate.mock.calls[0]?.[0] as { data: { nextAttemptAt: Date } }
    const expectedNextAttempt = before + 20 * ONE_MINUTE_MS
    expect(Math.abs(call.data.nextAttemptAt.getTime() - expectedNextAttempt)).toBeLessThan(5000)
  })

  it('リトライ上限到達で dead_letter に遷移し logger.error を呼ぶ', async () => {
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    mockFindMany.mockResolvedValueOnce([
      { id: 'job-4', url: '/uploads/d.webp', attemptCount: STORAGE_DELETION_MAX_ATTEMPTS - 1 },
    ])
    mockDeleteFile.mockResolvedValueOnce({ success: false, error: 'fatal error' })

    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    const result = await processStorageDeletionJobs()

    expect(result.deadLetteredCount).toBe(1)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'job-4' },
      data: {
        status: 'dead_letter',
        attemptCount: STORAGE_DELETION_MAX_ATTEMPTS,
        lastError: 'fatal error',
        lockedAt: null,
      },
    })
    expect(mockLoggerError).toHaveBeenCalledWith(
      'StorageDeletionJob exhausted retries and moved to dead_letter',
      expect.objectContaining({
        jobId: 'job-4',
        url: '/uploads/d.webp',
        attemptCount: STORAGE_DELETION_MAX_ATTEMPTS,
        lastError: 'fatal error',
      }),
    )
  })

  it('deleteFile が例外を投げた場合も失敗として扱い pending にリトライする', async () => {
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    mockFindMany.mockResolvedValueOnce([{ id: 'job-5', url: '/uploads/e.webp', attemptCount: 0 }])
    mockDeleteFile.mockRejectedValueOnce(new Error('unexpected throw'))

    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    const result = await processStorageDeletionJobs()

    expect(result.retriedCount).toBe(1)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-5' },
        data: expect.objectContaining({ lastError: 'unexpected throw', attemptCount: 1 }),
      }),
    )
  })

  it('deleteFile が Error 以外の値を throw した場合は String(err) を lastError にする', async () => {
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    mockFindMany.mockResolvedValueOnce([{ id: 'job-6', url: '/uploads/f.webp', attemptCount: 0 }])
    mockDeleteFile.mockRejectedValueOnce('plain string rejection')

    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    const result = await processStorageDeletionJobs()

    expect(result.retriedCount).toBe(1)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastError: 'plain string rejection' }),
      }),
    )
  })

  it('失敗理由（error）が undefined の場合は lastError を null にする（retry）', async () => {
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    mockFindMany.mockResolvedValueOnce([{ id: 'job-7', url: '/uploads/g.webp', attemptCount: 0 }])
    mockDeleteFile.mockResolvedValueOnce({ success: false })

    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    await processStorageDeletionJobs()

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-7' },
        data: expect.objectContaining({ lastError: null }),
      }),
    )
  })

  it('失敗理由（error）が undefined の場合は lastError を null にする（dead_letter）', async () => {
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    mockFindMany.mockResolvedValueOnce([
      { id: 'job-8', url: '/uploads/h.webp', attemptCount: STORAGE_DELETION_MAX_ATTEMPTS - 1 },
    ])
    mockDeleteFile.mockResolvedValueOnce({ success: false })

    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    await processStorageDeletionJobs()

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-8' },
        data: expect.objectContaining({ status: 'dead_letter', lastError: null }),
      }),
    )
  })

  it('複数ジョブを並行処理し、成功・リトライを個別にカウントする', async () => {
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // reclaim
      .mockResolvedValueOnce({ count: 1 }) // claim job-a
      .mockResolvedValueOnce({ count: 1 }) // claim job-b
    mockFindMany.mockResolvedValueOnce([
      { id: 'job-a', url: '/uploads/a.webp', attemptCount: 0 },
      { id: 'job-b', url: '/uploads/b.webp', attemptCount: 0 },
    ])
    mockDeleteFile
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'boom' })

    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    const result = await processStorageDeletionJobs()

    expect(result.claimedCount).toBe(2)
    expect(result.completedCount).toBe(1)
    expect(result.retriedCount).toBe(1)
  })

  it('保持期間を過ぎた completed ジョブを削除し purgedCompletedCount に反映する', async () => {
    mockDeleteMany.mockResolvedValueOnce({ count: 7 })

    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    const result = await processStorageDeletionJobs()

    expect(result.purgedCompletedCount).toBe(7)
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { status: 'completed', completedAt: { lt: expect.any(Date) } },
    })
  })
})
