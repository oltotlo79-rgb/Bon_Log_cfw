/**
 * ユーザー検索の Server Action
 *
 * Client Component（`UserSearchResults` 等）から RPC で呼ばれるため `'use server'` を付与する。
 * CLAUDE.md ルール2 に従い戻り値は `ActionResult<T>` に統一する。
 *
 * 認証は不要（ブロック・ゲスト除外のみセッションがあれば反映）。
 * レート制限は IP ベースで search 用バケットを共用する。
 *
 * @module lib/actions/search-users
 */

'use server'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { auth } from '@/lib/auth'
import logger from '@/lib/logger'
import { fulltextSearchUsers, getSearchMode } from '@/lib/search/fulltext'
import { getExcludedUserIds } from './filter-helper'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getClientIp, getGuestUserId, actionSuccess, actionError } from '@/lib/actions/utils'
import type { ActionResult } from '@/types/action-result'
import { DEFAULT_PAGE_LIMIT, MAX_SEARCH_QUERY_LENGTH } from '@/lib/constants/limits'
import { ERR_SEARCH_QUERY_TOO_LONG, ERR_SEARCH_RATE_LIMIT, ERR_OPERATION_FAILED } from '@/lib/constants/errors'
import { preserveOrder } from '@/lib/utils/preserve-order'
import { normalizeCursorPagination } from './pagination'
import { containsInsensitive } from '@/lib/actions/prisma-filters'
import { visibleUserWhere } from '@/lib/services/post-visibility'

export type SearchUserResult = {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
  followersCount: number
  followingCount: number
}

export type SearchUsersData = {
  users: SearchUserResult[]
  nextCursor: string | undefined
}

/**
 * ユーザーをキーワードで検索（nickname / bio を対象）。
 * ブロック関係ユーザー・ゲスト・自分自身は除外。
 */
export async function searchUsers(
  query: string,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<ActionResult<SearchUsersData>> {
  if (query && query.length > MAX_SEARCH_QUERY_LENGTH) {
    return actionError(ERR_SEARCH_QUERY_TOO_LONG)
  }

  const clientIp = await getClientIp()
  const rateLimitResult = await rateLimit(`search:${clientIp}`, RATE_LIMITS.search)
  if (!rateLimitResult.success) {
    return actionError(ERR_SEARCH_RATE_LIMIT)
  }

  try {
    const session = await auth()
    const currentUserId = session?.user?.id

    // クライアント境界から渡される cursor/limit を MAX_PAGE_LIMIT で clamp し DB 過負荷を防ぐ
    const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

    // ミュートは検索結果から除外しない（フォロー状態は維持される）
    const excludedUserIds = currentUserId
      ? await getExcludedUserIds(currentUserId, { blocked: true, blockedBy: true })
      : []

    const guestUserId = await getGuestUserId()
    const excludedUserIdsWithGuest = [...excludedUserIds, ...(guestUserId ? [guestUserId] : [])]

    const searchMode = getSearchMode()

    const userSelect = {
      ...USER_MINIMAL_WITH_BIO_SELECT,
      _count: { select: { followers: true, following: true } },
    } as const

    if (query && (searchMode === 'bigm' || searchMode === 'trgm')) {
      const userIds = await fulltextSearchUsers(query, {
        excludedUserIds: excludedUserIdsWithGuest,
        currentUserId,
        cursor: safeCursor,
        limit: safeLimit,
      })

      if (userIds.length === 0) {
        return actionSuccess({ users: [], nextCursor: undefined })
      }

      // fulltext で得た ID にも公開条件を防御的に再適用する（非公開/停止ユーザーの露出を防ぐ）
      const fetchedUsers = await prisma.user.findMany({
        where: { id: { in: userIds }, ...visibleUserWhere(currentUserId) },
        select: userSelect,
      })

      const users = preserveOrder(userIds, fetchedUsers)

      return actionSuccess({
        users: users.map((user: typeof users[number]) => ({
          id: user.id,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          followersCount: user._count.followers,
          followingCount: user._count.following,
        })),
        nextCursor: users.length === safeLimit ? users[users.length - 1]?.id : undefined,
      })
    }

    const users = await prisma.user.findMany({
      where: {
        ...visibleUserWhere(currentUserId),
        AND: [
          query
            ? {
                OR: [
                  { nickname: containsInsensitive(query) },
                  { bio: containsInsensitive(query) },
                ],
              }
            : {},
          excludedUserIdsWithGuest.length > 0 ? { id: { notIn: excludedUserIdsWithGuest } } : {},
          currentUserId ? { id: { not: currentUserId } } : {},
        ],
      },
      select: userSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit,
      ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
    })

    return actionSuccess({
      users: users.map((user: typeof users[number]) => ({
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        followersCount: user._count.followers,
        followingCount: user._count.following,
      })),
      nextCursor: users.length === safeLimit ? users[users.length - 1]?.id : undefined,
    })
  } catch (error) {
    logger.error('searchUsers failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}
