/**
 * コメント通知サービス
 *
 * コメント作成時の通知送信ロジックを提供する。
 * createComment() から抽出した通知ロジック。
 * 通知送信の失敗はコメント作成を妨げない（fire-and-forget）。
 *
 * @module lib/services/comment-notifications
 */

import 'server-only'

import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import { createNotification } from '@/lib/services/notification-core'
import { createNotificationsBulk } from '@/lib/services/notification-bulk'
import { COMMENT_THREAD_MAX_DEPTH } from '@/lib/constants/limits'

/**
 * コメント作成時に関係するユーザーへ通知を送信する。
 *
 * - parentId あり（返信）: スレッド参加者全員に reply 通知
 * - parentId なし（新規コメント）: 投稿オーナーに comment 通知
 *
 * @param postId - コメント対象の投稿ID
 * @param commentId - 作成されたコメントID
 * @param actorId - コメントを書いたユーザーID
 * @param parentId - 親コメントID（返信の場合）
 */
export async function notifyCommentParticipants(
  postId: string,
  commentId: string,
  actorId: string,
  parentId: string | null | undefined,
): Promise<void> {
  if (parentId) {
    // Notify all thread participants via recursive CTE
    const participantIds = new Set<string>()
    let rootCommentId: string = parentId

    const ancestors = await prisma.$queryRaw<{ id: string; user_id: string; parent_id: string | null }[]>`
      WITH RECURSIVE ancestors AS (
        SELECT id, user_id, parent_id, 0 AS depth FROM comments WHERE id = ${parentId}
        UNION ALL
        SELECT c.id, c.user_id, c.parent_id, a.depth + 1 FROM comments c
        INNER JOIN ancestors a ON c.id = a.parent_id
        WHERE a.depth < ${COMMENT_THREAD_MAX_DEPTH}
      )
      SELECT id, user_id, parent_id FROM ancestors LIMIT 100
    `.catch((err: unknown) => {
      logger.error('Failed to fetch comment ancestors via CTE - falling back to empty list', {
        parentId,
        postId,
        error: err instanceof Error ? err.message : String(err),
      })
      return [] as { id: string; user_id: string; parent_id: string | null }[]
    })

    for (const ancestor of ancestors) {
      participantIds.add(ancestor.user_id)
      if (!ancestor.parent_id) {
        rootCommentId = ancestor.id
      }
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    })
    if (post) {
      participantIds.add(post.userId)
    }

    participantIds.delete(actorId)

    const mutedUsers = await prisma.commentThreadMute.findMany({
      where: {
        commentId: rootCommentId,
        userId: { in: Array.from(participantIds) },
      },
      select: { userId: true },
    })
    const mutedUserIds = new Set(mutedUsers.map((m) => m.userId))
    const candidateIds = Array.from(participantIds).filter((id) => !mutedUserIds.has(id))

    if (candidateIds.length > 0) {
      // ブロック・通知設定のフィルタは createNotificationsBulk が一括処理する
      await createNotificationsBulk({
        recipientIds: candidateIds,
        actorId,
        type: 'reply',
        postId,
        commentId,
      })
    }
  } else {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    })

    if (post && post.userId !== actorId) {
      // createNotification がブロック・通知設定・重複チェックを担当する
      const result = await createNotification({
        userId: post.userId,
        actorId,
        type: 'comment',
        postId,
        commentId,
      })
      if (!result.success) {
        logger.error('Comment notification creation failed', {
          postId,
          commentId,
          error: result.error,
        })
      }
    }
  }
}
