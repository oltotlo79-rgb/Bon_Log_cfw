/**
 * @module app/api/v1/auth/2fa/setup
 * GET /api/v1/auth/2fa/setup — 2FA セットアップ開始
 *
 * TOTP シークレット・otpauth URI・バックアップコードを生成し、Redis に一時保存する
 * （lib/services/two-factor-service.ts の setup2FAForUser、Web の setup2FA と共通コア）。
 * `setupId` は POST /api/v1/auth/2fa/enable に必須で渡す必要がある。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { ERR_2FA_ALREADY_ENABLED } from '@/lib/constants/errors'
import { setup2FAForUser } from '@/lib/services/two-factor-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可: Web の requireActiveNonGuestUser と同等）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. レート制限（Zod 入力が無いためここで直接実施）
  const rl = await checkUserRateLimit(auth.userId, 'two_factor_setup')
  if (!rl.success) return apiRateLimited(rl)

  // 3. セットアップ情報生成
  const result = await setup2FAForUser(auth.userId)
  if (!result.ok) {
    if (result.error === ERR_2FA_ALREADY_ENABLED) {
      return apiError(MOBILE_API_ERROR_CODES.CONFLICT, 409, result.error)
    }
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404, result.error)
  }

  return NextResponse.json({
    secret: result.secret,
    otpAuthUrl: result.otpAuthUrl,
    setupId: result.setupId,
    backupCodes: result.backupCodes,
  })
}
