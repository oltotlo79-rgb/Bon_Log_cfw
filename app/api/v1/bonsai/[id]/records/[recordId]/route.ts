/**
 * @module app/api/v1/bonsai/[id]/records/[recordId]
 * PATCH  /api/v1/bonsai/{id}/records/{recordId} — 成長記録更新
 * DELETE /api/v1/bonsai/{id}/records/{recordId} — 成長記録削除
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { z } from 'zod'
import {
  updateBonsaiRecordV1,
  deleteBonsaiRecordV1,
  updateBonsaiRecordV1Schema,
} from '@/lib/services/bonsai-record-service'

const paramsSchema = z.object({
  id: z.string().min(1).max(64),
  recordId: z.string().min(1).max(64),
})

type RouteParams = { params: Promise<{ id: string; recordId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const rawParams = await params
  const parsedParams = paramsSchema.safeParse(rawParams)
  if (!parsedParams.success) return apiZodError(parsedParams.error)

  // 3. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = updateBonsaiRecordV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 4. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'update_bonsai')
  if (!rl.success) return apiRateLimited(rl)

  // 5. 成長記録更新
  const result = await updateBonsaiRecordV1(
    auth.userId,
    parsedParams.data.id,
    parsedParams.data.recordId,
    parsed.data,
  )
  if (!result.ok) {
    const code =
      result.status === 404
        ? MOBILE_API_ERROR_CODES.NOT_FOUND
        : result.status === 400
          ? MOBILE_API_ERROR_CODES.VALIDATION_ERROR
          : MOBILE_API_ERROR_CODES.INTERNAL_ERROR
    return apiError(code, result.status)
  }

  return NextResponse.json(result.record)
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const rawParams = await params
  const parsedParams = paramsSchema.safeParse(rawParams)
  if (!parsedParams.success) return apiZodError(parsedParams.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'delete_bonsai')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 成長記録削除
  const result = await deleteBonsaiRecordV1(
    auth.userId,
    parsedParams.data.id,
    parsedParams.data.recordId,
  )
  if (!result.ok) {
    const code =
      result.status === 404 ? MOBILE_API_ERROR_CODES.NOT_FOUND : MOBILE_API_ERROR_CODES.INTERNAL_ERROR
    return apiError(code, result.status)
  }

  return NextResponse.json({ success: true as const })
}
