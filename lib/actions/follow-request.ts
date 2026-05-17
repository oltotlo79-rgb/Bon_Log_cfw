/**
 * フォローリクエスト機能のServer Actions
 *
 * @module lib/actions/follow-request
 */

'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { recordNewFollower } from './analytics'
import { createNotification } from '@/lib/services/notification-core'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { requireAuth, requireActiveNonGuestUser, requireNotGuest, actionSuccess, actionError, type ActionResult, enforceUserRateLimit } from '@/lib/actions/utils'
import logger from '@/lib/logger'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { ERR_SELF_FOLLOW_REQUEST, ERR_USER_NOT_FOUND, ERR_PUBLIC_ACCOUNT_FOLLOW, ERR_FOLLOW_REQUEST_BLOCKED, ERR_ALREADY_FOLLOWING, ERR_FOLLOW_REQUEST_ALREADY_SENT, ERR_FOLLOW_REQUEST_NOT_FOUND, ERR_FOLLOW_REQUEST_APPROVE_DENIED, ERR_FOLLOW_REQUEST_ALREADY_PROCESSED, ERR_FOLLOW_REQUEST_REJECT_DENIED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { FOLLOW_REQUEST_STATUS } from '@/lib/constants/status'
import { ROUTE_SETTINGS_FOLLOW_REQUESTS } from '@/lib/constants/routes'
import { buildUserPath } from '@/lib/constants/path-builders'

/**
 * フォローリクエストのステータス
 */
type FollowRequestStatus = 'pending' | 'approved' | 'rejected'

/** フォローリクエストID / ユーザーID 用の共通スキーマ */
const idSchema = z.string().min(1)

/**
 * フォローリクエストを送信
 *
 * ## 機能概要
 * 非公開アカウントにフォローリクエストを送信します。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. 自分自身へのリクエスト防止
 * 3. 対象ユーザーの存在確認
 * 4. 対象が非公開アカウントかチェック
 * 5. 既存のフォロー/リクエスト確認
 * 6. リクエスト作成
 * 7. 通知作成
 *
 * @param targetUserId - リクエスト送信先のユーザーID
 * @returns 成功時は { success: true, status: 'pending' }、失敗時は { error: string }
 */
export async function sendFollowRequest(targetUserId: string): Promise<ActionResult<{ status: FollowRequestStatus }>> {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const currentUserId = authResult.userId

  if (!idSchema.safeParse(targetUserId).success) return actionError(ERR_INVALID_INPUT)

  if (currentUserId === targetUserId) {
    return actionError(ERR_SELF_FOLLOW_REQUEST)
  }

  const rl = await enforceUserRateLimit(currentUserId, 'engagement')
  if (rl) return actionError(rl.error)

  // 対象ユーザーの存在確認と公開設定チェック
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, isPublic: true, nickname: true },
  })

  if (!targetUser) {
    return actionError(ERR_USER_NOT_FOUND)
  }

  // 公開アカウントの場合はリクエスト不要（通常のフォローを使用）
  if (targetUser.isPublic) {
    return actionError(ERR_PUBLIC_ACCOUNT_FOLLOW)
  }

  // ブロック・既存フォロー・既存リクエストを並列チェック
  const [isBlocked, existingFollow, existingRequest] = await Promise.all([
    prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: targetUserId,
          blockedId: currentUserId,
        },
      },
    }),
    prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: targetUserId,
        },
      },
    }),
    prisma.followRequest.findUnique({
      where: {
        requesterId_targetId: {
          requesterId: currentUserId,
          targetId: targetUserId,
        },
      },
    }),
  ])

  if (isBlocked) {
    return actionError(ERR_FOLLOW_REQUEST_BLOCKED)
  }

  if (existingFollow) {
    return actionError(ERR_ALREADY_FOLLOWING)
  }

  if (existingRequest) {
    if (existingRequest.status === FOLLOW_REQUEST_STATUS.PENDING) {
      return actionError(ERR_FOLLOW_REQUEST_ALREADY_SENT)
    }
    // rejected の場合は再送信を許可（古いリクエストを削除）
    await prisma.followRequest.delete({
      where: { id: existingRequest.id },
    })
  }

  // フォローリクエスト作成
  await prisma.followRequest.create({
    data: {
      requesterId: currentUserId,
      targetId: targetUserId,
      status: FOLLOW_REQUEST_STATUS.PENDING,
    },
  })

  // 通知作成（ブロックチェック・プッシュ通知はヘルパー内で処理）
  await createNotification({
    userId: targetUserId,
    actorId: currentUserId,
    type: 'follow_request',
  })

  revalidatePath(buildUserPath(targetUserId))

  return actionSuccess({ status: FOLLOW_REQUEST_STATUS.PENDING })
}

