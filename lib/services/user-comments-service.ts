/**
 * @module lib/services/user-comments-service
 * ユーザーのコメント一覧取得のドメインロジック。
 *
 * app/api/v1/users/[id]/comments から呼ばれる。
 * 認証・レート制限は呼び出し元が担う前提。
 * 非公開アカウントへのアクセス制御は canViewAuthorContent に委譲する
 * (lib/services/user-posts-service.ts の fetchUserPosts と同じ判定方針)。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import {
  canViewAuthorContent,
  visiblePostWhere,
} from '@/lib/services/post-visibility'
import { normalizeCursorPagination, buildCursorPagination } from '@/lib/actions/pagination'
import { GUEST_EMAIL } from '@/lib/constants/guest'

export type UserCommentItem = {
  id: string
  content: string
  createdAt: Date
  post: { id: string; content: string | null }
  media: { id: string; url: string; type: string; sortOrder: number }[]
}

export type UserCommentsResult =
  | {
      ok: true
      items: UserCommentItem[]
      nextCursor: string | undefined
    }
  | { ok: false; reason: 'not_found' | 'private_account' }

/**
 * 指定ユーザーのコメント一覧を取得する。
 *
 * - 非公開アカウントかつ viewerId がフォロワーでない場合は reason: 'private_account'
 * - ゲストアカウント・存在しないユーザーは reason: 'not_found'
 * - 対象コメントが付いた投稿自体が viewer から閲覧不可（非表示/非公開著者の投稿等）な場合は除外する
 */
export async function fetchUserComments(
  targetUserId: string,
  viewerId: string | undefined,
  cursor?: string,
  limit?: number,
): Promise<UserCommentsResult> {
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

  const rows = await prisma.comment.findMany({
    where: {
      userId: targetUserId,
      isHidden: false,
      deletedAt: null,
      post: visiblePostWhere(viewerId),
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      post: { select: { id: true, content: true } },
      media: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...buildCursorPagination(safeCursor, safeLimit),
  })

  const nextCursor = rows.length === safeLimit ? rows[rows.length - 1]?.id : undefined

  return {
    ok: true,
    items: rows.map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: r.createdAt,
      post: { id: r.post.id, content: r.post.content },
      media: r.media.map((m) => ({
        id: m.id,
        url: m.url,
        type: m.type,
        sortOrder: m.sortOrder,
      })),
    })),
    nextCursor,
  }
}
