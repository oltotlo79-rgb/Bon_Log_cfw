/**
 * @module app/api/v1/notifications/unread-count
 * GET /api/v1/notifications/unread-count — 未読通知件数取得
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { fetchUnreadNotificationCount } from '@/lib/services/notification-read-service'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可: 通知は認証ユーザー専用）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'api')
  if (!rl.success) return apiRateLimited(rl)

  // 3. 未読通知件数取得（ブロック双方向 + ミュートを除外。relation lookup 失敗時は
  //    fail-closed のため例外を捕捉し typed 500 を返す — ブロック済み通知を件数に含めない）
  try {
    const count = await fetchUnreadNotificationCount(auth.userId, { excludeBlocked: true })
    return NextResponse.json({ count })
  } catch (error) {
    logger.error('GET /api/v1/notifications/unread-count failed', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    })
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }
}
