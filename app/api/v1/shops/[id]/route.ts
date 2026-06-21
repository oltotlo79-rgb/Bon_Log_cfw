/**
 * @module app/api/v1/shops/[id]
 * GET   /api/v1/shops/{id}  — 盆栽園詳細取得（ゲスト可）
 * PATCH /api/v1/shops/{id}  — 盆栽園編集（作成者または admin・認証必須）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import {
  ERR_SHOP_NOT_FOUND,
  ERR_EDIT_PERMISSION_DENIED,
} from '@/lib/constants/errors'
import {
  updateShopV1Schema,
  getShopV1,
  updateShopV1,
} from '@/lib/services/shop-service'
import { z } from 'zod'
import { MAX_NOTIFICATION_ID_LENGTH } from '@/lib/constants/limits'

const shopIdSchema = z.string().min(1).max(MAX_NOTIFICATION_ID_LENGTH)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Bearer 認証（ゲスト可: 詳細は公開）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const parsedId = shopIdSchema.safeParse(id)
  if (!parsedId.success) return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)

  // 2. レート制限（read プリセット: 60/分）
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 3. 盆栽園詳細取得
  const result = await getShopV1(parsedId.data, auth.userId)
  if (!result.ok) {
    if (result.error === ERR_SHOP_NOT_FOUND) {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404, result.error)
    }
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.error)
  }

  return NextResponse.json(result.shop)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Bearer 認証（ゲスト不可: 編集は認証必須）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  const { id } = await params
  const parsedId = shopIdSchema.safeParse(id)
  if (!parsedId.success) return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)

  // 2. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = updateShopV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（update_shop: 5/分）
  const rl = await checkUserRateLimit(auth.userId, 'update_shop')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 盆栽園更新
  const result = await updateShopV1(parsedId.data, parsed.data, auth.userId)
  if (!result.ok) {
    if (result.error === ERR_SHOP_NOT_FOUND) {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404, result.error)
    }
    if (result.error === ERR_EDIT_PERMISSION_DENIED) {
      return apiError(MOBILE_API_ERROR_CODES.GUEST_NOT_ALLOWED, 403, result.error)
    }
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.error)
  }

  return NextResponse.json({ success: true })
}
