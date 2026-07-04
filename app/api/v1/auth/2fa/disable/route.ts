/**
 * @module app/api/v1/auth/2fa/disable
 * DELETE /api/v1/auth/2fa/disable — 2FA 無効化
 *
 * body: { password } — Web の disable2FA と同じくパスワード確認を要求する
 * （TOTP コードではない。無効化は「今アプリを持っている証明」より「本人であることの再確認」が目的）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import {
  ERR_2FA_NOT_ENABLED,
  ERR_NO_PASSWORD_SET,
  ERR_INCORRECT_PASSWORD,
} from '@/lib/constants/errors'
import { twoFactorDisableRequestSchema } from '@/lib/api/v1/schemas/request'
import { disable2FAForUser } from '@/lib/services/two-factor-service'

export async function DELETE(request: NextRequest) {
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

  const parsed = twoFactorDisableRequestSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（Zod 通過後）
  const rl = await checkUserRateLimit(auth.userId, 'two_factor_setup')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 無効化
  const result = await disable2FAForUser(auth.userId, parsed.data.password)
  if (!result.ok) {
    if (result.error === ERR_2FA_NOT_ENABLED || result.error === ERR_NO_PASSWORD_SET) {
      return apiError(MOBILE_API_ERROR_CODES.CONFLICT, 409, result.error)
    }
    if (result.error === ERR_INCORRECT_PASSWORD) {
      return apiError(MOBILE_API_ERROR_CODES.AUTH_INVALID_CREDENTIALS, 401, result.error)
    }
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404, result.error)
  }

  return NextResponse.json({ disabled: true })
}
