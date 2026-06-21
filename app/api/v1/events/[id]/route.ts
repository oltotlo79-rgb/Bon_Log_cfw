/**
 * @module app/api/v1/events/[id]
 * GET    /api/v1/events/{id} — イベント詳細取得（ゲスト可）
 * PATCH  /api/v1/events/{id} — イベント更新（作成者のみ）
 * DELETE /api/v1/events/{id} — イベント削除（作成者のみ）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import {
  updateEventV1Schema,
  getEventV1,
  updateEventV1,
  deleteEventV1,
} from '@/lib/services/event-service'
import { z } from 'zod'
import { MAX_NOTIFICATION_ID_LENGTH } from '@/lib/constants/limits'
import {
  ERR_EVENT_NOT_FOUND,
  ERR_EDIT_PERMISSION_DENIED,
  ERR_PERMISSION_DENIED,
} from '@/lib/constants/errors'

const eventIdSchema = z.string().min(1).max(MAX_NOTIFICATION_ID_LENGTH)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Bearer 認証（ゲスト可: イベント詳細は公開）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = eventIdSchema.safeParse(id)
  if (!parsedId.success) return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)

  // 3. レート制限（read プリセット: 60/分）
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. イベント詳細取得
  const result = await getEventV1(parsedId.data)
  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  return NextResponse.json(result.event)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Bearer 認証（ゲスト不可: 更新は認証必須）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = eventIdSchema.safeParse(id)
  if (!parsedId.success) return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)

  // 3. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = updateEventV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 4. レート制限（update_event: 5/分）
  const rl = await checkUserRateLimit(auth.userId, 'update_event')
  if (!rl.success) return apiRateLimited(rl)

  // 5. イベント更新（作成者チェックはサービス層で実施）
  const result = await updateEventV1(parsedId.data, parsed.data, auth.userId)
  if (!result.ok) {
    if (result.error === ERR_EVENT_NOT_FOUND) {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
    }
    if (result.error === ERR_EDIT_PERMISSION_DENIED) {
      return apiError(MOBILE_API_ERROR_CODES.GUEST_NOT_ALLOWED, 403, result.error)
    }
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400, result.error)
  }

  return NextResponse.json(result.event)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Bearer 認証（ゲスト不可: 削除は認証必須）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = eventIdSchema.safeParse(id)
  if (!parsedId.success) return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)

  // 3. レート制限（delete_event: 5/分）
  const rl = await checkUserRateLimit(auth.userId, 'delete_event')
  if (!rl.success) return apiRateLimited(rl)

  // 4. イベント削除（作成者チェックはサービス層で実施）
  const result = await deleteEventV1(parsedId.data, auth.userId)
  if (!result.ok) {
    if (result.error === ERR_EVENT_NOT_FOUND) {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
    }
    if (result.error === ERR_PERMISSION_DENIED) {
      return apiError(MOBILE_API_ERROR_CODES.GUEST_NOT_ALLOWED, 403, result.error)
    }
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.error)
  }

  return new NextResponse(null, { status: 204 })
}
