/**
 * @module lib/services/comment-read-service
 * コメント一覧取得のクエリ・整形ロジック。
 *
 * lib/actions/comment.ts の getComments と app/api/v1/posts/[id]/comments の
 * 双方から呼ばれる。認証・レート制限は呼び出し元が担う前提。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { assertCanViewPost } from '@/lib/services/post-visibility'
import { getBlockedUserIds } from '@/lib/actions/filter-helper'
import { buildCursorPagination, normalizeCursorPagination } from '@/lib/actions/pagination'

export type CommentItem = {
  id: string
  postId: string
  userId: string
  parentId: string | null
  content: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  isHidden: boolean
  isDeleted: boolean
  isBlockedUser: boolean
  likeCount: number
  replyCount: number
  isLiked: boolean
  user: { id: string; nickname: string; avatarUrl: string | null }
  media: { id: string; url: string; type: string; sortOrder: number }[]
}

export type CommentsResult = {
  comments: CommentItem[]
  nextCursor: string | undefined
}

/**
 * 投稿のトップレベルコメント一覧を返す。
 * 表示不可な投稿（非表示/非公開/停止著者）は空を返す。
 * ブロックユーザーのコメントは isBlockedUser フラグを立てる。
 */
export async function fetchComments(
  postId: string,
  viewerId: string | undefined,
  cursor?: string,
  limit?: number,
): Promise<CommentsResult> {
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  if (!(await assertCanViewPost(viewerId, postId))) {
    return { comments: [], nextCursor: undefined }
  }

  const blockedUserIds: string[] = viewerId ? await getBlockedUserIds(viewerId) : []

  const comments = await prisma.comment.findMany({
    where: {
      postId,
      parentId: null,
      isHidden: false,
    },
    include: {
      user: { select: USER_MINIMAL_SELECT },
      media: { orderBy: { sortOrder: 'asc' } },
      _count: {
        select: { likes: true, replies: { where: { deletedAt: null } } },
      },
      ...(viewerId
        ? {
            likes: {
              where: { userId: viewerId },
              select: { id: true },
            },
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...buildCursorPagination(safeCursor, safeLimit),
  })

  const likedCommentIds = new Set(
    viewerId ? comments.filter((c) => c.likes && c.likes.length > 0).map((c) => c.id) : [],
  )

  const hasMore = comments.length === safeLimit

  return {
    comments: comments
      .filter((c) => c.deletedAt === null || c._count.replies > 0)
      .map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        userId: comment.userId,
        parentId: comment.parentId,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        deletedAt: comment.deletedAt,
        isHidden: comment.isHidden,
        isDeleted: comment.deletedAt !== null,
        isBlockedUser: blockedUserIds.includes(comment.userId),
        likeCount: comment._count.likes,
        replyCount: comment._count.replies,
        isLiked: likedCommentIds.has(comment.id),
        user: comment.user,
        media: (comment.media ?? []).map((m) => ({
          id: m.id,
          url: m.url,
          type: m.type,
          sortOrder: m.sortOrder,
        })),
      })),
    nextCursor: hasMore ? comments[comments.length - 1]?.id : undefined,
  }
}
