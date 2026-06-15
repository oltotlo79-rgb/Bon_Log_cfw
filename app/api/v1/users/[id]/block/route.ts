/**
 * @module app/api/v1/users/[id]/block
 * POST /api/v1/users/[id]/block — ブロック（冪等: 既ブロックでも 200）
 * DELETE /api/v1/users/[id]/block — ブロック解除（冪等: 未ブロックでも 200）
 *
 * 自己操作は 400 VALIDATION_ERROR。
 * 対象不在・停止ユーザーは 404 NOT_FOUND（ブロック有無を秘匿）。
 * ゲストアカウントは 403 GUEST_NOT_ALLOWED。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited, apiZodError } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { cuidSchema } from '@/lib/actions/schemas/common'
import { blockUserService, unblockUserService } from '@/lib/services/block-service'

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
  const rl = await checkUserRateLimit(auth.userId, 'block_user')
  if (!rl.success) return apiRateLimited(rl)

  // 5. ブロック実行
  const result = await blockUserService(auth.userId, targetId)

  if (!result.ok) {
    if (result.reason === 'self') return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
    if (result.reason === 'not_found') return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }

  return NextResponse.json({ blocked: true })
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
  const rl = await checkUserRateLimit(auth.userId, 'unblock_user')
  if (!rl.success) return apiRateLimited(rl)

  // 5. ブロック解除実行
  const result = await unblockUserService(auth.userId, targetId)

  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }

  return NextResponse.json({ blocked: false })
}
