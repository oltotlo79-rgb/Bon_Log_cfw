/**
 * @module app/api/v1/reports
 * POST /api/v1/reports — 通報作成
 *
 * 対象不在は 404 NOT_FOUND。自己通報は 400 VALIDATION_ERROR。重複通報は 409 CONFLICT。
 * AUTO_HIDE_THRESHOLD（10 件）到達で自動非表示。ゲストは 403 GUEST_NOT_ALLOWED。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited, apiZodError } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { createReportRequestSchema } from '@/lib/api/v1/schemas/request'
import { createReportService } from '@/lib/services/report-service'

export async function POST(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = createReportRequestSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)
  const { targetType, targetId, reason, description } = parsed.data

  // 3. レート制限（Zod 通過後に実施）
  const rl = await checkUserRateLimit(auth.userId, 'create_report')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 通報作成
  const result = await createReportService({
    reporterId: auth.userId,
    targetType,
    targetId,
    reason,
    description,
  })

  if (!result.ok) {
    if (result.reason === 'not_found') return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
    if (result.reason === 'self') return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
    if (result.reason === 'already_reported') return apiError(MOBILE_API_ERROR_CODES.CONFLICT, 409)
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }

  return NextResponse.json({ success: true })
}
