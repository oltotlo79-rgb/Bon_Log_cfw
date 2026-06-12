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

import { auth } from '@/lib/auth'
import logger from '@/lib/logger'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getClientIp, actionSuccess, actionError } from '@/lib/actions/utils'
import type { ActionResult } from '@/types/action-result'
import { DEFAULT_PAGE_LIMIT, MAX_SEARCH_QUERY_LENGTH } from '@/lib/constants/limits'
import { ERR_SEARCH_QUERY_TOO_LONG, ERR_SEARCH_RATE_LIMIT, ERR_OPERATION_FAILED } from '@/lib/constants/errors'
import { fetchSearchUsers } from '@/lib/services/search-service'

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

    const result = await fetchSearchUsers(query, currentUserId, cursor, limit)
    return actionSuccess(result)
  } catch (error) {
    logger.error('searchUsers failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}
