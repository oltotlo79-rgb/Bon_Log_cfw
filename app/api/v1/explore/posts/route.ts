/**
 * @module app/api/v1/explore/posts
 * GET /api/v1/explore/posts — ハッシュタグ or ジャンル別投稿一覧（ゲスト可）
 *
 * hashtag と genreId はどちらか一方のみ指定可能（両方 or 両方未指定は 400）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { z } from 'zod'
import { MAX_PAGE_LIMIT, MAX_HASHTAG_QUERY_LENGTH } from '@/lib/constants/limits'
import { fetchPostsByHashtag, fetchPostsByGenre } from '@/lib/services/explore-posts-service'
import { attachMentionedUsers } from '@/lib/api/v1/mention-resolver'
import { resolveBlockMuteStates } from '@/lib/api/v1/follow-state-resolver'

const querySchema = z.object({
  hashtag: z.string().min(1).max(MAX_HASHTAG_QUERY_LENGTH).optional(),
  genreId: z.string().min(1).max(64).optional(),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
})

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = querySchema.safeParse({
    hashtag: searchParams.get('hashtag') ?? undefined,
    genreId: searchParams.get('genreId') ?? undefined,
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  const { hashtag, genreId, cursor, limit } = parsed.data

  // hashtag と genreId はどちらか一方のみ（排他制約）
  const hasHashtag = hashtag !== undefined
  const hasGenreId = genreId !== undefined
  if (hasHashtag === hasGenreId) {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 投稿取得
  const result = hasHashtag
    ? await fetchPostsByHashtag(hashtag, auth.userId, cursor, limit)
    : await fetchPostsByGenre(genreId!, auth.userId, cursor, limit)

  // 5. mentionedUsers を一括解決して付加（N+1 防止）
  const postsWithMentions = await attachMentionedUsers(result.posts)

  // 6. トップレベル投稿者の Block/Mute 状態をバッチ解決して付加
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
