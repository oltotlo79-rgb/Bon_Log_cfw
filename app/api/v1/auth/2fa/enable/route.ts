/**
 * @module app/api/v1/auth/2fa/enable
 * POST /api/v1/auth/2fa/enable — 2FA 有効化
 *
 * body: { code, setupId } — code は GET /api/v1/auth/2fa/setup で表示した TOTP コード、
 * setupId は同エンドポイントが発行した一時セットアップ参照キー。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import {
  ERR_2FA_ALREADY_ENABLED,
  ERR_2FA_SETUP_EXPIRED,
  ERR_2FA_INVALID_CODE,
} from '@/lib/constants/errors'
import { twoFactorEnableRequestSchema } from '@/lib/api/v1/schemas/request'
import { enable2FAForUser } from '@/lib/services/two-factor-service'

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

  const parsed = twoFactorEnableRequestSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（Zod 通過後）
  const rl = await checkUserRateLimit(auth.userId, 'two_factor_setup')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 有効化
  const result = await enable2FAForUser(auth.userId, parsed.data.code, parsed.data.setupId)
  if (!result.ok) {
    if (result.error === ERR_2FA_ALREADY_ENABLED) {
      return apiError(MOBILE_API_ERROR_CODES.CONFLICT, 409, result.error)
    }
    if (result.error === ERR_2FA_SETUP_EXPIRED) {
      return apiError(MOBILE_API_ERROR_CODES.AUTH_2FA_TICKET_EXPIRED, 401, result.error)
    }
    if (result.error === ERR_2FA_INVALID_CODE) {
      return apiError(MOBILE_API_ERROR_CODES.AUTH_2FA_INVALID_CODE, 401, result.error)
    }
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404, result.error)
  }

  return NextResponse.json({ enabled: true })
}
