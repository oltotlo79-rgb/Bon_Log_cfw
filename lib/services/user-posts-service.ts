/**
 * @module lib/services/user-posts-service
 * ユーザーの投稿一覧取得のドメインロジック。
 *
 * app/api/v1/users/[id]/posts から呼ばれる。
 * 認証・レート制限は呼び出し元が担う前提。
 * 非公開アカウントへのアクセス制御は canViewAuthorContent に委譲する。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { getPostInteractionSets } from '@/lib/actions/utils'
import {
  POST_LIST_INCLUDE,
  POST_QUOTE_INCLUDE,
  POST_REPOST_INCLUDE,
  buildPostPollInclude,
  formatPostForClient,
} from '@/lib/actions/post-include'
import {
  canViewAuthorContent,
  redactNonVisibleNestedPosts,
} from '@/lib/services/post-visibility'
import { normalizeCursorPagination } from '@/lib/actions/pagination'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import type { Post } from '@/types/post'

export type UserPostsResult =
  | {
      ok: true
      posts: Post[]
      nextCursor: string | undefined
    }
  | { ok: false; reason: 'not_found' | 'private_account' }

/**
 * 指定ユーザーの投稿一覧を取得する。
 *
 * - 非公開アカウントかつ viewerId がフォロワーでない場合は reason: 'private_account'
 * - ゲストアカウント・存在しないユーザーは reason: 'not_found'
 * - 本人（isSelf）は非公開投稿を含む全投稿を取得する
 */
export async function fetchUserPosts(
  targetUserId: string,
  viewerId: string | undefined,
  cursor?: string,
  limit?: number,
): Promise<UserPostsResult> {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { isPublic: true, isSuspended: true, email: true },
  })

  if (!targetUser) return { ok: false, reason: 'not_found' }
  if (targetUser.email === GUEST_EMAIL) return { ok: false, reason: 'not_found' }

  const canView = await canViewAuthorContent(viewerId, targetUserId, {
    isPublic: targetUser.isPublic,
    isSuspended: targetUser.isSuspended,
  })

  if (!canView) {
    // 非公開アカウントで閲覧権限がない場合は 403 相当
    if (!targetUser.isPublic && viewerId !== targetUserId) {
      return { ok: false, reason: 'private_account' }
    }
    return { ok: false, reason: 'not_found' }
  }

  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  const rawPosts = await prisma.post.findMany({
    where: {
      userId: targetUserId,
      isHidden: false,
    },
    include: {
      ...POST_LIST_INCLUDE,
      quotePost: { include: POST_QUOTE_INCLUDE },
      repostPost: { include: POST_REPOST_INCLUDE },
      poll: { include: buildPostPollInclude(viewerId) },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: safeLimit,
    ...(safeCursor ? { cursor: { id: safeCursor }, skip: 1 } : {}),
  })

  const nextCursor = rawPosts.length === safeLimit ? rawPosts[rawPosts.length - 1]?.id : undefined

  const posts = await redactNonVisibleNestedPosts(viewerId, rawPosts)
  const postIds = posts.map((p) => p.id)

  // viewerId がいない場合はインタラクション状態はすべて false
  const { likedSet, bookmarkedSet } =
    viewerId && postIds.length > 0
      ? await getPostInteractionSets(viewerId, postIds)
      : { likedSet: new Set<string>(), bookmarkedSet: new Set<string>() }

  // リポスト状態を 1 クエリで解決（N+1 防止）
  let repostedSet = new Set<string>()
  if (viewerId && postIds.length > 0) {
    const repostedRows = await prisma.post.findMany({
      where: { userId: viewerId, repostPostId: { in: postIds } },
      select: { repostPostId: true },
    })
    repostedSet = new Set(
      repostedRows
        .map((r) => r.repostPostId)
        .filter((id): id is string => id !== null),
    )
  }

  return {
    ok: true,
    posts: posts.map((post) =>
      formatPostForClient(post, likedSet, bookmarkedSet, repostedSet),
    ),
    nextCursor,
  }
}
