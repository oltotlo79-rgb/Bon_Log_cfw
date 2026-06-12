/**
 * @module app/api/v1/auth/login
 * POST /api/v1/auth/login — メール + パスワード認証
 *
 * 成功時（2FA 無効）: 200 + { accessToken, refreshToken, expiresIn }
 * 成功時（2FA 有効）: 202 + { requires2FA: true, ticket: string }
 */

import { type NextRequest, NextResponse } from 'next/server'
import {
  apiError,
  apiZodError,
  apiRateLimited,
} from '@/lib/api/v1'
import { issueTokenPair } from '@/lib/api/v1/token-pair'
import { issueMobile2FATicket } from '@/lib/api/v1/mobile-2fa-ticket'
import { loginRequestSchema } from '@/lib/api/v1/schemas'
import { verifyCredentials } from '@/lib/services/credential-verification'
import { checkRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { GUEST_EMAIL } from '@/lib/constants/guest'

export async function POST(request: NextRequest) {
  // 1. Zod バリデーション
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = loginRequestSchema.safeParse(body)
  if (!parsed.success) {
    return apiZodError(parsed.error)
  }
  const { email, password } = parsed.data

  // 2. レート制限（IP ベース）— Zod 通過後
  const rl = await checkRateLimit(request, 'login')
  if (!rl.success) {
    return apiRateLimited(rl)
  }

  // 3. ゲスト共有アカウントはモバイルから使用不可
  if (email === GUEST_EMAIL) {
    return apiError(MOBILE_API_ERROR_CODES.GUEST_NOT_ALLOWED, 403)
  }

  // 4. credentials 照合（throttle / password 照合 / 停止 / 未確認チェックを含む）
  const verifyResult = await verifyCredentials(email, password)

  if (!verifyResult.ok) {
    if (verifyResult.reason === 'suspended') {
      return apiError(MOBILE_API_ERROR_CODES.ACCOUNT_SUSPENDED, 403)
    }
    // throttled / invalid / unverified / no_password は一律 401（列挙攻撃防止）
    return apiError(MOBILE_API_ERROR_CODES.AUTH_INVALID_CREDENTIALS, 401)
  }

  const user = verifyResult.user

  // 5. 2FA 有効ユーザー: チケットを発行して 202 を返す
  if (user.twoFactorEnabled) {
    const ticket = await issueMobile2FATicket(user.id)
    return NextResponse.json({ requires2FA: true, ticket }, { status: 202 })
  }

  // 6. トークンペア発行
  const tokenResult = await issueTokenPair(user.id)
  if (!tokenResult.ok) {
    return apiError(MOBILE_API_ERROR_CODES.SERVER_MISCONFIGURED, 503)
  }

  return NextResponse.json(tokenResult.tokenPair, { status: 200 })
}
