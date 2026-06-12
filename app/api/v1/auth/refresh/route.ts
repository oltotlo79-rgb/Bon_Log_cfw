/**
 * @module app/api/v1/auth/refresh
 * POST /api/v1/auth/refresh — リフレッシュトークンによるトークンペア更新
 *
 * ローテーション + 再利用検知:
 *   - 有効トークン提示 → 旧トークンを revoke し新ペア発行（トランザクション）
 *   - revoked 済みトークン再提示 → 盗難とみなし当該ユーザーの全トークンを即時失効
 */

import { type NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import {
  apiError,
  apiZodError,
  apiRateLimited,
} from '@/lib/api/v1'
import { issueTokenPair } from '@/lib/api/v1/token-pair'
import { refreshRequestSchema } from '@/lib/api/v1/schemas'
import { checkRateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/db'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import logger from '@/lib/logger'

export async function POST(request: NextRequest) {
  // 1. Zod バリデーション
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = refreshRequestSchema.safeParse(body)
  if (!parsed.success) {
    return apiZodError(parsed.error)
  }
  const { refreshToken } = parsed.data

  // 2. レート制限（IP ベース）— Zod 通過後
  const rl = await checkRateLimit(request, 'mobile_refresh')
  if (!rl.success) {
    return apiRateLimited(rl)
  }

  // 3. トークンハッシュで DB 検索
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
    },
  })

  // 4. 存在しない → AUTH_REFRESH_TOKEN_INVALID
  if (!stored) {
    return apiError(MOBILE_API_ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID, 401)
  }

  // 5. revoked 済み → 再利用検知（盗難の可能性）: 当該ユーザーの全トークンを失効
  if (stored.revokedAt !== null) {
    logger.warn('Refresh token reuse detected', { userId: stored.userId })
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return apiError(MOBILE_API_ERROR_CODES.AUTH_REFRESH_TOKEN_REUSE_DETECTED, 401)
  }

  // 6. 期限切れ → AUTH_REFRESH_TOKEN_INVALID
  if (stored.expiresAt < new Date()) {
    return apiError(MOBILE_API_ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID, 401)
  }

  // 7. ユーザー停止チェック
  const user = await prisma.user.findUnique({
    where: { id: stored.userId },
    select: { id: true, isSuspended: true },
  })

  if (!user) {
    return apiError(MOBILE_API_ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID, 401)
  }

  if (user.isSuspended) {
    return apiError(MOBILE_API_ERROR_CODES.ACCOUNT_SUSPENDED, 403)
  }

  // 8. ローテーション: トランザクション内で旧トークン revoke + 新ペア発行
  const tokenResult = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    })
    // tx を渡すことで新トークン作成をトランザクションに参加させる
    return issueTokenPair(user.id, tx)
  })

  if (!tokenResult.ok) {
    return apiError(MOBILE_API_ERROR_CODES.SERVER_MISCONFIGURED, 503)
  }

  return NextResponse.json(tokenResult.tokenPair, { status: 200 })
}
