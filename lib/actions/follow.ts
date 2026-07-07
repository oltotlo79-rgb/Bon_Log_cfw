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
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { requireActiveNonGuestUser, requireAuth, actionError, actionSuccess, invalidateUserRelationsCache, enforceUserRateLimit, getClientIp } from '@/lib/actions/utils'
import { recordNewFollowerService } from '@/lib/services/analytics-recording'
import { createNotification } from '@/lib/services/notification-core'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import logger from '@/lib/logger'
import {
  ERR_SELF_ACTION,
  ERR_USER_NOT_FOUND,
  ERR_PRIVATE_ACCOUNT_FOLLOW,
  ERR_FOLLOW_FAILED,
  ERR_INVALID_INPUT,
  ERR_USER_ID_REQUIRED,
} from '@/lib/constants/errors'
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@/lib/constants/limits'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { buildUserPath } from '@/lib/constants/path-builders'
import { canViewAuthorContent, visibleUserWhere } from '@/lib/services/post-visibility'
import { checkInteractionEligibility } from '@/lib/services/user-eligibility'

const userIdSchema = z.string().min(1, ERR_USER_ID_REQUIRED)

const followListInputSchema = z.object({
  userId: z.string().min(1, ERR_USER_ID_REQUIRED),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(MAX_PAGE_LIMIT).optional(),
})

const EMPTY_LIST_RESULT = { users: [] as never[], nextCursor: undefined } as const

async function enforceFollowListRateLimit(userId: string | undefined): Promise<boolean> {
  if (userId) {
    const rl = await enforceUserRateLimit(userId, 'read')
    return rl === null
  }
  const ip = await getClientIp()
  const rl = await rateLimit(`follow_list:${ip}`, RATE_LIMITS.read)
  return rl.success
}

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

      // target の存在・停止・ゲスト・双方向 block を一括検証する。
      // direct follow は block の有無を相手に推測させないため、block も not_found と同じ
      // ERR_USER_NOT_FOUND に丸めて秘匿する（follow request / DM では block 専用エラーを返す方針）。
      const eligibility = await checkInteractionEligibility(currentUserId, targetUserId, tx)
      if (!eligibility.ok) {
        return { kind: 'error', error: ERR_USER_NOT_FOUND }
      }

      if (!eligibility.target.isPublic) {
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

      void recordNewFollowerService(targetUserId).catch((err) => logger.error('recordNewFollower failed:', err))
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

  const parsed = userIdSchema.safeParse(targetUserId)
  if (!parsed.success) return { following: false }

  const rl = await enforceUserRateLimit(userId, 'read')
  if (rl) {
    return { following: false }
  }

  const existingFollow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: userId,
        followingId: parsed.data,
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
  const parsed = followListInputSchema.safeParse({ userId, cursor, limit })
  if (!parsed.success) return EMPTY_LIST_RESULT
  const { userId: safeUserId, cursor: safeCursor, limit: safeLimit = DEFAULT_PAGE_LIMIT } = parsed.data

  const session = await auth()
  const viewerId = session?.user?.id
  const allowed = await enforceFollowListRateLimit(viewerId)
  if (!allowed) return EMPTY_LIST_RESULT

  // 本人以外は対象プロフィールが閲覧可能な場合のみフォロワーを返す（/users/[id]/* と同条件）。
  if (viewerId !== safeUserId) {
    const target = await prisma.user.findUnique({
      where: { id: safeUserId },
      select: { isPublic: true, isSuspended: true },
    })
    if (!target || !(await canViewAuthorContent(viewerId, safeUserId, target))) {
      return EMPTY_LIST_RESULT
    }
  }

  const followers = await prisma.follow.findMany({
    where: {
      followingId: safeUserId,
      follower: { ...visibleUserWhere(viewerId), email: { not: GUEST_EMAIL } },
    },
    include: {
      follower: {
        select: USER_MINIMAL_WITH_BIO_SELECT,
      },
    },
    orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
    take: safeLimit,
    ...(safeCursor && {
      cursor: {
        followerId_followingId: {
          followerId: safeCursor,
          followingId: safeUserId,
        },
      },
      skip: 1,
    }),
  })

  const hasMore = followers.length === safeLimit

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
  const parsed = followListInputSchema.safeParse({ userId, cursor, limit })
  if (!parsed.success) return EMPTY_LIST_RESULT
  const { userId: safeUserId, cursor: safeCursor, limit: safeLimit = DEFAULT_PAGE_LIMIT } = parsed.data

  const session = await auth()
  const viewerId = session?.user?.id
  const allowed = await enforceFollowListRateLimit(viewerId)
  if (!allowed) return EMPTY_LIST_RESULT

  // 本人以外は対象プロフィールが閲覧可能な場合のみフォロー中一覧を返す（/users/[id]/* と同条件）。
  if (viewerId !== safeUserId) {
    const target = await prisma.user.findUnique({
      where: { id: safeUserId },
      select: { isPublic: true, isSuspended: true },
    })
    if (!target || !(await canViewAuthorContent(viewerId, safeUserId, target))) {
      return EMPTY_LIST_RESULT
    }
  }

  const following = await prisma.follow.findMany({
    where: {
      followerId: safeUserId,
      following: { ...visibleUserWhere(viewerId), email: { not: GUEST_EMAIL } },
    },
    include: {
      following: {
        select: USER_MINIMAL_WITH_BIO_SELECT,
      },
    },
    orderBy: [{ createdAt: 'desc' }, { followingId: 'desc' }],
    take: safeLimit,
    ...(safeCursor && {
      cursor: {
        followerId_followingId: {
          followerId: safeUserId,
          followingId: safeCursor,
        },
      },
      skip: 1,
    }),
  })

  const hasMore = following.length === safeLimit

  return {
    users: following.map((f: typeof following[number]) => f.following),
    nextCursor: hasMore ? following[following.length - 1]?.followingId : undefined,
  }
}
