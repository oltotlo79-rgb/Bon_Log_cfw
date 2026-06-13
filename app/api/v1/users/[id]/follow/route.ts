/**
 * @module app/api/v1/users/[id]/follow
 * POST /api/v1/users/[id]/follow — フォロー（公開: フォロー確立, 非公開: リクエスト送信）
 * DELETE /api/v1/users/[id]/follow — フォロー解除 or リクエスト取消（同一エンドポイント）
 *
 * 全レスポンスは { following, requested, followerCount } の統一形式。
 * HTTP は 200 に統一（202 は使用しない）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited, apiZodError } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { cuidSchema } from '@/lib/actions/schemas/common'
import { prisma } from '@/lib/db'
import { checkInteractionEligibility } from '@/lib/services/user-eligibility'
import {
  followUser,
  sendFollowRequestPrimitive,
  unfollowUser,
  cancelFollowRequestPrimitive,
} from '@/lib/services/follow-service'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可: フォローは非ゲスト専用）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = cuidSchema.safeParse(id)
  if (!parsedId.success) return apiZodError(parsedId.error)
  const targetId = parsedId.data

  // 3. 自己フォロー拒否（Web の ERR_SELF_ACTION に対応して VALIDATION_ERROR を返す）
  if (auth.userId === targetId) {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  // 4. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 5. 対象ユーザーの可視性・ブロック関係を確認
  const eligibility = await checkInteractionEligibility(auth.userId, targetId)
  if (!eligibility.ok) {
    // block も存在しない場合も秘匿して NOT_FOUND（Web と同挙動）
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  // 6. 公開/非公開で分岐してフォロー or リクエスト送信
  let result
  if (eligibility.target.isPublic) {
    result = await followUser(auth.userId, targetId)
  } else {
    result = await sendFollowRequestPrimitive(auth.userId, targetId)
  }

  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  return NextResponse.json({
    following: result.state.following,
    requested: result.state.requested,
    followerCount: result.state.followerCount,
  })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = cuidSchema.safeParse(id)
  if (!parsedId.success) return apiZodError(parsedId.error)
  const targetId = parsedId.data

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 4. フォロー中かリクエスト中かを確認し、適切な解除処理を実行（冪等）
  const [existingFollow, existingRequest] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: auth.userId, followingId: targetId } },
    }),
    prisma.followRequest.findFirst({
      where: { requesterId: auth.userId, targetId },
    }),
  ])

  let followerCount: number

  if (existingFollow) {
    const result = await unfollowUser(auth.userId, targetId)
    followerCount = result.followerCount
  } else if (existingRequest) {
    const result = await cancelFollowRequestPrimitive(auth.userId, targetId)
    followerCount = result.followerCount
  } else {
    // 何もない場合は no-op として現在値を返す
    followerCount = await prisma.follow.count({ where: { followingId: targetId } })
  }

  return NextResponse.json({ following: false, requested: false, followerCount })
}
