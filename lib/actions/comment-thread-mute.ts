'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit, type ActionResult } from '@/lib/actions/utils'
import logger from '@/lib/logger'
import { ERR_INVALID_INPUT, ERR_THREAD_MUTE_FAILED, ERR_THREAD_UNMUTE_FAILED } from '@/lib/constants/errors'
import { MAX_NOTIFICATION_ID_LENGTH } from '@/lib/constants/limits'

const rootCommentIdSchema = z.string().min(1).max(MAX_NOTIFICATION_ID_LENGTH)

/**
 * コメントスレッドをミュート
 *
 * @param rootCommentId - ルートコメントのID
 */
export async function muteThread(rootCommentId: string): Promise<ActionResult> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = rootCommentIdSchema.safeParse(rootCommentId)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    await prisma.commentThreadMute.upsert({
      where: {
        userId_commentId: {
          userId,
          commentId: parsed.data,
        },
      },
      create: {
        userId,
        commentId: parsed.data,
      },
      update: {},
    })

    return actionSuccess()
  } catch (error) {
    logger.error('Mute thread error:', error)
    return actionError(ERR_THREAD_MUTE_FAILED)
  }
}

/**
 * コメントスレッドのミュートを解除
 *
 * @param rootCommentId - ルートコメントのID
 */
export async function unmuteThread(rootCommentId: string): Promise<ActionResult> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = rootCommentIdSchema.safeParse(rootCommentId)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    await prisma.commentThreadMute.deleteMany({
      where: {
        userId,
        commentId: parsed.data,
      },
    })

    return actionSuccess()
  } catch (error) {
    logger.error('Unmute thread error:', error)
    return actionError(ERR_THREAD_UNMUTE_FAILED)
  }
}
