/**
 * 一括通知作成ヘルパー
 *
 * @module lib/services/notification-bulk
 */

import 'server-only'
import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import { sendPushNotification } from '@/lib/web-push'
import {
  SYSTEM_NOTIFICATION_TYPES,
  type NotificationType,
} from '@/types/notification'

/**
 * 一括通知パラメータ
 *
 * @property recipientIds  通知を受け取るユーザーID配列（重複は内部で除去）
 * @property actorId       アクションを行ったユーザーID（system 通知の場合は受信者自身でも可）
 * @property type          通知タイプ（Prisma enum と一致）
 * @property postId        関連投稿ID（任意）
 * @property commentId     関連コメントID（任意）
 * @property pushBody      プッシュ通知の本文（システム通知向け。指定なしは type ベースの汎用文）
 * @property skipPushNotification  プッシュ通知の送信を抑止するフラグ（システム告知の大量配信時など）
 * @property checkBlocks   true の場合、actor との双方向ブロックを除外。system 通知では false を推奨
 * @property checkPreferences  true の場合、各ユーザーの notificationPreferences を尊重
 */
export type BulkNotificationParams = {
  recipientIds: readonly string[]
  actorId: string
  type: NotificationType
  postId?: string
  commentId?: string
  pushBody?: string
  skipPushNotification?: boolean
  checkBlocks?: boolean
  checkPreferences?: boolean
}

export type BulkNotificationResult = {
  /** 実際に DB へ INSERT を試みた件数（skipDuplicates により実 INSERT は減る可能性あり） */
  attempted: number
  /** prefs/block で除外された件数 */
  filtered: number
}

/**
 * JSON 値を `Record<string, boolean>` として安全にパースする。boolean 以外の値は除外する。
 */
function parseNotificationPrefs(val: unknown): Record<string, boolean> {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return {}
  const result: Record<string, boolean> = {}
  for (const [key, v] of Object.entries(val)) {
    if (typeof v === 'boolean') result[key] = v
  }
  return result
}

/**
 * 複数ユーザーに通知を一括作成する。
 *
 * - block / prefs フィルタ → `createMany({ skipDuplicates: true })` の流れで原子的に書き込む
 * - push 通知は failure-tolerant に並列送信（個別失敗は通知作成を妨げない）
 *
 * @returns 試行件数とフィルタ件数。ロギング・観測性のために返す
 */
