/**
 * @module app/api/v1/auth/password-reset/confirm
 * POST /api/v1/auth/password-reset/confirm — パスワードリセット確定
 */

import { type NextRequest, NextResponse } from 'next/server'
import { apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { passwordResetConfirmSchema } from '@/lib/api/v1/schemas'
import { checkRateLimit } from '@/lib/rate-limit'
import { resetPasswordCore } from '@/lib/services/password-reset-service'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'

export async function POST(request: NextRequest) {
  // 1. Zod バリデーション
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = passwordResetConfirmSchema.safeParse(body)
  if (!parsed.success) {
    return apiZodError(parsed.error)
  }
  const { email, token, newPassword } = parsed.data

  // 2. レート制限（IP ベース）— Zod 通過後
  const rl = await checkRateLimit(request, 'passwordReset', email)
  if (!rl.success) {
    return apiRateLimited(rl)
  }

  // 3. パスワードリセット実行（強度チェック済みの newPassword を渡す）
  const result = await resetPasswordCore(email, token, newPassword)

  if (!result.ok) {
    // invalid_token / user_not_found は一律 401（列挙攻撃防止）
    return apiError(MOBILE_API_ERROR_CODES.AUTH_INVALID_CREDENTIALS, 401)
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
