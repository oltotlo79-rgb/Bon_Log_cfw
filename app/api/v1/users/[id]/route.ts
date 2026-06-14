/**
 * @module app/api/v1/users/[id]
 * GET /api/v1/users/[id] — ユーザープロフィール取得（email 非公開）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited } from '@/lib/api/v1'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { fetchUserProfile } from '@/lib/services/user-read-service'
import { resolveFollowStateForOne } from '@/lib/api/v1/follow-state-resolver'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Bearer 認証
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  const { id: targetUserId } = await params

  // 2. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'api')
  if (!rl.success) return apiRateLimited(rl)

  // 3. ユーザープロフィール取得（可視性チェック込み）
  const result = await fetchUserProfile(targetUserId, auth.userId)

  if (!result.found) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  // 4. フォロー状態を付与（共有サービスを変更しない v1 専用後付け）
  const followState = await resolveFollowStateForOne(auth.userId, targetUserId)

  return NextResponse.json({ ...result.user, ...followState })
}
