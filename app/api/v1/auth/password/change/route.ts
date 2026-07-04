/**
 * @module app/api/v1/auth/password/change
 * POST /api/v1/auth/password/change — ログイン中ユーザーのパスワード変更
 *
 * body: { currentPassword, newPassword } — 現パスワード確認必須（TOTP コードではない）。
 * Phase 1 は現パスワード確認のみ。2FA 有効ユーザーへの TOTP 追加要求は今回対象外。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { ERR_USER_NOT_FOUND, ERR_NO_PASSWORD_SET, ERR_INCORRECT_PASSWORD } from '@/lib/constants/errors'
import { changePasswordRequestSchema } from '@/lib/api/v1/schemas/request'
import { changeUserPasswordCore } from '@/lib/services/password-change-service'
import { getClientIpFromRequest } from '@/lib/utils/client-ip'

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

  const parsed = changePasswordRequestSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（Zod 通過後）
  const rl = await checkUserRateLimit(auth.userId, 'password_change')
  if (!rl.success) return apiRateLimited(rl)

  // 4. パスワード変更
  const ip = getClientIpFromRequest(request)
  const result = await changeUserPasswordCore(
    auth.userId,
    parsed.data.currentPassword,
    parsed.data.newPassword,
    ip,
  )
  if (!result.ok) {
    if (result.error === ERR_NO_PASSWORD_SET) {
      return apiError(MOBILE_API_ERROR_CODES.CONFLICT, 409, result.error)
    }
    if (result.error === ERR_INCORRECT_PASSWORD) {
      return apiError(MOBILE_API_ERROR_CODES.AUTH_INVALID_CREDENTIALS, 401, result.error)
    }
    if (result.error === ERR_USER_NOT_FOUND) {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404, result.error)
    }
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.error)
  }

  return NextResponse.json({ success: true })
}
