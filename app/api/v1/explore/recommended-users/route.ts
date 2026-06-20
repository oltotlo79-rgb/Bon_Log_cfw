/**
 * @module app/api/v1/explore/recommended-users
 * GET /api/v1/explore/recommended-users — おすすめユーザー一覧
 *
 * ゲスト可（認証任意）。ゲスト時は空配列を返す（フォロー状態が計算できないため）。
 * 非ゲスト時は following / requested をバッチ解決して付与する。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { EXPLORE_RECOMMENDED_USERS_LIMIT, MAX_PAGE_LIMIT } from '@/lib/constants/limits'
import { fetchRecommendedUsers } from '@/lib/services/explore-service'
import { resolveFollowStates, resolveIsPublicMap } from '@/lib/api/v1/follow-state-resolver'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { prisma } from '@/lib/db'

const limitQuerySchema = z.object({
  limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
})

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = limitQuerySchema.safeParse({
    limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. ゲスト判定（ゲストは空配列）
  const viewer = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true },
  })
  const isGuest = viewer?.email === GUEST_EMAIL

  if (isGuest) {
    return NextResponse.json({ items: [] })
  }

  // 5. おすすめユーザー取得
  const users = await fetchRecommendedUsers(auth.userId, parsed.data.limit ?? EXPLORE_RECOMMENDED_USERS_LIMIT)

  if (users.length === 0) {
    return NextResponse.json({ items: [] })
  }

  // 6. フォロー状態・isPublic を一括付与（バッチクエリ / 共有サービス非変更）
  const targetIds = users.map((u) => u.id)
  const [followStateMap, isPublicMap] = await Promise.all([
    resolveFollowStates(auth.userId, targetIds),
    resolveIsPublicMap(targetIds),
  ])

  const items = users.map((user) => {
    const followState = followStateMap.get(user.id) ?? { following: false, requested: false }
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      followersCount: user.followersCount,
      following: followState.following,
      requested: followState.requested,
      isPublic: isPublicMap.get(user.id) ?? true,
    }
  })

  return NextResponse.json({ items })
}
