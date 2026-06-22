/**
 * @module app/api/v1/users/me/follow-requests/[id]/reject
 * POST /api/v1/users/me/follow-requests/{id}/reject — フォローリクエスト拒否
 *
 * 認証必須・ゲスト不可。所有権チェック（targetId === actorId）は core で実施。
 * 通知は送らない（Web 側と同一仕様）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser } from '@/lib/api/v1/auth-guard'
import { apiError, apiRateLimited } from '@/lib/api/v1/response'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { rejectFollowRequestCore } from '@/lib/services/follow-service'
import { revalidatePath } from 'next/cache'
import { ROUTE_SETTINGS_FOLLOW_REQUESTS } from '@/lib/constants/routes'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. 認証
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. レート制限（ユーザーベース）
  const rl = await checkUserRateLimit(auth.userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 3. ビジネスロジック
  const { id: requestId } = await params
  const result = await rejectFollowRequestCore(auth.userId, requestId)

  if (!result.ok) {
    if (result.reason === 'not_found' || result.reason === 'forbidden') {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
    }
  }

  revalidatePath(ROUTE_SETTINGS_FOLLOW_REQUESTS)

  return NextResponse.json({ success: true }, { status: 200 })
}
