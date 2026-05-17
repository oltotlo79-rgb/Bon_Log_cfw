/**
 * @module lib/actions/analytics-recording
 * UserAnalytics への累積カウンタ更新を行う Server Action 薄ラッパ群。
 *
 * 実体は `lib/services/analytics-recording.ts` にあり、auth / Zod 検証 を済ませた上で
 * service を呼ぶだけ。DB エラーは catch して ActionResult.error に詰め直す。
 *
 * Why Action 層に残すか:
 *   - 既存の like / follow Action から fire-and-forget で呼ばれているため後方互換性として
 *   - render 経路からは呼ばない (`components/analytics/ViewBeacon` 経由で
 *     `/api/analytics/view` に集約済み)
 */

'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import logger from '@/lib/logger'
import { actionSuccess, actionError, type ActionResult } from '@/types/action-result'
import { ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { MAX_NOTIFICATION_ID_LENGTH } from '@/lib/constants/limits'
import {
  recordLikeReceivedService,
  recordNewFollowerService,
  recordPostViewService,
  recordProfileViewService,
} from '@/lib/services/analytics-recording'

const userIdSchema = z.string().min(1).max(MAX_NOTIFICATION_ID_LENGTH)

/**
 * 認証済みかつ userId が有効であることを確認する内部ガード。
 * 未認証は scrape / bot 経路で発生しうるため success の no-op で返し、上位の
 * fire-and-forget 呼び出しを汚染しない。
 */
async function guardRecorder(rawUserId: string): Promise<ActionResult<void> | null> {
  const session = await auth()
  if (!session?.user?.id) return actionSuccess()
  const parsed = userIdSchema.safeParse(rawUserId)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  return null
}

async function runWithLog(
  fn: () => Promise<void>,
  errorTag: string,
): Promise<ActionResult<void>> {
  try {
    await fn()
    return actionSuccess()
  } catch (error) {
    logger.error(errorTag, error)
    return actionError(errorTag)
  }
}

export async function recordProfileView(userId: string): Promise<ActionResult<void>> {
  const guard = await guardRecorder(userId)
  if (guard) return guard
  return runWithLog(() => recordProfileViewService(userId), 'Record profile view error:')
}

export async function recordPostView(userId: string): Promise<ActionResult<void>> {
  const guard = await guardRecorder(userId)
  if (guard) return guard
  return runWithLog(() => recordPostViewService(userId), 'Record post view error:')
}

export async function recordLikeReceived(userId: string): Promise<ActionResult<void>> {
  const guard = await guardRecorder(userId)
  if (guard) return guard
  return runWithLog(() => recordLikeReceivedService(userId), 'Record like received error:')
}

export async function recordNewFollower(userId: string): Promise<ActionResult<void>> {
  const guard = await guardRecorder(userId)
  if (guard) return guard
  return runWithLog(() => recordNewFollowerService(userId), 'Record new follower error:')
}
