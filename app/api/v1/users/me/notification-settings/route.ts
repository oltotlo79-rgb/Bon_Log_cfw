/**
 * @module app/api/v1/users/me/notification-settings
 * GET  /api/v1/users/me/notification-settings — 通知設定取得
 * PATCH /api/v1/users/me/notification-settings — 通知設定更新（部分更新）
 *
 * system / subscription_expiring は受け付けない（Web 側と同一仕様）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser } from '@/lib/api/v1/auth-guard'
import { apiZodError, apiRateLimited } from '@/lib/api/v1/response'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import {
  notificationPreferencesSchema,
  parseNotificationPreferences,
} from '@/lib/services/notification-preferences-utils'
import { ROUTE_SETTINGS_NOTIFICATIONS } from '@/lib/constants/routes'

export async function GET(request: NextRequest) {
  // 1. 認証
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. ビジネスロジック（読み取りのみ。レート制限は read で軽量）
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { notificationPreferences: true },
  })

  const preferences = parseNotificationPreferences(user?.notificationPreferences)

  return NextResponse.json({ preferences }, { status: 200 })
}

export async function PATCH(request: NextRequest) {
  // 1. 認証
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. Zod バリデーション
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = notificationPreferencesSchema.safeParse(body)
  if (!parsed.success) {
    return apiZodError(parsed.error)
  }
  const sanitized = parsed.data

  // 3. レート制限（ユーザーベース）
  const rl = await checkUserRateLimit(auth.userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 部分更新（Web 側と同一の Prisma 操作）
  await prisma.user.update({
    where: { id: auth.userId },
    data: { notificationPreferences: sanitized },
  })

  revalidatePath(ROUTE_SETTINGS_NOTIFICATIONS)

  return NextResponse.json({ success: true }, { status: 200 })
}
