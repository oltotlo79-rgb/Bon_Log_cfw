/**
 * 通知機能の Server Actions
 *
 * @module lib/actions/notification
 */

'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { DEFAULT_PAGE_LIMIT, MAX_NOTIFICATION_ID_LENGTH } from '@/lib/constants/limits'
import { ERR_OPERATION_FAILED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_NOTIFICATIONS } from '@/lib/constants/routes'
import { requireAuth, requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import { fetchNotifications, fetchUnreadNotificationCount } from '@/lib/services/notification-read-service'
import logger from '@/lib/logger'

const notificationIdSchema = z.string().min(1).max(MAX_NOTIFICATION_ID_LENGTH)

/**
 * 通知一覧を取得
 *
 * ## 取得内容
 * - 通知情報（ID、タイプ、既読状態、作成日時）
 * - アクター情報（通知のトリガーとなったユーザー）
 * - 関連する投稿・コメントの情報
 *
 * ## フィルタリング
 * ミュートしているユーザーからの通知は自動的に除外
 *
 * ## ページネーション
 * カーソルベース
 */
export async function getNotifications(cursor?: string, limit = DEFAULT_PAGE_LIMIT) {
  const authResult = await requireAuth()
  if ('error' in authResult) return { notifications: [], nextCursor: undefined }
  const userId = authResult.userId

  return fetchNotifications(userId, cursor, limit)
}

/**
 * 指定された通知を既読状態に更新する。`where` 句で `userId` を絞り、他ユーザーの通知変更を防ぐ。
 */
export async function markAsRead(notificationId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  // 境界検証: 不正な ID で DB を叩かない
  const parsed = notificationIdSchema.safeParse(notificationId)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    await prisma.notification.update({
      where: { id: parsed.data, userId },
      data: { isRead: true },
    })
    revalidatePath(ROUTE_NOTIFICATIONS)
    return actionSuccess()
  } catch (error) {
    logger.error('Mark notification as read error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * 現在のユーザーの未読通知を全て既読状態に更新する。
 */
export async function markAllAsRead() {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })
    revalidatePath(ROUTE_NOTIFICATIONS)
    return actionSuccess()
  } catch (error) {
    logger.error('Mark all notifications as read error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * 現在のユーザーの未読通知件数を返す。ミュート中ユーザーからの通知は除外。
 */
export async function getUnreadCount() {
  const authResult = await requireAuth()
  if ('error' in authResult) return { count: 0 }
  const userId = authResult.userId

  const count = await fetchUnreadNotificationCount(userId)
  return { count }
}