/**
 * フォローリクエストを承認
 *
 * ## 機能概要
 * 受信したフォローリクエストを承認し、フォロー関係を確立します。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. リクエスト存在確認
 * 3. 自分宛てのリクエストか確認
 * 4. フォロー関係作成
 * 5. リクエスト削除
 * 6. 承認通知作成
 *
 * @param requestId - フォローリクエストID
 * @returns 成功時は { success: true, status: 'approved' }、失敗時は { error: string }
 */
export async function approveFollowRequest(requestId: string): Promise<ActionResult<{ status: FollowRequestStatus }>> {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const currentUserId = authResult.userId

  if (!idSchema.safeParse(requestId).success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(currentUserId, 'engagement')
  if (rl) return actionError(rl.error)

  // リクエスト取得
  const request = await prisma.followRequest.findUnique({
    where: { id: requestId },
    include: {
      requester: { select: { id: true, nickname: true } },
    },
  })

  if (!request) {
    return actionError(ERR_FOLLOW_REQUEST_NOT_FOUND)
  }

  // 自分宛てのリクエストか確認
  if (request.targetId !== currentUserId) {
    return actionError(ERR_FOLLOW_REQUEST_APPROVE_DENIED)
  }

  // 既に処理済みか確認
  if (request.status !== FOLLOW_REQUEST_STATUS.PENDING) {
    return actionError(ERR_FOLLOW_REQUEST_ALREADY_PROCESSED)
  }

  // フォロー関係作成とリクエスト削除を原子的に実行。
  // 通知は createNotification 経由で別途処理する（CLAUDE.md ルール6）。
  await prisma.$transaction(async (tx) => {
    await tx.follow.create({
      data: {
        followerId: request.requesterId,
        followingId: currentUserId,
      },
    })

    await tx.followRequest.delete({
      where: { id: requestId },
    })
  })

  // 承認通知（リクエスト送信者宛）。ブロック関係・通知設定・重複・プッシュ通知は
  // createNotification 内部で処理される。
  await createNotification({
    userId: request.requesterId,
    actorId: currentUserId,
    type: 'follow_request_approved',
  })

  // アナリティクスに記録
  void recordNewFollower(currentUserId).catch((err) => logger.error('recordNewFollower failed:', err))

  revalidatePath(ROUTE_SETTINGS_FOLLOW_REQUESTS)
  revalidatePath(buildUserPath(request.requesterId))

  return actionSuccess({ status: FOLLOW_REQUEST_STATUS.APPROVED })
}

/**
 * フォローリクエストを拒否
 *
 * ## 機能概要
 * 受信したフォローリクエストを拒否します。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. リクエスト存在確認
 * 3. 自分宛てのリクエストか確認
 * 4. リクエスト削除
 *
 * @param requestId - フォローリクエストID
 * @returns 成功時は { success: true, status: 'rejected' }、失敗時は { error: string }
 */
export async function rejectFollowRequest(requestId: string): Promise<ActionResult<{ status: FollowRequestStatus }>> {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const currentUserId = authResult.userId

  if (!idSchema.safeParse(requestId).success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(currentUserId, 'engagement')
  if (rl) return actionError(rl.error)

  // リクエスト取得
  const request = await prisma.followRequest.findUnique({
    where: { id: requestId },
  })

  if (!request) {
    return actionError(ERR_FOLLOW_REQUEST_NOT_FOUND)
  }

  // 自分宛てのリクエストか確認
  if (request.targetId !== currentUserId) {
    return actionError(ERR_FOLLOW_REQUEST_REJECT_DENIED)
  }

  // リクエスト削除（通知は送らない）
  await prisma.followRequest.delete({
    where: { id: requestId },
  })

  revalidatePath(ROUTE_SETTINGS_FOLLOW_REQUESTS)

  return actionSuccess({ status: FOLLOW_REQUEST_STATUS.REJECTED })
}

/**
 * 送信したフォローリクエストをキャンセル
 *
 * @param targetUserId - リクエスト送信先のユーザーID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 */
export async function cancelFollowRequest(targetUserId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const currentUserId = authResult.userId

  if (!idSchema.safeParse(targetUserId).success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(currentUserId, 'engagement')
  if (rl) return actionError(rl.error)

  // リクエスト取得
  const request = await prisma.followRequest.findUnique({
    where: {
      requesterId_targetId: {
        requesterId: currentUserId,
        targetId: targetUserId,
      },
    },
  })

  if (!request) {
    return actionError(ERR_FOLLOW_REQUEST_NOT_FOUND)
  }

  // リクエスト削除
  await prisma.followRequest.delete({
    where: { id: request.id },
  })

  revalidatePath(buildUserPath(targetUserId))

  return actionSuccess()
}

/**
 * フォローリクエストの状態を取得
 *
 * @param targetUserId - 対象ユーザーID
 * @returns フォローリクエストの状態
 */
export async function getFollowRequestStatus(targetUserId: string) {
  const auth = await requireAuth()
  if ('error' in auth) return { hasRequest: false, status: null }
  const userId = auth.userId

  try {
    const request = await prisma.followRequest.findUnique({
      where: {
        requesterId_targetId: {
          requesterId: userId,
          targetId: targetUserId,
        },
      },
      select: { status: true },
    })

    return {
      hasRequest: !!request,
      status: request?.status || null,
    }
  } catch (error) {
    // テーブルが存在しない場合やデータベースエラー時はデフォルト値を返す
    logger.error('getFollowRequestStatus error:', error)
    return { hasRequest: false, status: null }
  }
}

/**
 * フォローリクエスト一覧の取得方向。
 * - `'received'`: 自分宛てに送られてきたリクエスト（相手 = `requester`）
 * - `'sent'`: 自分が送信したリクエスト（相手 = `target`）
 */
type FollowRequestDirection = 'received' | 'sent'

/**
 * 受信 / 送信フォローリクエスト一覧の共通実装。
 * 公開関数 `getReceivedFollowRequests` / `getSentFollowRequests` から呼ばれ、
 * 方向以外のクエリ・整形・エラーハンドリングを 1 箇所に集約する。
 */
async function listFollowRequests(
  direction: FollowRequestDirection,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
) {
  const auth = await requireAuth()
  if ('error' in auth) return { requests: [], nextCursor: undefined }
  const guestCheck = await requireNotGuest()
  if (guestCheck) return { requests: [], nextCursor: undefined }
  const userId = auth.userId

  try {
    const where = direction === 'received'
      ? { targetId: userId, status: FOLLOW_REQUEST_STATUS.PENDING }
      : { requesterId: userId, status: FOLLOW_REQUEST_STATUS.PENDING }

    const requests = await prisma.followRequest.findMany({
      where,
      include: {
        // 相手側のユーザー情報。`received` なら `requester`、`sent` なら `target` を取得。
        // どちらか片方の関係しか引かないため、include の双方記述で N+1 にはならない。
        requester: direction === 'received'
          ? { select: USER_MINIMAL_WITH_BIO_SELECT }
          : false,
        target: direction === 'sent'
          ? { select: USER_MINIMAL_WITH_BIO_SELECT }
          : false,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    })

    const hasMore = requests.length === limit

    return {
      requests: requests.map((r: typeof requests[number]) => ({
        id: r.id,
        user: direction === 'received' ? r.requester : r.target,
        createdAt: r.createdAt,
      })),
      nextCursor: hasMore ? requests[requests.length - 1]?.id : undefined,
    }
  } catch (error) {
    // テーブルが存在しない場合やデータベースエラー時
    logger.error(`listFollowRequests(${direction}) error:`, error)
    return { requests: [], nextCursor: undefined }
  }
}

/**
 * 受信したフォローリクエスト一覧を取得（公開 API）。
 *
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数
 */
export async function getReceivedFollowRequests(cursor?: string, limit = DEFAULT_PAGE_LIMIT) {
  return listFollowRequests('received', cursor, limit)
}

/**
 * 送信したフォローリクエスト一覧を取得（公開 API）。
 *
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数
 */
export async function getSentFollowRequests(cursor?: string, limit = DEFAULT_PAGE_LIMIT) {
  return listFollowRequests('sent', cursor, limit)
}

/**
 * 未処理のフォローリクエスト数を取得
 *
 * @returns 未処理リクエスト数
 */
export async function getPendingFollowRequestCount() {
  const auth = await requireAuth()
  if ('error' in auth) return { count: 0 }
  const userId = auth.userId

  try {
    const count = await prisma.followRequest.count({
      where: {
        targetId: userId,
        status: FOLLOW_REQUEST_STATUS.PENDING,
      },
    })

    return { count }
  } catch (error) {
    // テーブルが存在しない場合やデータベースエラー時
    logger.error('getPendingFollowRequestCount error:', error)
    return { count: 0 }
  }
}
