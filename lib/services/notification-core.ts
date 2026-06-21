/**
 * 通知作成・削除のコアロジック
 *
 * 単発通知の作成・削除・プッシュ通知配送を担う内部ロジック層。
 * 認証済みコンテキスト（Server Action / API Route / Cron / 他 Service）からのみ呼ばれる前提で、
 * 認証・権限チェックは行わない。CLAUDE.md のレイヤ規約に従い、
 * ここに `'use server'` は付けない（RPC 公開しない）。
 *
 * @module lib/services/notification-core
 */

import 'server-only'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import { sendPushNotification } from '@/lib/web-push'
import { sendExpoPushToUser } from '@/lib/services/push/expo-push'
import { ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_NOTIFICATIONS } from '@/lib/constants/routes'
import { buildPostPath } from '@/lib/constants/path-builders'
import { actionSuccess, actionError } from '@/types/action-result'
import type { ActionResult } from '@/types/action-result'

export {
  VALID_NOTIFICATION_TYPES,
  SYSTEM_NOTIFICATION_TYPES,
  isSystemNotification,
  type NotificationType,
} from '@/types/notification'
import {
  VALID_NOTIFICATION_TYPES,
  isSystemNotification,
  type NotificationType,
} from '@/types/notification'

const notificationParamsSchema = z.object({
  userId: z.string().min(1),
  actorId: z.string().min(1),
  type: z.enum(VALID_NOTIFICATION_TYPES),
  postId: z.string().min(1).optional(),
  commentId: z.string().min(1).optional(),
})

const PUSH_BODY_MAP: Record<string, (actor: string) => string> = {
  like: (actor) => `${actor}さんがあなたの投稿にいいねしました`,
  comment: (actor) => `${actor}さんがあなたの投稿にコメントしました`,
  reply: (actor) => `${actor}さんがあなたのコメントに返信しました`,
  comment_like: (actor) => `${actor}さんがあなたのコメントにいいねしました`,
  follow: (actor) => `${actor}さんがあなたをフォローしました`,
  quote: (actor) => `${actor}さんがあなたの投稿を引用しました`,
  follow_request: (actor) => `${actor}さんからフォローリクエストが届きました`,
  follow_request_approved: (actor) => `${actor}さんがフォローリクエストを承認しました`,
  mention: (actor) => `${actor}さんがあなたをメンションしました`,
  message: (actor) => `${actor}さんからメッセージが届きました`,
  repost: (actor) => `${actor}さんがあなたの投稿をリポストしました`,
  system: () => 'お知らせがあります',
  subscription_expiring: () => 'サブスクリプションの有効期限が近づいています',
}

function buildPushBody(type: string, actorName: string): string {
  const builder = PUSH_BODY_MAP[type]
  return builder ? builder(actorName) : `${actorName}さんから通知があります`
}

/** JSON 値を `Record<string, boolean>` として安全にパースする。boolean 以外の値は除外する。 */
function parseNotificationPrefs(val: unknown): Record<string, boolean> {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return {}
  const result: Record<string, boolean> = {}
  for (const [key, v] of Object.entries(val)) {
    if (typeof v === 'boolean') result[key] = v
  }
  return result
}

/**
 * 2 ユーザー間のブロック関係を最小クエリで判定する。
 * `getExcludedUserIds` は全ブロック対象 ID を取得するため、単一ペアの判定にはオーバーヘッドが大きい。
 * ここでは単一 row の存在チェックのみ行う。
 */
async function areMutuallyUnblocked(userId: string, targetUserId: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: userId },
      ],
    },
    select: { blockerId: true },
  })
  // block が見つからなければブロック関係なし = 通知作成可
  return !block
}

/**
 * 通知を作成する（内部 API）。
 *
 * ## 自動フィルタリング
 * 1. 自己通知はスキップ (userId === actorId)
 * 2. ブロック関係（双方向）があればスキップ
 * 3. 受信者の `notificationPreferences[type]` が false ならスキップ
 * 4. 同一 (userId, actorId, type, postId, commentId) の通知が既にあればスキップ
 *
 * 上記いずれの理由でスキップされても `success: true` を返す（副作用ゼロで正常終了）。
 */
export async function createNotification(params: {
  userId: string
  actorId: string
  type: NotificationType
  postId?: string
  commentId?: string
}): Promise<ActionResult<void>> {
  const parsed = notificationParamsSchema.safeParse(params)
  if (!parsed.success) {
    logger.error('createNotification: invalid params', { errors: parsed.error.issues })
    return actionError(ERR_INVALID_INPUT)
  }
  const { userId, actorId, type, postId, commentId } = parsed.data

  if (!isSystemNotification(type)) {
    if (userId === actorId) return actionSuccess()
    const allowed = await areMutuallyUnblocked(userId, actorId)
    if (!allowed) return actionSuccess()
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  })
  const prefs = parseNotificationPrefs(user?.notificationPreferences)
  if (prefs[type] === false) return actionSuccess()

  let created = false
  await prisma.$transaction(async (tx) => {
    const existingNotification = await tx.notification.findFirst({
      where: {
        userId,
        actorId,
        type,
        postId: postId || null,
        commentId: commentId || null,
      },
    })
    if (existingNotification) return

    await tx.notification.create({
      data: { userId, actorId, type, postId, commentId },
    })
    created = true
  })

  if (created) {
    let actorName = 'ユーザー'
    if (!isSystemNotification(type)) {
      const actor = await prisma.user.findUnique({
        where: { id: actorId },
        select: { nickname: true },
      })
      actorName = actor?.nickname || actorName
    }
    const pushBody = buildPushBody(type, actorName)
    const url = postId ? buildPostPath(postId) : ROUTE_NOTIFICATIONS

    void sendPushNotification(userId, {
      title: 'BON-LOG',
      body: pushBody,
      tag: `${type}-${actorId}-${postId || commentId || ''}`,
      data: { url },
    }).catch((err) => {
      logger.error('Push notification send failed', {
        userId,
        type,
        error: err instanceof Error ? err.message : String(err),
      })
    })

    void sendExpoPushToUser(userId, {
      title: 'BON-LOG',
      body: pushBody,
      data: { url, type },
    }).catch((err) => {
      logger.error('Expo Push notification send failed', {
        userId,
        type,
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  return actionSuccess()
}

/**
 * 指定条件に合う通知を削除する（内部 API）。いいね取り消しなどで使用。
 */
export async function deleteNotification(params: {
  userId: string
  actorId: string
  type: NotificationType
  postId?: string
  commentId?: string
}): Promise<ActionResult<void>> {
  const parsed = notificationParamsSchema.safeParse(params)
  if (!parsed.success) {
    logger.error('deleteNotification: invalid params', { errors: parsed.error.issues })
    return actionError(ERR_INVALID_INPUT)
  }
  const { userId, actorId, type, postId, commentId } = parsed.data

  await prisma.notification.deleteMany({
    where: {
      userId,
      actorId,
      type,
      postId: postId || null,
      commentId: commentId || null,
    },
  })

  return actionSuccess()
}
