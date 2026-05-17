'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import {
  requireActiveNonGuestUser,
  actionSuccess,
  actionError,
  enforceUserRateLimit,
  type ActionResult,
} from '@/lib/actions/utils'
import { actionZodError } from '@/lib/actions/schemas/common'
import { ROUTE_SETTINGS_NOTIFICATIONS } from '@/lib/constants/routes'

export type NotificationPreferences = {
  like?: boolean
  comment?: boolean
  reply?: boolean
  comment_like?: boolean
  follow?: boolean
  quote?: boolean
  follow_request?: boolean
  follow_request_approved?: boolean
}

const notificationPreferencesSchema = z
  .object({
    like: z.boolean().optional(),
    comment: z.boolean().optional(),
    reply: z.boolean().optional(),
    comment_like: z.boolean().optional(),
    follow: z.boolean().optional(),
    quote: z.boolean().optional(),
    follow_request: z.boolean().optional(),
    follow_request_approved: z.boolean().optional(),
  })
  .strip()

/**
 * DB の Json カラムから取得した値を {@link NotificationPreferences} に絞り込む。
 * 不正値や null は空オブジェクトにフォールバックして、呼び出し側が素の
 * `as` キャストを避けられるようにする。
 */
function parseNotificationPreferences(raw: unknown): NotificationPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result = notificationPreferencesSchema.safeParse(raw)
  return result.success ? result.data : {}
}

/**
 * 通知設定を取得する。read action だが認可は必須 (他人の設定を返さない)。
 *
 * Why custom shape (not ActionResult): UI 側で空 fallback が自然なため `{ preferences }` を返す。
 * Server Actions ルールの例外宣言。
 */
export async function getNotificationPreferences(): Promise<{ preferences: NotificationPreferences }> {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return { preferences: {} }

  const user = await prisma.user.findUnique({
    where: { id: authResult.userId },
    select: { notificationPreferences: true },
  })

  return { preferences: parseNotificationPreferences(user?.notificationPreferences) }
}

/**
 * 通知設定を更新する。CLAUDE.md ルール3 (auth → Zod → rate-limit → logic) を遵守。
 */
export async function updateNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<ActionResult> {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const parsed = notificationPreferencesSchema.safeParse(preferences)
  if (!parsed.success) {
    return actionZodError(parsed.error)
  }
  const sanitized = parsed.data

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  await prisma.user.update({
    where: { id: userId },
    data: { notificationPreferences: sanitized },
  })

  revalidatePath(ROUTE_SETTINGS_NOTIFICATIONS)
  return actionSuccess()
}
