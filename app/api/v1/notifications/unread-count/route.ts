/**
 * @module app/api/v1/notifications/unread-count
 * GET /api/v1/notifications/unread-count — 未読通知件数取得
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { fetchUnreadNotificationCount } from '@/lib/services/notification-read-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可: 通知は認証ユーザー専用）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'api')
  if (!rl.success) return apiRateLimited(rl)

  // 3. 未読通知件数取得（ミュートユーザーを除外）
  const count = await fetchUnreadNotificationCount(auth.userId)

  return NextResponse.json({ count })
}
