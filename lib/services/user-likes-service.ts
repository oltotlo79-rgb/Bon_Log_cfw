/**
 * @module lib/services/user-likes-service
 * ユーザーがいいねした投稿一覧取得のドメインロジック。
 *
 * `fetchLikedPostsCore` は `lib/actions/like.ts` の `getLikedPosts`（Web）と、
 * mobile 専用の `fetchLikedPosts`（本モジュール）の双方から呼ばれるクエリ・整形の共通部分。
 * `getLikedPosts` は既存 Web 経路の挙動（対象ユーザー自身の可視性チェックをしない）を
 * 変更しないため、そのチェックとリポスト状態解決は `fetchLikedPostsCore` には含めず、
 * mobile 専用の `fetchLikedPosts`側でのみ追加する。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { getPostInteractionSets } from '@/lib/actions/utils'
import { POST_LIST_INCLUDE, formatPostForClient } from '@/lib/actions/post-include'
import { canViewAuthorContent, visiblePostWhere } from '@/lib/services/post-visibility'
import { normalizeCursorPagination } from '@/lib/actions/pagination'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import type { Post } from '@/types/post'

export type LikedPostsResult = {
  posts: Post[]
  nextCursor: string | undefined
}

export type UserLikedPostsResult =
  | { ok: true; posts: Post[]; nextCursor: string | undefined }
  | { ok: false; reason: 'not_found' | 'private_account' }

/**
 * 対象ユーザーがいいねした投稿一覧のクエリ・整形コア。
 * いいね先の投稿は viewer から見える範囲（非表示/非公開著者/停止著者を除外）に絞る。
 * isLiked / isBookmarked は viewer 基準で解決する（対象ユーザー基準ではない）。
 */
export async function fetchLikedPostsCore(
  targetUserId: string,
  viewerId: string | undefined,
  cursor?: string,
  limit?: number,
): Promise<LikedPostsResult> {
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  const likes = await prisma.like.findMany({
    where: {
      userId: targetUserId,
      postId: { not: null },
      commentId: null,
      post: visiblePostWhere(viewerId),
    },
    include: {
      post: { include: POST_LIST_INCLUDE },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: safeLimit,
    ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
  })

  type LikeType = (typeof likes)[number]
  type ValidLikeType = LikeType & { post: NonNullable<LikeType['post']> }

  const validLikes = likes.filter((like: LikeType): like is ValidLikeType => Boolean(like.post))
  const postIds = validLikes.map((like: ValidLikeType) => like.post.id)

  const { likedSet, bookmarkedSet } =
    viewerId && postIds.length > 0
      ? await getPostInteractionSets(viewerId, postIds)
      : { likedSet: new Set<string>(), bookmarkedSet: new Set<string>() }

  const posts = validLikes.map((like: ValidLikeType) =>
    formatPostForClient(like.post, likedSet, bookmarkedSet),
  )

  const hasMore = likes.length === safeLimit

  return {
    posts,
    nextCursor: hasMore ? likes[likes.length - 1]?.id : undefined,
  }
}

/**
 * mobile API (`GET /api/v1/users/{id}/likes`) 用。
 * 対象ユーザー自身の可視性チェック（存在しない/ゲスト → not_found、非公開かつ非フォロワー →
 * private_account）を行った上で、リポスト状態（isReposted）も解決していいね済み投稿一覧を返す。
 */
export async function fetchLikedPosts(
  targetUserId: string,
  viewerId: string | undefined,
  cursor?: string,
  limit?: number,
): Promise<UserLikedPostsResult> {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { isPublic: true, isSuspended: true, email: true },
  })

  if (!targetUser) return { ok: false, reason: 'not_found' }
  if (targetUser.email === GUEST_EMAIL) return { ok: false, reason: 'not_found' }

  const canView = await canViewAuthorContent(viewerId, targetUserId, targetUser)
  if (!canView) {
    // 非公開アカウントで閲覧権限がない場合は 403 相当、それ以外（停止ユーザー等）は 404 相当
    if (!targetUser.isPublic && viewerId !== targetUserId) {
      return { ok: false, reason: 'private_account' }
    }
    return { ok: false, reason: 'not_found' }
  }

  const { posts, nextCursor } = await fetchLikedPostsCore(targetUserId, viewerId, cursor, limit)

  // リポスト状態は 1 クエリで解決（N+1 防止）。Web 経路の既存挙動を変えないため
  // fetchLikedPostsCore には含めず、mobile 専用のここで追加する。
  const postIds = posts.map((p) => p.id)
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

  const postsWithReposted =
    repostedSet.size > 0
      ? posts.map((p) => ({ ...p, isReposted: repostedSet.has(p.id) }))
      : posts

  return { ok: true, posts: postsWithReposted, nextCursor }
}
