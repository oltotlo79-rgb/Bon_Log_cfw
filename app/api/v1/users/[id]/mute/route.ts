/**
 * @module app/api/v1/users/[id]/mute
 * POST /api/v1/users/[id]/mute — ミュート（冪等: 既ミュートでも 200）
 * DELETE /api/v1/users/[id]/mute — ミュート解除（冪等: 未ミュートでも 200）
 *
 * ミュートはフォロー関係を変更しない。
 * 自己操作は 400 VALIDATION_ERROR。
 * 対象不在・停止ユーザーは 404 NOT_FOUND。
 * ゲストアカウントは 403 GUEST_NOT_ALLOWED。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited, apiZodError } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { cuidSchema } from '@/lib/actions/schemas/common'
import { muteUserService, unmuteUserService } from '@/lib/services/mute-service'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = cuidSchema.safeParse(id)
  if (!parsedId.success) return apiZodError(parsedId.error)
  const targetId = parsedId.data

  // 3. 自己操作拒否
  if (auth.userId === targetId) {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  // 4. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'mute_user')
  if (!rl.success) return apiRateLimited(rl)

  // 5. ミュート実行
  const result = await muteUserService(auth.userId, targetId)

  if (!result.ok) {
    if (result.reason === 'self') return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
    if (result.reason === 'not_found') return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }

  return NextResponse.json({ muted: true })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = cuidSchema.safeParse(id)
  if (!parsedId.success) return apiZodError(parsedId.error)
  const targetId = parsedId.data

  // 3. 自己操作拒否
  if (auth.userId === targetId) {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  // 4. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'unmute_user')
  if (!rl.success) return apiRateLimited(rl)

  // 5. ミュート解除実行
  const result = await unmuteUserService(auth.userId, targetId)

  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }

  return NextResponse.json({ muted: false })
}
