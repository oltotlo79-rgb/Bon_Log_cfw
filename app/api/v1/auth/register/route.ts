/**
 * @module app/api/v1/auth/register
 * POST /api/v1/auth/register — 新規ユーザー登録
 *
 * 成功: 201 + { success: true }
 * モバイルはこのレスポンスを受け取ったら verify-email-sent 画面へ遷移し、
 * ユーザーに確認メールのリンクをクリックするよう促す。
 *
 * 列挙攻撃方針:
 *   Web の registerUser はメール重複を ERR_EMAIL_ALREADY_REGISTERED として
 *   明示的にユーザーに返す（既存の登録フォームの挙動）。API も一貫して 409 CONFLICT で
 *   同じ情報量を返す（Web と揃えることで、片方だけ隠す中途半端な列挙対策を避ける）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import {
  apiError,
  apiZodError,
  apiRateLimited,
} from '@/lib/api/v1'
import { registerRequestSchema } from '@/lib/api/v1/schemas'
import { registerUserCore } from '@/lib/services/registration-service'
import { checkRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { getClientIpFromRequest } from '@/lib/utils/client-ip'
import { logRegisterSuccess } from '@/lib/security-logger'
import logger from '@/lib/logger'
import { CURRENT_TERMS_VERSION } from '@/lib/constants/terms-version'

export async function POST(request: NextRequest) {
  // 1. Zod バリデーション（rate limit より先に行い、不正入力で quota を消費しない）
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = registerRequestSchema.safeParse(body)
  if (!parsed.success) {
    return apiZodError(parsed.error)
  }
  const { email, password, nickname } = parsed.data

  // 2. レート制限（IP ベース）— Zod 通過後
  const rl = await checkRateLimit(request, 'register')
  if (!rl.success) {
    return apiRateLimited(rl)
  }

  // 3. ユーザー作成 + 確認メール送信
  // termsAccepted は registerRequestSchema で z.literal(true) 必須のため、
  // ここに到達した時点で同意済み。証跡として現行バージョンを保存する。
  let result
  try {
    result = await registerUserCore({ email, password, nickname, termsVersion: CURRENT_TERMS_VERSION })
  } catch (error) {
    logger.error('registerUserCore unexpected error:', error)
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }

  if (!result.ok) {
    switch (result.reason) {
      case 'email_already_registered':
        return apiError(MOBILE_API_ERROR_CODES.CONFLICT, 409, result.message)
      case 'email_blacklisted':
      case 'nickname_reserved':
        return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400, result.message)
      case 'device_blacklisted':
        return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400, result.message)
      case 'email_send_failed':
        return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.message)
    }
  }

  const ip = getClientIpFromRequest(request)
  logRegisterSuccess(result.userId, ip)

  return NextResponse.json({ success: true }, { status: 201 })
}
