'use server'

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
import {
  type NotificationPreferences,
  notificationPreferencesSchema,
  parseNotificationPreferences,
} from '@/lib/services/notification-preferences-utils'

// Re-export so that components/ can import the type from this module without
// creating a dependency on the services layer directly.
export type { NotificationPreferences }

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
