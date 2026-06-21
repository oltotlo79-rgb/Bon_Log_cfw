/**
 * @module app/api/v1/scheduled-posts/[id]/cancel
 * POST /api/v1/scheduled-posts/{id}/cancel — 予約投稿をソフトキャンセル（status→cancelled）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { cancelScheduledPostV1 } from '@/lib/services/scheduled-post-service'
import {
  ERR_SCHEDULED_POST_NOT_FOUND,
  ERR_CANCEL_DENIED,
} from '@/lib/constants/errors'
import { z } from 'zod'

const idSchema = z.string().min(1)

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const idParsed = idSchema.safeParse(id)
  if (!idParsed.success) return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)

  // 3. レート制限（engagement: 30/分）
  const rl = await checkUserRateLimit(auth.userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 4. ビジネスロジック
  const result = await cancelScheduledPostV1(auth.userId, idParsed.data)

  if (!result.ok) {
    const isNotFound =
      result.error === ERR_SCHEDULED_POST_NOT_FOUND || result.error === ERR_CANCEL_DENIED
    if (isNotFound || result.status === 404) {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404, result.error)
    }
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, result.status, result.error)
  }

  return NextResponse.json({ success: true })
}
