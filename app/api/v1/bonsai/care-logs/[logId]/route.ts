/**
 * @module app/api/v1/bonsai/care-logs/[logId]
 * PATCH  /api/v1/bonsai/care-logs/{logId} — 手入れログ更新（所有者のみ）
 * DELETE /api/v1/bonsai/care-logs/{logId} — 手入れログ削除（所有者のみ）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { z } from 'zod'
import {
  updateCareLogV1,
  deleteCareLogV1,
  updateCareLogV1Schema,
} from '@/lib/services/bonsai-care-log-service'

const logIdSchema = z.object({ logId: z.string().min(1).max(64) })

type RouteParams = { params: Promise<{ logId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { logId } = await params
  const parsedId = logIdSchema.safeParse({ logId })
  if (!parsedId.success) return apiZodError(parsedId.error)

  // 3. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = updateCareLogV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 4. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'care_log_write')
  if (!rl.success) return apiRateLimited(rl)

  // 5. 手入れログ更新
  const result = await updateCareLogV1(auth.userId, parsedId.data.logId, parsed.data)
  if (!result.ok) {
    const code =
      result.status === 404
        ? MOBILE_API_ERROR_CODES.NOT_FOUND
        : result.status === 400
          ? MOBILE_API_ERROR_CODES.VALIDATION_ERROR
          : MOBILE_API_ERROR_CODES.INTERNAL_ERROR
    return apiError(code, result.status)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { logId } = await params
  const parsedId = logIdSchema.safeParse({ logId })
  if (!parsedId.success) return apiZodError(parsedId.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'delete_care_log')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 手入れログ削除
  const result = await deleteCareLogV1(auth.userId, parsedId.data.logId)
  if (!result.ok) {
    const code =
      result.status === 404
        ? MOBILE_API_ERROR_CODES.NOT_FOUND
        : MOBILE_API_ERROR_CODES.INTERNAL_ERROR
    return apiError(code, result.status)
  }

  return NextResponse.json({ success: true })
}
