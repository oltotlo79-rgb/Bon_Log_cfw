/**
 * @module lib/services/follow-service
 * フォロー操作のプリミティブ。
 *
 * lib/actions/follow.ts / follow-request.ts と app/api/v1/users/[id]/follow の
 * 双方から呼ばれる。認証・レート制限は呼び出し元が担う前提。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/services/notification-core'
import { recordNewFollowerService } from '@/lib/services/analytics-recording'
import { checkInteractionEligibility } from '@/lib/services/user-eligibility'
import { FOLLOW_REQUEST_STATUS } from '@/lib/constants/status'
import logger from '@/lib/logger'

export type FollowState = {
  following: boolean
  requested: boolean
  followerCount: number
}

export type FollowResult =
  | { ok: false; reason: 'not_found' | 'self' | 'blocked' }
  | { ok: true; state: FollowState }

/**
 * 公開アカウントをフォローする（冪等）。
 * 既にフォロー済みの場合は no-op として following:true を返す。
 */
export async function followUser(
  actorId: string,
  targetId: string,
): Promise<FollowResult> {
  if (actorId === targetId) return { ok: false, reason: 'self' }

  const eligibility = await checkInteractionEligibility(actorId, targetId)
  if (!eligibility.ok) {
    return { ok: false, reason: eligibility.reason }
  }

  const isNew = await prisma.$transaction(async (tx) => {
    const existingFollow = await tx.follow.findUnique({
      where: { followerId_followingId: { followerId: actorId, followingId: targetId } },
    })
    if (!existingFollow) {
      await tx.follow.create({ data: { followerId: actorId, followingId: targetId } })
      return true
    }
    return false
  })

  // 通知・analytics は新規フォロー時のみ発火（冪等再送で二重計上しない）
  if (isNew) {
    void createNotification({
      userId: targetId,
      actorId,
      type: 'follow',
    }).catch((err) => {
      logger.error('createNotification (follow) failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
    void recordNewFollowerService(targetId).catch((err) => {
      logger.error('recordNewFollower failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  const followerCount = await prisma.follow.count({ where: { followingId: targetId } })

  return { ok: true, state: { following: true, requested: false, followerCount } }
}

/**
 * フォローリクエストを送信する（冪等）。
 * 既にリクエスト済みの場合は no-op として requested:true を返す。
 */
export async function sendFollowRequestPrimitive(
  actorId: string,
  targetId: string,
): Promise<FollowResult> {
  if (actorId === targetId) return { ok: false, reason: 'self' }

  const eligibility = await checkInteractionEligibility(actorId, targetId)
  if (!eligibility.ok) {
    return { ok: false, reason: eligibility.reason }
  }

  const existingRequest = await prisma.followRequest.findUnique({
    where: {
      requesterId_targetId: { requesterId: actorId, targetId },
    },
  })

  if (!existingRequest) {
    await prisma.followRequest.create({
      data: {
        requesterId: actorId,
        targetId,
        status: FOLLOW_REQUEST_STATUS.PENDING,
      },
    })

    void createNotification({
      userId: targetId,
      actorId,
      type: 'follow_request',
    }).catch((err) => {
      logger.error('createNotification (follow_request) failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  const followerCount = await prisma.follow.count({ where: { followingId: targetId } })

  return { ok: true, state: { following: false, requested: true, followerCount } }
}

/**
 * フォローを解除する（冪等）。
 * フォローしていない場合は no-op。
 */
export async function unfollowUser(
  actorId: string,
  targetId: string,
): Promise<{ followerCount: number }> {
  await prisma.follow.deleteMany({
    where: { followerId: actorId, followingId: targetId },
  })

  const followerCount = await prisma.follow.count({ where: { followingId: targetId } })
  return { followerCount }
}

/**
 * フォローリクエストをキャンセルする（冪等）。
 * リクエストが存在しない場合は no-op。
 */
export async function cancelFollowRequestPrimitive(
  actorId: string,
  targetId: string,
): Promise<{ followerCount: number }> {
  await prisma.followRequest.deleteMany({
    where: { requesterId: actorId, targetId },
  })

  const followerCount = await prisma.follow.count({ where: { followingId: targetId } })
  return { followerCount }
}
