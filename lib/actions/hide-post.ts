'use server'

import 'server-only'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import {
  ERR_POST_NOT_FOUND,
  ERR_CANNOT_HIDE_OWN_POST,
  ERR_HIDE_POST_FAILED,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'
import { ROUTE_FEED } from '@/lib/constants/routes'
import logger from '@/lib/logger'

const postIdSchema = z.string().min(1)

export async function hidePost(postId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const parsed = postIdSchema.safeParse(postId)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    const post = await prisma.post.findUnique({ where: { id: parsed.data } })
    if (!post) {
      return actionError(ERR_POST_NOT_FOUND)
    }

    if (post.userId === userId) {
      return actionError(ERR_CANNOT_HIDE_OWN_POST)
    }

    await prisma.userHiddenPost.upsert({
      where: {
        userId_postId: {
          userId,
          postId: parsed.data,
        },
      },
      create: {
        userId,
        postId: parsed.data,
      },
      update: {},
    })

    revalidatePath(ROUTE_FEED)
    return actionSuccess()
  } catch (error) {
    logger.error('Hide post error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_HIDE_POST_FAILED)
  }
}

/**
 * 現在のセッションユーザーの非表示投稿 ID 一覧を返す。
 *
 * Why session-bound: 旧実装は引数 `userId` をそのまま受け取って RPC 公開していたため、
 * 任意の userId で他人の非表示投稿一覧を列挙できる情報漏洩リスクがあった。引数を撤廃し、
 * `auth()` から取得した session userId のみで自身の一覧を返す設計に変更。
 */
export async function getHiddenPostIds(): Promise<string[]> {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return []

    const hidden = await prisma.userHiddenPost.findMany({
      where: { userId },
      select: { postId: true },
    })
    return hidden.map((h: { postId: string }) => h.postId)
  } catch (error) {
    logger.error('Get hidden post ids error', { error: error instanceof Error ? error.message : String(error) })
    return []
  }
}
