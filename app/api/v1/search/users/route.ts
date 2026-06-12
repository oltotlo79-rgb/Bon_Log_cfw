/**
 * @module app/api/v1/search/users
 * GET /api/v1/search/users — ユーザーキーワード検索
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { searchQuerySchema } from '@/lib/api/v1/schemas/request'
import { fetchSearchUsers } from '@/lib/services/search-service'

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

  // 4. ユーザー検索（ブロック・ゲストを除外）
  const result = await fetchSearchUsers(
    parsed.data.q,
    auth.userId,
    parsed.data.cursor,
    parsed.data.limit,
  )

  return NextResponse.json({
    items: result.users,
    nextCursor: result.nextCursor ?? null,
  })
}
