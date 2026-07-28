/**
 * @module lib/services/notification-read-service
 * 通知一覧・未読数取得のクエリロジック。
 *
 * lib/actions/notification.ts の getNotifications / getUnreadCount と
 * app/api/v1/notifications の双方から呼ばれる。
 * 認証・レート制限は呼び出し元が担う前提。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_RELATION } from '@/lib/prisma/shared-includes'
import { getMutedUserIds, getExcludedUserIds } from '@/lib/actions/filter-helper'
import { normalizeCursorPagination } from '@/lib/actions/pagination'

/**
 * 通知の actor 除外オプション。
 * 未指定/false は Web (`lib/actions/notification.ts`) と同一のミュートのみ除外（後方互換の既定値）。
 * true は v1 API 専用: ブロック双方向 + ミュートを union で除外する。
 */
export type NotificationExclusionOptions = {
  excludeBlocked?: boolean
}

/** fetchNotifications の内部クエリ形状（Prisma 推論型のエイリアス）。 */
type NotificationQueryResult = Awaited<ReturnType<typeof queryNotifications>>

async function queryNotifications(params: {
  userId: string
  excludedUserIds: string[]
  safeCursor?: string
  safeLimit: number
}) {
  return prisma.notification.findMany({
    where: {
      userId: params.userId,
      ...(params.excludedUserIds.length > 0 && {
        actorId: { notIn: params.excludedUserIds },
      }),
    },
    include: {
      actor: USER_MINIMAL_RELATION,
      post: { select: { id: true, content: true } },
      comment: { select: { id: true, content: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: params.safeLimit,
    ...(params.safeCursor && { cursor: { id: params.safeCursor }, skip: 1 }),
  })
}

/** Prisma クエリ結果の単一行型（include 済み） */
export type NotificationItem = NotificationQueryResult[number]

export type NotificationsResult = {
  notifications: NotificationItem[]
  nextCursor: string | undefined
}

/**
 * ユーザーの通知一覧を返す。
 * デフォルト（`options.excludeBlocked` 未指定）はミュートユーザーからの通知のみ除外する
 * （Web `lib/actions/notification.ts` と同一フィルタ、fail-open）。
 * `excludeBlocked: true`（v1 API 専用）はブロック双方向 + ミュートを union で除外し、
 * relation lookup 失敗時は fail-closed（呼び出し元に例外を伝播し、対象通知を含む結果を返さない）。
 */
export async function fetchNotifications(
  userId: string,
  cursor?: string,
  limit?: number,
  options?: NotificationExclusionOptions,
): Promise<NotificationsResult> {
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  const excludedUserIds = options?.excludeBlocked
    ? await getExcludedUserIds(userId, { blocked: true, blockedBy: true, muted: true })
    : await getMutedUserIds(userId)

  const notifications = await queryNotifications({
    userId,
    excludedUserIds,
    safeCursor,
    safeLimit,
  })

  return {
    notifications,
    nextCursor:
      notifications.length === safeLimit ? notifications[notifications.length - 1]?.id : undefined,
  }
}

/**
 * 指定した通知群を既読化する。`ids` を省略すると全未読を既読化する。
 * `where` 句に `userId` を必ず含め、他ユーザーの通知を更新できないようにする。
 */
export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  if (ids && ids.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId },
      data: { isRead: true },
    })
  } else {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })
  }
}

/**
 * ユーザーの未読通知数を返す。
 * デフォルト（`options.excludeBlocked` 未指定）はミュートユーザーからの通知のみ除外する
 * （Web `lib/actions/notification.ts` と同一フィルタ、fail-open）。
 * `excludeBlocked: true`（v1 API 専用）はブロック双方向 + ミュートを union で除外し、
 * relation lookup 失敗時は fail-closed（呼び出し元に例外を伝播する）。
 */
export async function fetchUnreadNotificationCount(
  userId: string,
  options?: NotificationExclusionOptions,
): Promise<number> {
  const excludedUserIds = options?.excludeBlocked
    ? await getExcludedUserIds(userId, { blocked: true, blockedBy: true, muted: true })
    : await getMutedUserIds(userId)

  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
      ...(excludedUserIds.length > 0 && {
        actorId: { notIn: excludedUserIds },
      }),
    },
  })
}
