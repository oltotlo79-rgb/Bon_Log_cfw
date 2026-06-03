/**
 * メンション機能のServer Actions
 *
 * @module lib/actions/mention
 *
 * Returns custom shape (`User[]` plain) instead of `ActionResult<T>` because
 * autocomplete UI treats empty array as a non-fatal fallback (CLAUDE.md ルール例外)。
 */

'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, enforceUserRateLimit } from '@/lib/actions/utils'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import logger from '@/lib/logger'
import { MENTION_ANALYSIS_LIMIT, MENTION_SEARCH_LIMIT, MAX_MENTION_SEARCH_QUERY_LENGTH, MAX_MENTION_FOLLOWERS_FETCH, RECENT_MENTIONED_USERS_LIMIT } from '@/lib/constants/limits'
import { extractMentionIds } from '@/lib/mention-utils'
import { visibleUserWhere } from '@/lib/services/post-visibility'

const mentionSearchSchema = z.object({
  query: z.string().max(MAX_MENTION_SEARCH_QUERY_LENGTH),
  limit: z.number().int().positive().max(MENTION_SEARCH_LIMIT).catch(MENTION_SEARCH_LIMIT),
})

/**
 * メンション候補ユーザーを検索する（オートコンプリート用）。
 * フォロー中ユーザーを優先表示し、ゲストアカウントと自分は候補から除外する。
 *
 * 公開範囲は {@link visibleUserWhere} に従い、公開ユーザー・本人・フォロー中の
 * 非公開ユーザーのみを候補にする。email はアカウント存在の推測を招くため検索対象にしない。
 *
 * 認証エラー・入力過大・レート超過・DB 障害時は `[]` を返す。autocomplete UI は
 * サジェスト失敗を致命的に扱う必要がないため意図的にサイレントにフォールバックさせる。
 *
 * @param query - 検索クエリ（空文字なら「フォロー中のみ」モード）
 * @param limit - 取得件数（デフォルト: MENTION_SEARCH_LIMIT、上限で clamp）
 * @returns 候補ユーザー配列（isFollowing フラグ付き）
 */
export async function searchMentionUsers(query: string, limit: number = MENTION_SEARCH_LIMIT) {
  const auth = await requireAuth()
  if ('error' in auth) return []
  const userId = auth.userId

  const parsed = mentionSearchSchema.safeParse({ query, limit })
  if (!parsed.success) return []
  const { query: safeQuery, limit: safeLimit } = parsed.data

  const rl = await enforceUserRateLimit(userId, 'mention_search')
  if (rl) return []

  try {
    const followingIds = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
      take: MAX_MENTION_FOLLOWERS_FETCH,
    })
    const followingIdSet = new Set(
      followingIds.map((f: typeof followingIds[number]) => f.followingId),
    )

    const isEmptyQuery = safeQuery.length === 0

    const users = await prisma.user.findMany({
      where: {
        ...visibleUserWhere(userId),
        email: { not: GUEST_EMAIL },
        // id 条件が複数あるためキー衝突を避けて AND で合成する
        AND: [
          { id: { not: userId } },
          isEmptyQuery
            ? { id: { in: [...followingIdSet] } }
            : { nickname: { contains: safeQuery, mode: 'insensitive' } },
        ],
      },
      select: USER_MINIMAL_SELECT,
      take: safeLimit,
    })

    return users
      .map((user: typeof users[number]) => ({
        ...user,
        isFollowing: followingIdSet.has(user.id),
      }))
      .sort((a, b) => {
        if (a.isFollowing && !b.isFollowing) return -1
        if (!a.isFollowing && b.isFollowing) return 1
        return 0
      })
  } catch (error) {
    logger.error('Search mention users error', { error: error instanceof Error ? error.message : String(error) })
    return []
  }
}

/**
 * 自分の直近投稿からメンションしたユーザーを取得する。
 * 入力時のクイックアクセス UI で利用。
 *
 * Why insertion-order Set: 最も最近メンションした順を保ったまま重複除去するため、
 * push 後に Set 化するのではなく Set に直接 add する（Set は挿入順を維持する）。
 */
export async function getRecentMentionedUsers(
  limit: number = RECENT_MENTIONED_USERS_LIMIT,
) {
  const auth = await requireAuth()
  if ('error' in auth) return []
  const userId = auth.userId

  try {
    const recentPosts = await prisma.post.findMany({
      where: { userId, content: { not: null } },
      select: { content: true },
      orderBy: { createdAt: 'desc' },
      take: MENTION_ANALYSIS_LIMIT,
    })

    const mentionedUserIds = new Set<string>()
    for (const { content } of recentPosts) {
      if (!content) continue
      for (const id of extractMentionIds(content)) mentionedUserIds.add(id)
    }

    const uniqueUserIds = [...mentionedUserIds].slice(0, limit)
    if (uniqueUserIds.length === 0) return []

    return await prisma.user.findMany({
      where: { id: { in: uniqueUserIds }, isSuspended: false },
      select: USER_MINIMAL_SELECT,
    })
  } catch (error) {
    logger.error('Get recent mentioned users error', { error: error instanceof Error ? error.message : String(error) })
    return []
  }
}
