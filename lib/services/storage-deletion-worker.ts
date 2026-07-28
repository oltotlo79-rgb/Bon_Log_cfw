/**
 * @module lib/services/storage-deletion-worker
 *
 * ストレージ削除 outbox（`StorageDeletionJob`）を処理する cron worker のコアロジック。
 *
 * Why services 層: cron Route Handler 専用ロジックであり、`'use server'` を付けると
 * クライアントから呼び出し可能な RPC として公開されてしまうため services 層に置く
 * （`scheduled-post-publisher.ts` と同方針）。
 *
 * 処理フロー（1 cron 実行あたり）:
 *   1. stale な `processing` ジョブ（プロセスクラッシュ等で lockedAt が古いまま）を `pending` に戻す
 *   2. `pending` かつ `nextAttemptAt` 到達済みのジョブを `STORAGE_DELETION_BATCH_SIZE` 件まで取得
 *   3. 各ジョブを条件付き UPDATE (`status: 'pending'` → `'processing'`) で claim（同時実行の cron との二重処理を防止）
 *   4. `deleteFile` を実行し、成功（404 idempotent 含む）なら `completed`、失敗ならリトライ回数を記録し
 *      上限未満なら backoff 付きで `pending` に戻す。上限到達で `dead_letter`（要 Sentry 通知 + 手動再実行）
 *   5. 保持期間を過ぎた `completed` ジョブを削除
 *
 * dead_letter からの手動再実行は、運用者が `status` を `pending` に戻す（`attemptCount` は
 * そのまま保持し監査に使う。次回 cron 実行時に通常のリトライ経路で処理される）。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { deleteFile } from '@/lib/storage'
import type { DeleteResult } from '@/lib/storage'
import logger from '@/lib/logger'
import { STORAGE_DELETION_JOB_STATUS } from '@/lib/constants/status'
import {
  STORAGE_DELETION_BATCH_SIZE,
  STORAGE_DELETION_MAX_ATTEMPTS,
  STORAGE_DELETION_BACKOFF_BASE_MINUTES,
  STORAGE_DELETION_BACKOFF_MAX_MINUTES,
  STORAGE_DELETION_STALE_LOCK_MINUTES,
  STORAGE_DELETION_COMPLETED_RETENTION_DAYS,
  ONE_MINUTE_MS,
  ONE_DAY_MS,
} from '@/lib/constants/limits'

export interface StorageDeletionProcessResult {
  claimedCount: number
  completedCount: number
  retriedCount: number
  deadLetteredCount: number
  reclaimedStaleCount: number
  purgedCompletedCount: number
}

/** 失敗回数から次回リトライ時刻を計算する（指数バックオフ、上限あり）。 */
function computeNextAttemptAt(attemptCount: number): Date {
  const backoffMinutes = Math.min(
    STORAGE_DELETION_BACKOFF_BASE_MINUTES * 2 ** (attemptCount - 1),
    STORAGE_DELETION_BACKOFF_MAX_MINUTES
  )
  return new Date(Date.now() + backoffMinutes * ONE_MINUTE_MS)
}

async function reclaimStaleProcessingJobs(now: Date): Promise<number> {
  const staleCutoff = new Date(now.getTime() - STORAGE_DELETION_STALE_LOCK_MINUTES * ONE_MINUTE_MS)
  const result = await prisma.storageDeletionJob.updateMany({
    where: {
      status: STORAGE_DELETION_JOB_STATUS.PROCESSING,
      lockedAt: { lt: staleCutoff },
    },
    data: { status: STORAGE_DELETION_JOB_STATUS.PENDING, lockedAt: null },
  })
  return result.count
}

async function purgeExpiredCompletedJobs(now: Date): Promise<number> {
  const completedCutoff = new Date(now.getTime() - STORAGE_DELETION_COMPLETED_RETENTION_DAYS * ONE_DAY_MS)
  const result = await prisma.storageDeletionJob.deleteMany({
    where: {
      status: STORAGE_DELETION_JOB_STATUS.COMPLETED,
      completedAt: { lt: completedCutoff },
    },
  })
  return result.count
}

interface JobCandidate {
  id: string
  url: string
  attemptCount: number
}

/**
 * 1 件のジョブを claim → 削除実行 → 結果に応じたステータス更新まで行う。
 * claim できなかった場合（他 cron 実行との競合）は null を返す。
 */
async function processSingleJob(
  job: JobCandidate
): Promise<'completed' | 'retried' | 'dead_letter' | null> {
  const claim = await prisma.storageDeletionJob.updateMany({
    where: { id: job.id, status: STORAGE_DELETION_JOB_STATUS.PENDING },
    data: { status: STORAGE_DELETION_JOB_STATUS.PROCESSING, lockedAt: new Date() },
  })
  if (claim.count === 0) return null

  let result: DeleteResult
  try {
    result = await deleteFile(job.url)
  } catch (err) {
    result = { success: false, error: err instanceof Error ? err.message : String(err) }
  }

  if (result.success) {
    await prisma.storageDeletionJob.update({
      where: { id: job.id },
      data: {
        status: STORAGE_DELETION_JOB_STATUS.COMPLETED,
        completedAt: new Date(),
        lastError: null,
        lockedAt: null,
      },
    })
    return 'completed'
  }

  const attemptCount = job.attemptCount + 1
  if (attemptCount >= STORAGE_DELETION_MAX_ATTEMPTS) {
    await prisma.storageDeletionJob.update({
      where: { id: job.id },
      data: {
        status: STORAGE_DELETION_JOB_STATUS.DEAD_LETTER,
        attemptCount,
        lastError: result.error ?? null,
        lockedAt: null,
      },
    })
    // retry 上限到達は運用者の手動対応が必要なため、silent drop せず可観測にする
    // (logger.error は本番で Sentry.captureMessage / captureException を送信する)。
    logger.error('StorageDeletionJob exhausted retries and moved to dead_letter', {
      jobId: job.id,
      url: job.url,
      attemptCount,
      lastError: result.error,
    })
    return 'dead_letter'
  }

  await prisma.storageDeletionJob.update({
    where: { id: job.id },
    data: {
      status: STORAGE_DELETION_JOB_STATUS.PENDING,
      attemptCount,
      nextAttemptAt: computeNextAttemptAt(attemptCount),
      lastError: result.error ?? null,
      lockedAt: null,
    },
  })
  return 'retried'
}

/** `StorageDeletionJob` の pending バッチを処理する。cron route から呼ばれる。 */
export async function processStorageDeletionJobs(): Promise<StorageDeletionProcessResult> {
  const now = new Date()

  const reclaimedStaleCount = await reclaimStaleProcessingJobs(now)

  const candidates = await prisma.storageDeletionJob.findMany({
    where: {
      status: STORAGE_DELETION_JOB_STATUS.PENDING,
      nextAttemptAt: { lte: now },
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: STORAGE_DELETION_BATCH_SIZE,
    select: { id: true, url: true, attemptCount: true },
  })

  let claimedCount = 0
  let completedCount = 0
  let retriedCount = 0
  let deadLetteredCount = 0

  const outcomes = await Promise.all(candidates.map((job) => processSingleJob(job)))
  for (const outcome of outcomes) {
    if (outcome === null) continue
    claimedCount++
    if (outcome === 'completed') completedCount++
    else if (outcome === 'retried') retriedCount++
    else if (outcome === 'dead_letter') deadLetteredCount++
  }

  const purgedCompletedCount = await purgeExpiredCompletedJobs(now)

  return {
    claimedCount,
    completedCount,
    retriedCount,
    deadLetteredCount,
    reclaimedStaleCount,
    purgedCompletedCount,
  }
}
