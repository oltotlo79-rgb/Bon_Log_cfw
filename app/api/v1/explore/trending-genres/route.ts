/**
 * @module app/api/v1/explore/trending-genres
 * GET /api/v1/explore/trending-genres — トレンドジャンル一覧
 *
 * ゲスト可（認証任意）。limit クエリパラメータで取得件数を指定できる。
 * postCount は直近 48 時間の投稿数（getCachedTrendingGenres の集計に準拠）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { EXPLORE_TRENDING_GENRES_LIMIT, MAX_PAGE_LIMIT } from '@/lib/constants/limits'
import { fetchTrendingGenres } from '@/lib/services/explore-service'

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

  // 4. トレンドジャンル取得（unstable_cache 済みの getCachedTrendingGenres 経由）
  const items = await fetchTrendingGenres(parsed.data.limit ?? EXPLORE_TRENDING_GENRES_LIMIT)

  return NextResponse.json({ items })
}
