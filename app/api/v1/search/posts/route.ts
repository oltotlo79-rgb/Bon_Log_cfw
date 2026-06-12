/**
 * @module app/api/v1/search/posts
 * GET /api/v1/search/posts — 投稿キーワード検索
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { searchQuerySchema } from '@/lib/api/v1/schemas/request'
import { fetchSearchPosts } from '@/lib/services/search-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = searchQuerySchema.safeParse({
    q: searchParams.get('q') ?? '',
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'search')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 投稿検索（ブロック・ミュート・非公開著者を除外）
  const result = await fetchSearchPosts(
    parsed.data.q,
    auth.userId,
    undefined,
    parsed.data.cursor,
    parsed.data.limit,
  )

  return NextResponse.json({
    items: result.posts,
    nextCursor: result.nextCursor ?? null,
  })
}
