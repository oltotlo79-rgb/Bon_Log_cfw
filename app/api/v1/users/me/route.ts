/**
 * @module app/api/v1/users/me
 * GET /api/v1/users/me — 認証ユーザーの基本情報取得
 */

import { type NextRequest, NextResponse } from 'next/server'
import { apiError, requireBearerUser } from '@/lib/api/v1'
import { prisma } from '@/lib/db'
import { isPremiumUser } from '@/lib/premium'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証
  const auth = await requireBearerUser(request)
  if (!auth.ok) {
    return auth.response
  }
  const { userId } = auth

  // 2. ユーザー情報取得（必要カラムのみ）
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
      bio: true,
    },
  })

  if (!user) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  // 3. プレミアム判定（参照時に期限切れを自動失効）
  const isPremium = await isPremiumUser(userId)

  return NextResponse.json({
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isPremium,
  })
}