export async function createNotificationsBulk(
  params: BulkNotificationParams,
): Promise<BulkNotificationResult> {
  const {
    actorId,
    type,
    postId,
    commentId,
    pushBody,
    skipPushNotification = false,
    checkBlocks = true,
    checkPreferences = true,
  } = params

  // 重複・自己通知を除外
  const uniqueRecipients = Array.from(new Set(params.recipientIds)).filter(
    (id) => id && id !== actorId,
  )
  if (uniqueRecipients.length === 0) {
    return { attempted: 0, filtered: 0 }
  }

  let candidateIds = uniqueRecipients

  // ブロックフィルタ（双方向）
  if (checkBlocks) {
    const blocks = await prisma.block.findMany({
      where: {
        OR: [
          { blockerId: actorId, blockedId: { in: candidateIds } },
          { blockerId: { in: candidateIds }, blockedId: actorId },
        ],
      },
      select: { blockerId: true, blockedId: true },
    })
    const blockedSet = new Set(
      blocks.map((b) => (b.blockerId === actorId ? b.blockedId : b.blockerId)),
    )
    candidateIds = candidateIds.filter((id) => !blockedSet.has(id))
  }

  // notificationPreferences フィルタ
  if (checkPreferences && candidateIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: candidateIds } },
      select: { id: true, notificationPreferences: true },
    })
    const prefsByUser = new Map(
      users.map((u) => [u.id, parseNotificationPrefs(u.notificationPreferences)] as const),
    )
    candidateIds = candidateIds.filter((id) => {
      const prefs = prefsByUser.get(id)
      // prefs[type] === false の場合のみ除外（未設定はデフォルト ON とみなす）
      return !prefs || prefs[type] !== false
    })
  }

  const filtered = uniqueRecipients.length - candidateIds.length

  if (candidateIds.length === 0) {
    return { attempted: 0, filtered }
  }

  // 一括 INSERT。skipDuplicates により再実行されても重複行を作らない。
  // postId/commentId が同一 + 同一 type + 同一 actor で既存通知があればスキップ。
  await prisma.notification.createMany({
    data: candidateIds.map((recipientId) => ({
      userId: recipientId,
      actorId,
      type,
      postId,
      commentId,
    })),
    skipDuplicates: true,
  })

  // プッシュ通知をバックグラウンド送信。1件失敗が他に伝播しないよう Promise.allSettled で隔離。
  if (!skipPushNotification) {
    const url = postId ? `/posts/${postId}` : '/notifications'
    const body = pushBody ?? '新しい通知が届きました'
    void Promise.allSettled(
      candidateIds.map((recipientId) =>
        sendPushNotification(recipientId, {
          title: 'BON-LOG',
          body,
          tag: `${type}-${actorId}-${postId || commentId || ''}`,
          data: { url },
        }),
      ),
    ).catch((err) => {
      logger.error('Bulk push notification dispatch error', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  return { attempted: candidateIds.length, filtered }
}

/**
 * システム通知（アクターを伴わない通知）を一括作成する。
 *
 * `createNotificationsBulk` との違い:
 * - 受信者 ID 自身を actor として格納する（system 通知の既存慣習）
 * - block 関係のチェックはスキップ（actor が実在するユーザーアクションではないため）
 * - notificationPreferences は尊重する
 *
 * cron・管理者一斉配信など、アクターが存在しない文脈から呼び出す。
 * CLAUDE.md ルール6 により `prisma.notification.create*` の直接呼び出しは禁止。
 */
export async function createSystemNotificationsBulk(params: {
  recipientIds: readonly string[]
  type: NotificationType
  postId?: string
  pushBody?: string
  skipPushNotification?: boolean
}): Promise<BulkNotificationResult> {
  const { type, postId, pushBody, skipPushNotification = false } = params

  if (!SYSTEM_NOTIFICATION_TYPES.has(type)) {
    throw new Error(
      `createSystemNotificationsBulk called with non-system type '${type}'. Use createNotificationsBulk instead.`,
    )
  }

  const uniqueRecipients = Array.from(new Set(params.recipientIds)).filter(
    (id) => typeof id === 'string' && id.length > 0,
  )
  if (uniqueRecipients.length === 0) {
    return { attempted: 0, filtered: 0 }
  }

  // notificationPreferences フィルタ（prefs[type] === false の場合のみ除外）
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueRecipients } },
    select: { id: true, notificationPreferences: true },
  })
  const prefsByUser = new Map(
    users.map((u) => [u.id, parseNotificationPrefs(u.notificationPreferences)] as const),
  )
  const candidateIds = uniqueRecipients.filter((id) => {
    const prefs = prefsByUser.get(id)
    return !prefs || prefs[type] !== false
  })

  const filtered = uniqueRecipients.length - candidateIds.length
  if (candidateIds.length === 0) {
    return { attempted: 0, filtered }
  }

  await prisma.notification.createMany({
    data: candidateIds.map((recipientId) => ({
      userId: recipientId,
      actorId: recipientId,
      type,
      ...(postId ? { postId } : {}),
    })),
    skipDuplicates: true,
  })

  if (!skipPushNotification) {
    const url = postId ? `/posts/${postId}` : '/notifications'
    const body = pushBody ?? '新しい通知が届きました'
    void Promise.allSettled(
      candidateIds.map((recipientId) =>
        sendPushNotification(recipientId, {
          title: 'BON-LOG',
          body,
          tag: `${type}-system-${postId || ''}`,
          data: { url },
        }),
      ),
    ).catch((err) => {
      logger.error('System bulk push notification dispatch error', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  return { attempted: candidateIds.length, filtered }
}
