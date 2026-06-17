/**
 * @module app/api/v1/users/me
 * GET    /api/v1/users/me — 認証ユーザーの基本情報取得
 * PATCH  /api/v1/users/me — 認証ユーザーのプロフィール編集
 * DELETE /api/v1/users/me — 認証ユーザーのアカウント削除（不可逆）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { apiError, apiRateLimited, apiZodError, requireBearerUser } from '@/lib/api/v1'
import { prisma } from '@/lib/db'
import { isPremiumUser } from '@/lib/premium'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { updateProfileRequestSchema } from '@/lib/api/v1/schemas/request'
import { assertMediaUrlsFromOwnStorage } from '@/lib/services/media-url-validator'
import { isNicknameReserved, updateUserProfile } from '@/lib/services/user-profile-write-service'
import { deleteUserAccount } from '@/lib/services/account-deletion-service'
import { ERR_NICKNAME_RESERVED, ERR_ACCOUNT_DELETE_FAILED } from '@/lib/constants/errors'
import logger from '@/lib/logger'

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

export async function PATCH(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response
  const { userId } = auth

  // 2. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = updateProfileRequestSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)
  const data = parsed.data

  // avatarUrl / headerUrl が外部ストレージ URL でないかを検証する。
  // モバイルは POST /api/v1/upload/image で取得した自社 URL のみ渡せる。
  const mediaUrls: string[] = []
  if (data.avatarUrl) mediaUrls.push(data.avatarUrl)
  if (data.headerUrl) mediaUrls.push(data.headerUrl)
  if (!assertMediaUrlsFromOwnStorage(mediaUrls)) {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  // nickname が予約済みかを確認する
  if (data.nickname !== undefined && isNicknameReserved(data.nickname)) {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400, ERR_NICKNAME_RESERVED)
  }

  // 3. レート制限（Zod 通過後に実施。Web の updateProfile と同プリセット）
  const rl = await checkUserRateLimit(userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 4. プロフィール更新 + revalidatePath は service 内で実施
  const result = await updateUserProfile(userId, data)

  return NextResponse.json(result)
}

export async function DELETE(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response
  const { userId } = auth

  // 2. レート制限（body なし・Zod 不要のため認証後に即実施）
  const rl = await checkUserRateLimit(userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 3. アカウント削除（トランザクション + RefreshToken Cascade 失効）
  try {
    await deleteUserAccount(userId)
  } catch (error) {
    logger.error('Account deletion error (v1):', error)
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, ERR_ACCOUNT_DELETE_FAILED)
  }

  return NextResponse.json({ success: true })
}
