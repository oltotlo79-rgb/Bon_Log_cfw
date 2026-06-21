/**
 * @module app/api/v1/scheduled-posts/[id]
 * GET    /api/v1/scheduled-posts/{id} — 予約投稿詳細（所有者のみ・プレミアム限定）
 * PATCH  /api/v1/scheduled-posts/{id} — 予約投稿更新（pending のみ・プレミアム限定）
 * DELETE /api/v1/scheduled-posts/{id} — 予約投稿ハード削除（published 不可・プレミアム限定）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import {
  scheduledPostUpdateV1Schema,
  getScheduledPostV1,
  updateScheduledPostV1,
  deleteScheduledPostV1,
} from '@/lib/services/scheduled-post-service'
import {
  ERR_SCHEDULED_POST_PREMIUM_ONLY,
  ERR_SCHEDULED_POST_NOT_FOUND,
  ERR_SCHEDULED_POST_ACCESS_DENIED,
  ERR_SCHEDULED_POST_UPDATE_DENIED,
} from '@/lib/constants/errors'
import { z } from 'zod'

const idSchema = z.string().min(1)

type Params = { params: Promise<{ id: string }> }

function mapErrorCode(error: string): typeof MOBILE_API_ERROR_CODES[keyof typeof MOBILE_API_ERROR_CODES] {
  if (error === ERR_SCHEDULED_POST_PREMIUM_ONLY) return MOBILE_API_ERROR_CODES.PREMIUM_REQUIRED
  return MOBILE_API_ERROR_CODES.VALIDATION_ERROR
}

function isNotFoundError(error: string): boolean {
  return (
    error === ERR_SCHEDULED_POST_NOT_FOUND ||
    error === ERR_SCHEDULED_POST_ACCESS_DENIED ||
    error === ERR_SCHEDULED_POST_UPDATE_DENIED
  )
}

export async function GET(request: NextRequest, { params }: Params) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const idParsed = idSchema.safeParse(id)
  if (!idParsed.success) return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)

  // 3. レート制限（read: 60/分）
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. ビジネスロジック
  const result = await getScheduledPostV1(auth.userId, idParsed.data)

  if (!result.ok) {
    if (isNotFoundError(result.error) || result.status === 404) {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404, result.error)
    }
    return apiError(mapErrorCode(result.error), result.status, result.error)
  }

  return NextResponse.json(result.item)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ + ボディ検証
  const { id } = await params
  const idParsed = idSchema.safeParse(id)
  if (!idParsed.success) return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = scheduledPostUpdateV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（update_scheduled_post: 5/分）
  const rl = await checkUserRateLimit(auth.userId, 'update_scheduled_post')
  if (!rl.success) return apiRateLimited(rl)

  // 4. ビジネスロジック
  const result = await updateScheduledPostV1(auth.userId, idParsed.data, parsed.data)

  if (!result.ok) {
    if (isNotFoundError(result.error) || result.status === 404) {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404, result.error)
    }
    return apiError(mapErrorCode(result.error), result.status, result.error)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: Params) {
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
  const result = await deleteScheduledPostV1(auth.userId, idParsed.data)

  if (!result.ok) {
    if (isNotFoundError(result.error) || result.status === 404) {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404, result.error)
    }
    return apiError(mapErrorCode(result.error), result.status, result.error)
  }

  return NextResponse.json({ success: true })
}
