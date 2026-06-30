/**
 * @module app/api/v1/search/hashtags
 * GET /api/v1/search/hashtags — ハッシュタグ候補検索（ゲスト可・オートコンプリート）
 *
 * count > 0 のハッシュタグを name 部分一致で人気順（count DESC）に返す。
 * 認証は必須（ゲストトークンでも呼び出し可）。レート制限: search（60/分）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { searchHashtagsQuerySchema } from '@/lib/api/v1/schemas/request'
import { searchHashtags } from '@/lib/actions/hashtag'
import { DEFAULT_HASHTAG_LIMIT } from '@/lib/constants/limits'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = searchHashtagsQuerySchema.safeParse({
    q: searchParams.get('q') ?? '',
    limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'search')
  if (!rl.success) return apiRateLimited(rl)

  // 4. ハッシュタグ検索
  const hashtags = await searchHashtags(
    parsed.data.q,
    parsed.data.limit ?? DEFAULT_HASHTAG_LIMIT,
  )

  return NextResponse.json({
    items: hashtags.map((h) => ({ id: h.id, name: h.name, count: h.count })),
  })
}
