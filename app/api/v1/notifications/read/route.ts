/**
 * @module app/api/v1/notifications/read
 * PATCH /api/v1/notifications/read — 通知を既読化
 *
 * ids 指定: その通知群を既読化（userId 一致でのみ更新し、他ユーザーの通知は変更不可）
 * ids 省略 or 空配列: 当該ユーザーの未読を全件既読化
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { cuidSchema } from '@/lib/actions/schemas/common'
import { MAX_NOTIFICATION_READ_IDS } from '@/lib/constants/limits'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { markNotificationsRead, fetchUnreadNotificationCount } from '@/lib/services/notification-read-service'
import logger from '@/lib/logger'

const notificationReadBodySchema = z.object({
  ids: z
    .array(cuidSchema)
    .max(MAX_NOTIFICATION_READ_IDS)
    .optional(),
})

export async function PATCH(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可: 通知既読は非ゲスト専用）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. リクエストボディ検証
  const body: unknown = await request.json().catch(() => ({}))
  const parsed = notificationReadBodySchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 既読化（ids が空配列 or 未指定の場合は全件既読）
  const ids = parsed.data.ids && parsed.data.ids.length > 0 ? parsed.data.ids : undefined
  await markNotificationsRead(auth.userId, ids)

  // 5. 操作後の未読数を返す（モバイル側バッジの即時更新に使う）。
  //    ブロック双方向 + ミュートを除外。relation lookup 失敗時は fail-closed のため
  //    例外を捕捉し typed 500 を返す（ブロック済み通知を件数に含めない）。
  try {
    const unreadCount = await fetchUnreadNotificationCount(auth.userId, { excludeBlocked: true })
    return NextResponse.json({ success: true, unreadCount })
  } catch (error) {
    logger.error('PATCH /api/v1/notifications/read failed', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    })
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }
}
