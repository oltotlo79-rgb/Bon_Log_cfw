/**
 * 通知関連の共通型。
 *
 * `lib/services/notification-core` と `lib/actions/notification` の両方から
 * import されるため、`'use server'` ファイルで type re-export ができない制約を
 * 回避する目的で `types/` 層に置く。
 *
 * Prisma の `NotificationType` enum と値は同期する必要がある。
 * enum を増やしたら `VALID_NOTIFICATION_TYPES` と `PUSH_BODY_MAP`
 * （`notification-core.ts`）を併せて更新すること。
 *
 * @module types/notification
 */

export const VALID_NOTIFICATION_TYPES = [
  'like',
  'comment',
  'follow',
  'quote',
  'reply',
  'comment_like',
  'follow_request',
  'follow_request_approved',
  'mention',
  'message',
  'repost',
  'system',
  'subscription_expiring',
] as const

export type NotificationType = (typeof VALID_NOTIFICATION_TYPES)[number]

/**
 * システム通知（アクターを伴わない通知）。
 * これらの type ではブロック関係チェック・アクター情報取得をスキップする。
 */
export const SYSTEM_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
  'system',
  'subscription_expiring',
])

export function isSystemNotification(type: NotificationType): boolean {
  return SYSTEM_NOTIFICATION_TYPES.has(type)
}
