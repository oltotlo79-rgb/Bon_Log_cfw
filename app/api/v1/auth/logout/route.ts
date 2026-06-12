/**
 * @module app/api/v1/auth/logout
 * POST /api/v1/auth/logout — リフレッシュトークンの失効
 *
 * 冪等設計: トークンが存在しない / 既に失効済みでも 200 を返す。
 * モバイルの fail-safe ログアウト（ネットワークエラー時のリトライ）を妨げないため。
 */

import { type NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { apiError, apiZodError } from '@/lib/api/v1'
import { logoutRequestSchema } from '@/lib/api/v1/schemas'
import { prisma } from '@/lib/db'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'

export async function POST(request: NextRequest) {
  // 1. Zod バリデーション
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = logoutRequestSchema.safeParse(body)
  if (!parsed.success) {
    return apiZodError(parsed.error)
  }
  const { refreshToken } = parsed.data

  // 2. トークンハッシュで検索・revoke（存在しなければ何もしない）
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')

  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  return NextResponse.json({ success: true }, { status: 200 })
}
