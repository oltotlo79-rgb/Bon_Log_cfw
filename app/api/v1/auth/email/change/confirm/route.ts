/**
 * @module app/api/v1/auth/email/change/confirm
 * POST /api/v1/auth/email/change/confirm — メールアドレス変更を確定
 *
 * body: { token } — メール内リンクのトークン。
 * token 所持自体が新アドレス所有性の証明になるため Bearer 認証は要求しない
 * （password-reset/confirm と同じ設計）。レート制限は IP ベース。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { emailChangeConfirmSchema } from '@/lib/api/v1/schemas/request'
import { checkRateLimit } from '@/lib/rate-limit'
import { confirmEmailChangeCore } from '@/lib/services/email-change-service'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'

export async function POST(request: NextRequest) {
  // 1. Zod バリデーション
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = emailChangeConfirmSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 2. レート制限（IP ベース）— Zod 通過後。email が body に無いため additionalKey なし
  const rl = await checkRateLimit(request, 'email_change_confirm')
  if (!rl.success) return apiRateLimited(rl)

  // 3. トークン検証 + メールアドレス更新
  const result = await confirmEmailChangeCore(parsed.data.token)

  if (!result.ok) {
    if (result.reason === 'email_taken') {
      return apiError(MOBILE_API_ERROR_CODES.CONFLICT, 409)
    }
    // invalid_token は一律 401（列挙攻撃防止。password-reset/confirm と同じ扱い）
    return apiError(MOBILE_API_ERROR_CODES.AUTH_INVALID_CREDENTIALS, 401)
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
