/**
 * @module app/api/v1/auth/2fa/verify
 * POST /api/v1/auth/2fa/verify — 2FA コード検証
 *
 * 成功時: 200 + { accessToken, refreshToken, expiresIn }
 *
 * 重要仕様（モバイルへの連絡事項）:
 *   チケットは検証成功・失敗いずれの場合も GETDEL で消費される（単回使用）。
 *   コード不正の場合はチケットが消費済みになるため、/login からやり直すこと。
 */

import { type NextRequest, NextResponse } from 'next/server'
import {
  apiError,
  apiZodError,
  apiRateLimited,
} from '@/lib/api/v1'
import { issueTokenPair } from '@/lib/api/v1/token-pair'
import { consumeMobile2FATicket } from '@/lib/api/v1/mobile-2fa-ticket'
import { verify2FARequestSchema } from '@/lib/api/v1/schemas'
import { checkRateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/db'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import {
  verifyTOTP,
  verifyBackupCode,
  decryptSecret,
  detectCodeType,
  formatTOTPCode,
} from '@/lib/two-factor'

export async function POST(request: NextRequest) {
  // 1. Zod バリデーション
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = verify2FARequestSchema.safeParse(body)
  if (!parsed.success) {
    return apiZodError(parsed.error)
  }
  const { ticket, code } = parsed.data

  // 2. レート制限（IP ベース）— Zod 通過後
  const rl = await checkRateLimit(request, 'verify_2fa')
  if (!rl.success) {
    return apiRateLimited(rl)
  }

  // 3. チケット消費（GETDEL でアトミックに取得 + 削除）
  const userId = await consumeMobile2FATicket(ticket)
  if (!userId) {
    return apiError(MOBILE_API_ERROR_CODES.AUTH_2FA_TICKET_EXPIRED, 401)
  }

  // 4. ユーザー取得（停止チェック込み）
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isSuspended: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  })

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return apiError(MOBILE_API_ERROR_CODES.AUTH_2FA_INVALID_CODE, 401)
  }

  if (user.isSuspended) {
    return apiError(MOBILE_API_ERROR_CODES.ACCOUNT_SUSPENDED, 403)
  }

  // 5. コード検証（TOTP または バックアップコード）
  const codeType = detectCodeType(code)

  if (codeType === 'totp') {
    const secret = decryptSecret(user.twoFactorSecret)
    const formattedCode = formatTOTPCode(code)
    const isValid = await verifyTOTP(formattedCode, secret)
    if (!isValid) {
      return apiError(MOBILE_API_ERROR_CODES.AUTH_2FA_INVALID_CODE, 401)
    }
  } else {
    const backupCodeIndex = verifyBackupCode(code, user.twoFactorBackupCodes)
    if (backupCodeIndex === -1) {
      return apiError(MOBILE_API_ERROR_CODES.AUTH_2FA_INVALID_CODE, 401)
    }
    // 使用済みバックアップコードを削除（Web と同一挙動）
    const updatedBackupCodes = [...user.twoFactorBackupCodes]
    updatedBackupCodes.splice(backupCodeIndex, 1)
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorBackupCodes: updatedBackupCodes },
    })
  }

  // 6. トークンペア発行
  const tokenResult = await issueTokenPair(user.id)
  if (!tokenResult.ok) {
    return apiError(MOBILE_API_ERROR_CODES.SERVER_MISCONFIGURED, 503)
  }

  return NextResponse.json(tokenResult.tokenPair, { status: 200 })
}
