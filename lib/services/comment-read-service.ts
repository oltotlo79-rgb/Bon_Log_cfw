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
  editedAt: Date | null
  user: { id: string; nickname: string; avatarUrl: string | null }
  media: { id: string; url: string; type: string; sortOrder: number }[]
}

export type CommentsResult = {
  comments: CommentItem[]
  nextCursor: string | undefined
}

/** fetchComments / fetchReplies の findMany 行から CommentItem を組み立てる共通マッパー。 */
type CommentRow = {
  id: string
  postId: string
  userId: string
  parentId: string | null
  content: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  isHidden: boolean
  editedAt: Date | null
  user: { id: string; nickname: string; avatarUrl: string | null }
  media: { id: string; url: string; type: string; sortOrder: number }[] | null
  likes?: { id: string }[]
  _count: { likes: number; replies: number }
}

function formatCommentRow(row: CommentRow, blockedUserIds: string[], likedIds: Set<string>): CommentItem {
  return {
    id: row.id,
    postId: row.postId,
    userId: row.userId,
    parentId: row.parentId,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    isHidden: row.isHidden,
    isDeleted: row.deletedAt !== null,
    isBlockedUser: blockedUserIds.includes(row.userId),
    likeCount: row._count.likes,
    replyCount: row._count.replies,
    isLiked: likedIds.has(row.id),
    editedAt: row.editedAt,
    user: row.user,
    media: (row.media ?? []).map((m) => ({
      id: m.id,
      url: m.url,
      type: m.type,
      sortOrder: m.sortOrder,
    })),
  }
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
      .map((comment) => formatCommentRow(comment, blockedUserIds, likedCommentIds)),
    nextCursor: hasMore ? comments[comments.length - 1]?.id : undefined,
  }
}

/**
 * 親コメントへの返信一覧を作成日時昇順で返す（fetchComments と対称の降順ではない）。
 * 親コメントが非表示/削除済み/閲覧不可（client 申告ではなく実 postId で判定）の場合は空を返す。
 */
export async function fetchReplies(
  parentCommentId: string,
  viewerId: string | undefined,
  cursor?: string,
  limit?: number,
): Promise<CommentsResult> {
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  const parent = await prisma.comment.findUnique({
    where: { id: parentCommentId },
    select: { postId: true, isHidden: true, deletedAt: true },
  })
  if (
    !parent ||
    parent.isHidden ||
    parent.deletedAt ||
    !(await assertCanViewPost(viewerId, parent.postId))
  ) {
    return { comments: [], nextCursor: undefined }
  }

  const blockedUserIds: string[] = viewerId ? await getBlockedUserIds(viewerId) : []

  const replies = await prisma.comment.findMany({
    where: {
      parentId: parentCommentId,
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
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    ...buildCursorPagination(safeCursor, safeLimit),
  })

  const likedReplyIds = new Set(
    viewerId ? replies.filter((r) => r.likes && r.likes.length > 0).map((r) => r.id) : [],
  )

  const hasMore = replies.length === safeLimit

  return {
    comments: replies
      .filter((r) => r.deletedAt === null || r._count.replies > 0)
      .map((reply) => formatCommentRow(reply, blockedUserIds, likedReplyIds)),
    nextCursor: hasMore ? replies[replies.length - 1]?.id : undefined,
  }
}
