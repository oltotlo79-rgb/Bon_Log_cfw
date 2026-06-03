/**
 * プロフィール固定投稿の Server Actions。
 * ユーザーは自分の投稿を 1 件だけプロフィール先頭に固定できる（User.pinnedPostId）。
 *
 * @module lib/actions/pin-post
 */

'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import {
  requireActiveNonGuestUser,
  actionSuccess,
  actionError,
  enforceUserRateLimit,
} from '@/lib/actions/utils'
import {
  ERR_INVALID_INPUT,
  ERR_POST_NOT_FOUND,
  ERR_PERMISSION_DENIED,
  ERR_OPERATION_FAILED,
} from '@/lib/constants/errors'
import { buildUserPath } from '@/lib/constants/path-builders'
import logger from '@/lib/logger'

const postIdSchema = z.string().min(1)

/**
 * 自分の投稿をプロフィールに固定する（既存の固定があれば置き換え）。
 */
export async function pinPost(postId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  if (!postIdSchema.safeParse(postId).success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true, isHidden: true },
    })
    if (!post || post.isHidden) return actionError(ERR_POST_NOT_FOUND)
    // 自分の投稿のみ固定できる
    if (post.userId !== userId) return actionError(ERR_PERMISSION_DENIED)

    await prisma.user.update({
      where: { id: userId },
      data: { pinnedPostId: postId },
    })

    revalidatePath(buildUserPath(userId))
    return actionSuccess()
  } catch (error) {
    logger.error('Pin post failed', {
      userId,
      postId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * プロフィールの固定を解除する。
 */
export async function unpinPost() {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { pinnedPostId: null },
    })

    revalidatePath(buildUserPath(userId))
    return actionSuccess()
  } catch (error) {
    logger.error('Unpin post failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_OPERATION_FAILED)
  }
}
