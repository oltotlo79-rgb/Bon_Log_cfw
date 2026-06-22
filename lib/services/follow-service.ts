/**
 * @module lib/services/follow-service
 * フォロー操作のプリミティブ。
 *
 * lib/actions/follow.ts / follow-request.ts と app/api/v1/users/[id]/follow /
 * app/api/v1/users/me/follow-requests の双方から呼ばれる。
 * 認証・レート制限は呼び出し元が担う前提。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/services/notification-core'
import { recordNewFollowerService } from '@/lib/services/analytics-recording'
import { checkInteractionEligibility } from '@/lib/services/user-eligibility'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { FOLLOW_REQUEST_STATUS } from '@/lib/constants/status'
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@/lib/constants/limits'
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

// ──────────────────────────────────────────────────
// フォローリクエスト管理 core（モバイル API v1 / Web 共有）
// ──────────────────────────────────────────────────

export type FollowRequestCoreResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'forbidden' | 'already_processed' }

export type ApproveFollowRequestCoreResult =
  | { ok: true; requesterId: string }
  | { ok: false; reason: 'not_found' | 'forbidden' | 'already_processed' }

/** フォローリクエスト一覧の 1 件 */
export type FollowRequestItem = {
  id: string
  createdAt: Date
  requester: {
    id: string
    nickname: string
    avatarUrl: string | null
    bio: string | null
  }
}

/** フォローリクエスト一覧の結果 */
export type ListReceivedFollowRequestsResult = {
  requests: FollowRequestItem[]
  nextCursor?: string
}

/**
 * フォローリクエストを承認する。
 *
 * actorId === request.targetId（所有権）を確認し、
 * Follow upsert + FollowRequest 削除 + 承認通知をトランザクションで実行する。
 */
export async function approveFollowRequestCore(
  actorId: string,
  requestId: string,
): Promise<ApproveFollowRequestCoreResult> {
  const request = await prisma.followRequest.findUnique({
    where: { id: requestId },
    include: {
      requester: { select: { id: true } },
    },
  })

  if (!request) {
    return { ok: false, reason: 'not_found' }
  }

  if (request.targetId !== actorId) {
    return { ok: false, reason: 'forbidden' }
  }

  if (request.status !== FOLLOW_REQUEST_STATUS.PENDING) {
    return { ok: false, reason: 'already_processed' }
  }

  // フォロー関係作成とリクエスト削除を原子的に実行。
  // upsert で冪等化し、二重承認や既存フォローでも unique 制約違反で落とさない。
  await prisma.$transaction(async (tx) => {
    await tx.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: request.requesterId,
          followingId: actorId,
        },
      },
      create: {
        followerId: request.requesterId,
        followingId: actorId,
      },
      update: {},
    })

    await tx.followRequest.delete({
      where: { id: requestId },
    })
  })

  // 承認通知（リクエスト送信者宛）。ブロック関係・通知設定・重複・プッシュ通知は
  // createNotification 内部で処理される。
  void createNotification({
    userId: request.requesterId,
    actorId,
    type: 'follow_request_approved',
  }).catch((err) => {
    logger.error('createNotification (follow_request_approved) failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  })

  // アナリティクスに記録（fire-and-forget）
  void recordNewFollowerService(actorId).catch((err) => {
    logger.error('recordNewFollower failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  })

  return { ok: true, requesterId: request.requesterId }
}

/**
 * フォローリクエストを拒否する。
 *
 * actorId === request.targetId（所有権）を確認し、リクエストを削除する。
 * 通知は送らない（Web 側と同じ仕様）。
 */
export async function rejectFollowRequestCore(
  actorId: string,
  requestId: string,
): Promise<FollowRequestCoreResult> {
  const request = await prisma.followRequest.findUnique({
    where: { id: requestId },
  })

  if (!request) {
    return { ok: false, reason: 'not_found' }
  }

  if (request.targetId !== actorId) {
    return { ok: false, reason: 'forbidden' }
  }

  await prisma.followRequest.delete({
    where: { id: requestId },
  })

  return { ok: true }
}

/**
 * 受信したフォローリクエスト（pending のみ）の一覧を取得する。
 *
 * Web 側の getReceivedFollowRequests と同じクエリ・整形ロジックを共有する。
 */
export async function listReceivedFollowRequests(
  userId: string,
  cursor?: string,
  limit: number = DEFAULT_PAGE_LIMIT,
): Promise<ListReceivedFollowRequestsResult> {
  const safeLimit = Math.min(Math.max(Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT)

  const requests = await prisma.followRequest.findMany({
    where: {
      targetId: userId,
      status: FOLLOW_REQUEST_STATUS.PENDING,
    },
    include: {
      requester: { select: USER_MINIMAL_WITH_BIO_SELECT },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: safeLimit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  })

  const hasMore = requests.length === safeLimit

  return {
    requests: requests.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      requester: r.requester,
    })),
    nextCursor: hasMore ? requests[requests.length - 1]?.id : undefined,
  }
}
