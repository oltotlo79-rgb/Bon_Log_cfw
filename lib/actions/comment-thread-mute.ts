'use server'

import { prisma } from '@/lib/db'
import { requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit, type ActionResult } from '@/lib/actions/utils'
import logger from '@/lib/logger'
import { ERR_THREAD_MUTE_FAILED, ERR_THREAD_UNMUTE_FAILED } from '@/lib/constants/errors'

/**
 * コメントスレッドをミュート
 *
 * @param rootCommentId - ルートコメントのID
 */
export async function muteThread(rootCommentId: string): Promise<ActionResult> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    await prisma.commentThreadMute.upsert({
      where: {
        userId_commentId: {
          userId,
          commentId: rootCommentId,
        },
      },
      create: {
        userId,
        commentId: rootCommentId,
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

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    await prisma.commentThreadMute.deleteMany({
      where: {
        userId,
        commentId: rootCommentId,
      },
    })

    return actionSuccess()
  } catch (error) {
    logger.error('Unmute thread error:', error)
    return actionError(ERR_THREAD_UNMUTE_FAILED)
  }
}

/**
 * スレッドがミュートされているかチェック
 *
 * @param userId - ユーザーID
 * @param rootCommentId - ルートコメントのID
 */
export async function isThreadMuted(userId: string, rootCommentId: string) {
  try {
    const mute = await prisma.commentThreadMute.findUnique({
      where: {
        userId_commentId: {
          userId,
          commentId: rootCommentId,
        },
      },
    })

    return !!mute
  } catch (error) {
    logger.error('Check thread mute error:', error)
    return false
  }
}
