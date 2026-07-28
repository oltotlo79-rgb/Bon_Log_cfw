/**
 * @module app/api/v1/search/posts
 * GET /api/v1/search/posts — 投稿キーワード検索
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { searchPostsQuerySchema, type SearchPostMediaTypeValue } from '@/lib/api/v1/schemas/request'
import { fetchSearchPosts, type SearchPostFilters } from '@/lib/services/search-service'
import { attachMentionedUsers } from '@/lib/api/v1/mention-resolver'
import { resolveBlockMuteStates } from '@/lib/api/v1/follow-state-resolver'
import type { SearchMediaType } from '@/lib/constants/search-media'

const MEDIA_TYPE_API_TO_SERVICE: Record<SearchPostMediaTypeValue, SearchMediaType> = {
  image: 'images',
  video: 'videos',
  none: 'text',
}

export async function GET(request: NextRequest) {
  // 1. Bearer 認証
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const genreIdsFromQuery = searchParams.getAll('genreIds')
  const parsed = searchPostsQuerySchema.safeParse({
    q: searchParams.get('q') ?? '',
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
    genreId: searchParams.get('genreId') ?? undefined,
    genreIds: genreIdsFromQuery.length > 0 ? genreIdsFromQuery : undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    minLikes: searchParams.has('minLikes') ? Number(searchParams.get('minLikes')) : undefined,
    mediaType: searchParams.get('mediaType') ?? undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'search')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 投稿検索（ブロック・ミュート・非公開著者を除外）
  const { genreId, genreIds, dateFrom, dateTo, minLikes, mediaType } = parsed.data
  // legacy genreId と新規 genreIds は和集合・重複除去して OR-any 条件へ正規化する
  const normalizedGenreIds = Array.from(new Set([...(genreId ? [genreId] : []), ...(genreIds ?? [])]))

  const hasFilter =
    dateFrom !== undefined ||
    dateTo !== undefined ||
    minLikes !== undefined ||
    mediaType !== undefined
  const filters: SearchPostFilters | undefined = hasFilter
    ? {
        dateFrom,
        dateTo,
        minLikes,
        mediaType: mediaType ? MEDIA_TYPE_API_TO_SERVICE[mediaType] : undefined,
      }
    : undefined

  const result = await fetchSearchPosts(
    parsed.data.q,
    auth.userId,
    normalizedGenreIds.length > 0 ? normalizedGenreIds : undefined,
    parsed.data.cursor,
    parsed.data.limit,
    filters,
  )

  // 5. mentionedUsers を一括解決して付加（N+1 防止）
  const postsWithMentions = await attachMentionedUsers(result.posts)

  // 6. トップレベル投稿者の Block/Mute 状態をバッチ解決（2 クエリ）して付加
  const authorIds = postsWithMentions.flatMap((p) => (p.user?.id ? [p.user.id] : []))
  const blockMuteMap = await resolveBlockMuteStates(auth.userId, authorIds)
  const postsWithState = postsWithMentions.map((p) => ({
    ...p,
    user: p.user
      ? {
          ...p.user,
          ...(blockMuteMap.get(p.user.id) ?? { isBlocked: false, isMuted: false }),
        }
      : p.user,
  }))

  return NextResponse.json({
    items: postsWithState,
    nextCursor: result.nextCursor ?? null,
  })
}
