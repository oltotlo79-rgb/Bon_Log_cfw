/**
 * メンション機能のServer Actions
 *
 * @module lib/actions/mention
 */

'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/actions/utils'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { createNotificationsBulk } from '@/lib/services/notification-bulk'
import logger from '@/lib/logger'
import { MENTION_ANALYSIS_LIMIT, MENTION_SEARCH_LIMIT, MAX_MENTION_FOLLOWERS_FETCH, RECENT_MENTIONED_USERS_LIMIT } from '@/lib/constants/limits'
import { extractMentionIds } from '@/lib/mention-utils'

/**
 * メンション候補ユーザーを検索する（オートコンプリート用）。
 * フォロー中ユーザーを優先表示し、ゲストアカウントと自分は候補から除外する。
 *
 * 認証エラーや DB 障害時は `[]` を返す。autocomplete UI はサジェスト失敗を
 * 致命的に扱う必要がないため意図的にサイレントにフォールバックさせる。
 *
 * @param query - 検索クエリ（空文字なら「フォロー中のみ」モード）
 * @param limit - 取得件数（デフォルト: MENTION_SEARCH_LIMIT）
 * @returns 候補ユーザー配列（isFollowing フラグ付き）
 */
export async function searchMentionUsers(query: string, limit: number = MENTION_SEARCH_LIMIT) {
  const auth = await requireAuth()
  if ('error' in auth) return []
  const userId = auth.userId

  try {
    const followingIds = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
      take: MAX_MENTION_FOLLOWERS_FETCH,
    })
    const followingIdSet = new Set(
      followingIds.map((f: typeof followingIds[number]) => f.followingId),
    )

    const isEmptyQuery = !query || query.length === 0

    const users = await prisma.user.findMany({
      where: {
        ...(isEmptyQuery
          ? { id: { in: [...followingIdSet] } }
          : {
              OR: [
                { nickname: { contains: query, mode: 'insensitive' } },
                { email: { startsWith: query, mode: 'insensitive' } },
              ],
            }),
        isSuspended: false,
        id: { not: userId },
        email: { not: GUEST_EMAIL },
      },
      select: USER_MINIMAL_SELECT,
      take: limit,
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
 * 投稿本文中の `<@userId>` 形式のメンションを抽出し、対象ユーザーへ通知する。
 *
 * Why createNotificationsBulk: 直接 `prisma.notification.create` を叩くと
 * ブロック関係チェック・通知設定（mention=false 設定）・重複防止・プッシュ通知送信が
 * 抜け落ちる（CLAUDE.md ルール6）。失敗しても投稿作成はブロックしない。
 */
export async function notifyMentionedUsers(
  postId: string,
  content: string | null,
  authorId: string
) {
  if (!content) return

  const mentionedUserIds = extractMentionIds(content)
  if (mentionedUserIds.length === 0) return

  try {
    const users = await prisma.user.findMany({
      where: {
        id: { in: mentionedUserIds },
        isSuspended: false,
        NOT: { id: authorId },
      },
      select: { id: true },
    })

    if (users.length > 0) {
      await createNotificationsBulk({
        recipientIds: users.map((user) => user.id),
        actorId: authorId,
        type: 'mention',
        postId,
      })
    }
  } catch (error) {
    logger.error('Notify mentioned users error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

type MentionUser = {
  id: string
  nickname: string
  avatarUrl: string | null
}

/**
 * ユーザーID 配列から表示用の最小ユーザー情報を解決する。
 * 投稿表示時に `<@userId>` を `@nickname` 表示へ置換するために使用。
 */
export async function resolveMentionUsers(
  userIds: string[],
): Promise<Map<string, MentionUser>> {
  if (!userIds || userIds.length === 0) return new Map()

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, isSuspended: false },
      select: USER_MINIMAL_SELECT,
    })
    return new Map(users.map((u: MentionUser) => [u.id, u]))
  } catch (error) {
    logger.error('Resolve mention users error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return new Map()
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
