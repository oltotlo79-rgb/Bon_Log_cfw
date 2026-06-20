/**
 * @module app/api/v1/explore/trending-hashtags
 * GET /api/v1/explore/trending-hashtags — トレンドハッシュタグ一覧
 *
 * ゲスト可（認証任意）。limit クエリパラメータで取得件数を指定できる。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { EXPLORE_TRENDING_HASHTAGS_LIMIT } from '@/lib/constants/limits'
import { fetchTrendingHashtags } from '@/lib/services/explore-service'
import { MAX_PAGE_LIMIT } from '@/lib/constants/limits'

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

  // 4. トレンドハッシュタグ取得
  const items = await fetchTrendingHashtags(parsed.data.limit ?? EXPLORE_TRENDING_HASHTAGS_LIMIT)

  return NextResponse.json({ items })
}
