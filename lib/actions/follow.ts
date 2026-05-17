/**
 * フォロー機能のServer Actions
 *
 * フォロー/フォロー解除、フォロー状態確認、フォロワー/フォロー中一覧を提供する。
 * フォロー時は相手に通知を送信し、分析データとして記録する。
 *
 * @module lib/actions/follow
 */

'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { requireActiveNonGuestUser, requireAuth, actionError, actionSuccess, invalidateUserRelationsCache, enforceUserRateLimit } from '@/lib/actions/utils'
import { recordNewFollower } from './analytics'
import { createNotification } from '@/lib/services/notification-core'
import { checkUserRateLimit } from '@/lib/rate-limit'
import logger from '@/lib/logger'
import {
  ERR_SELF_ACTION,
  ERR_USER_NOT_FOUND,
  ERR_PRIVATE_ACCOUNT_FOLLOW,
  ERR_FOLLOW_FAILED,
  ERR_INVALID_INPUT,
  ERR_USER_ID_REQUIRED,
} from '@/lib/constants/errors'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { buildUserPath } from '@/lib/constants/path-builders'

const userIdSchema = z.string().min(1, ERR_USER_ID_REQUIRED)

/**
 * フォローをトグル（フォロー/フォロー解除）
 * @param userId - フォロー対象のユーザーID
 * @returns 成功時は { success: true, following: boolean }、失敗時は { error: string }
 */
export async function toggleFollow(userId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const currentUserId = authResult.userId

  const parsed = userIdSchema.safeParse(userId)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  const targetUserId = parsed.data

  if (currentUserId === targetUserId) {
    return actionError(ERR_SELF_ACTION)
  }

  const rl = await enforceUserRateLimit(currentUserId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    /**
     * トランザクションの戻り値型。`as string` キャストを避けるため明示する。
     */
    type ToggleFollowResult =
      | { kind: 'error'; error: string }
      | { kind: 'ok'; following: boolean }

    const result = await prisma.$transaction(async (tx): Promise<ToggleFollowResult> => {
      const existingFollow = await tx.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: targetUserId,
          },
        },
      })

      if (existingFollow) {
        await tx.follow.delete({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: targetUserId,
            },
          },
        })
        return { kind: 'ok', following: false }
      }

      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { isPublic: true },
      })

      if (!targetUser) {
        return { kind: 'error', error: ERR_USER_NOT_FOUND }
      }

      if (!targetUser.isPublic) {
        return { kind: 'error', error: ERR_PRIVATE_ACCOUNT_FOLLOW }
      }

      await tx.follow.create({
        data: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      })
      return { kind: 'ok', following: true }
    })

    if (result.kind === 'error') {
      return actionError(result.error)
    }

    // 通知・分析はトランザクション外（クリティカルでない）
    if (result.following) {
      // createNotification has atomic dedup (findFirst + create in transaction)
      // and also handles block checks and notification preferences
      await createNotification({
        userId: targetUserId,
        actorId: currentUserId,
        type: 'follow',
      })

      void recordNewFollower(targetUserId).catch((err) => logger.error('recordNewFollower failed:', err))
    }

    await invalidateUserRelationsCache(currentUserId)
    revalidatePath(buildUserPath(targetUserId))
    revalidatePath(buildUserPath(currentUserId))
    return actionSuccess({ following: result.following })
  } catch (error) {
    logger.error('Toggle follow error:', error)
    return actionError(ERR_FOLLOW_FAILED)
  }
}

/**
 * フォロー状態を確認
 * @param userId - 確認対象のユーザーID
 * @returns { following: boolean }
 */
export async function getFollowStatus(targetUserId: string) {
  const authResult = await requireAuth()
  if ('error' in authResult) return { following: false }
  const userId = authResult.userId

  const rateLimitResult = await checkUserRateLimit(userId, 'read')
  if (!rateLimitResult.success) {
    return { following: false }
  }

  const existingFollow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: userId,
        followingId: targetUserId,
      },
    },
  })

  return { following: !!existingFollow }
}

/**
 * フォロワー一覧を取得（カーソルベースページネーション）
 * @param userId - 対象のユーザーID
 * @param cursor - ページネーション用カーソル（followerId）
 * @param limit - 取得件数
 * @returns フォロワー一覧と次のカーソル
 */
export async function getFollowers(userId: string, cursor?: string, limit = DEFAULT_PAGE_LIMIT) {
  const session = await auth()
  if (session?.user?.id) {
    const rateLimitResult = await checkUserRateLimit(session.user.id, 'read')
    if (!rateLimitResult.success) {
      return { users: [], nextCursor: undefined }
    }
  }

  const followers = await prisma.follow.findMany({
    where: {
      followingId: userId,
      follower: { email: { not: GUEST_EMAIL } },  // ゲストは一覧に表示しない
    },
    include: {
      follower: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: {
        followerId_followingId: {
          followerId: cursor,
          followingId: userId,
        },
      },
      skip: 1,
    }),
  })

  const hasMore = followers.length === limit

  return {
    users: followers.map((f: typeof followers[number]) => f.follower),
    nextCursor: hasMore ? followers[followers.length - 1]?.followerId : undefined,
  }
}

/**
 * フォロー中一覧を取得（カーソルベースページネーション）
 * @param userId - 対象のユーザーID
 * @param cursor - ページネーション用カーソル（followingId）
 * @param limit - 取得件数
 * @returns フォロー中一覧と次のカーソル
 */
export async function getFollowing(userId: string, cursor?: string, limit = DEFAULT_PAGE_LIMIT) {
  const session = await auth()
  if (session?.user?.id) {
    const rateLimitResult = await checkUserRateLimit(session.user.id, 'read')
    if (!rateLimitResult.success) {
      return { users: [], nextCursor: undefined }
    }
  }

  const following = await prisma.follow.findMany({
    where: {
      followerId: userId,
      following: { email: { not: GUEST_EMAIL } },  // ゲストは一覧に表示しない
    },
    include: {
      following: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: {
        followerId_followingId: {
          followerId: userId,
          followingId: cursor,
        },
      },
      skip: 1,
    }),
  })

  const hasMore = following.length === limit

  return {
    users: following.map((f: typeof following[number]) => f.following),
    nextCursor: hasMore ? following[following.length - 1]?.followingId : undefined,
  }
}
