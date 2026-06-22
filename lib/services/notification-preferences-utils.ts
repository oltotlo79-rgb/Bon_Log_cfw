/**
 * @module lib/services/notification-preferences-utils
 * 通知設定の型・スキーマ・パースユーティリティ。
 * `lib/actions/notification-preferences.ts`（'use server'）と
 * `app/api/v1/...` Route Handler の両方から共有する純粋関数群。
 * 'use server' ディレクティブを持たないため非 async 関数を安全にエクスポートできる。
 */

import { z } from 'zod'

/**
 * ユーザーが切り替え可能な通知種別。
 *
 * Prisma `NotificationType` enum (`schema.prisma:24-38`) と同期する必要があるが、
 * `system` / `subscription_expiring` は重要なシステム通知のため意図的に除外する
 * （ユーザーが誤って off にできてしまうと課金・運営告知が届かなくなるため）。
 *
 * 通知作成側 (`lib/services/notification-core.ts:130`) は
 * `prefs[type] === false` のときだけ skip するので、未設定キーは default = true
 * 扱いとなり後方互換が保たれる。
 */
export type NotificationPreferences = {
  like?: boolean
  comment?: boolean
  reply?: boolean
  comment_like?: boolean
  follow?: boolean
  quote?: boolean
  follow_request?: boolean
  follow_request_approved?: boolean
  mention?: boolean
  message?: boolean
  repost?: boolean
}

export const notificationPreferencesSchema = z
  .object({
    like: z.boolean().optional(),
    comment: z.boolean().optional(),
    reply: z.boolean().optional(),
    comment_like: z.boolean().optional(),
    follow: z.boolean().optional(),
    quote: z.boolean().optional(),
    follow_request: z.boolean().optional(),
    follow_request_approved: z.boolean().optional(),
    mention: z.boolean().optional(),
    message: z.boolean().optional(),
    repost: z.boolean().optional(),
  })
  .strip()

/**
 * DB の Json カラムから取得した値を {@link NotificationPreferences} に絞り込む。
 * 不正値や null は空オブジェクトにフォールバックして、呼び出し側が素の
 * `as` キャストを避けられるようにする。
 */
export function parseNotificationPreferences(raw: unknown): NotificationPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result = notificationPreferencesSchema.safeParse(raw)
  return result.success ? result.data : {}
}
