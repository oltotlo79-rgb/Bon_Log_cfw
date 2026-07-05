/**
 * @module app/api/v1/users/[id]/followers
 * GET /api/v1/users/{id}/followers — ユーザーのフォロワー一覧取得
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { readPaginationQuerySchema } from '@/lib/api/v1/schemas/request'
import { fetchUserFollowers } from '@/lib/services/user-connections-service'
import {
  resolveFollowStates,
  resolveIsFollowedByStates,
  resolveIsPublicMap,
} from '@/lib/api/v1/follow-state-resolver'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト可: 公開アカウントはゲストでも閲覧可）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  const { id: targetUserId } = await params

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = readPaginationQuerySchema.safeParse({
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'timeline')
  if (!rl.success) return apiRateLimited(rl)

  // 4. フォロワー一覧取得（可視性チェック込み）
  const result = await fetchUserFollowers(
    targetUserId,
    auth.userId,
    parsed.data.cursor,
    parsed.data.limit,
  )

  if (!result.ok) {
    if (result.reason === 'private_account') {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 403)
    }
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  if (result.items.length === 0) {
    return NextResponse.json({ items: [], nextCursor: result.nextCursor ?? null })
  }

  // 5. フォロー状態（双方向）・isPublic を一括付与（バッチクエリ / 共有サービス非変更）
  const targetIds = result.items.map((u) => u.id)
  const [followStateMap, isFollowedByMap, isPublicMap] = await Promise.all([
    resolveFollowStates(auth.userId, targetIds),
    resolveIsFollowedByStates(auth.userId, targetIds),
    resolveIsPublicMap(targetIds),
  ])

  const items = result.items.map((user) => {
    const followState = followStateMap.get(user.id) ?? { following: false, requested: false }
    return {
      ...user,
      following: followState.following,
      requested: followState.requested,
      isFollowedBy: isFollowedByMap.get(user.id) ?? false,
      isPublic: isPublicMap.get(user.id) ?? true,
    }
  })

  return NextResponse.json({
    items,
    nextCursor: result.nextCursor ?? null,
  })
}
