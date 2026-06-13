/**
 * @module lib/services/like-service
 * 投稿いいねのプリミティブ操作。
 *
 * lib/actions/like.ts の togglePostLike と app/api/v1/posts/[id]/like の
 * 双方から呼ばれる。認証・レート制限は呼び出し元が担う前提。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { createNotification, deleteNotification } from '@/lib/services/notification-core'
import { recordLikeReceivedService } from '@/lib/services/analytics-recording'
import { canViewPostByAuthor } from '@/lib/services/post-visibility'
import logger from '@/lib/logger'

export type LikePostResult =
  | { found: false }
  | { found: true; liked: boolean; likeCount: number }

/**
 * 投稿にいいねを付与する。
 * 既にいいね済みの場合は no-op として liked:true を返す（冪等）。
 * 不存在・不可視の投稿は found:false を返す。
 */
export async function addPostLike(
  postId: string,
  userId: string,
): Promise<LikePostResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true, isHidden: true },
  })

  if (!post || post.isHidden || !(await canViewPostByAuthor(userId, post.userId))) {
    return { found: false }
  }

  const isNew = await prisma.$transaction(async (tx) => {
    const existingLike = await tx.like.findFirst({
      where: { postId, userId, commentId: null },
    })
    if (!existingLike) {
      await tx.like.create({ data: { postId, userId } })
      return true
    }
    return false
  })

  const likeCount = await prisma.like.count({ where: { postId, commentId: null } })

  // 通知・analytics は新規いいね時のみ発火（冪等再送で二重計上しない）
  if (isNew && post.userId !== userId) {
    void createNotification({
      userId: post.userId,
      actorId: userId,
      type: 'like',
      postId,
    }).catch((err) => {
      logger.error('createNotification (like) failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
    void recordLikeReceivedService(post.userId).catch((err) => {
      logger.error('recordLikeReceived failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  return { found: true, liked: true, likeCount }
}

/**
 * 投稿のいいねを解除する。
 * いいねしていない場合は no-op として liked:false を返す（冪等）。
 * 不存在・不可視の投稿は found:false を返す。
 */
export async function removePostLike(
  postId: string,
  userId: string,
): Promise<LikePostResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true, isHidden: true },
  })

  if (!post || post.isHidden || !(await canViewPostByAuthor(userId, post.userId))) {
    return { found: false }
  }

  const wasDeleted = await prisma.$transaction(async (tx) => {
    const existingLike = await tx.like.findFirst({
      where: { postId, userId, commentId: null },
    })
    if (existingLike) {
      await tx.like.delete({ where: { id: existingLike.id } })
      return true
    }
    return false
  })

  const likeCount = await prisma.like.count({ where: { postId, commentId: null } })

  // 実際に削除した場合のみ通知を削除する（no-op 再送で発火しない）
  if (wasDeleted && post.userId !== userId) {
    void deleteNotification({
      userId: post.userId,
      actorId: userId,
      type: 'like',
      postId,
    }).catch((err) => {
      logger.error('deleteNotification (like) failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  return { found: true, liked: false, likeCount }
}

/**
 * 投稿のいいね状態をトグルする（Web Action 用）。
 * Web の togglePostLike が委譲する。
 * 不存在・不可視の投稿は found:false を返す。
 */
export async function togglePostLikePrimitive(
  postId: string,
  userId: string,
): Promise<LikePostResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true, isHidden: true },
  })

  if (!post || post.isHidden || !(await canViewPostByAuthor(userId, post.userId))) {
    return { found: false }
  }

  const liked = await prisma.$transaction(async (tx) => {
    const existingLike = await tx.like.findFirst({
      where: { postId, userId, commentId: null },
    })
    if (existingLike) {
      await tx.like.delete({ where: { id: existingLike.id } })
      return false
    }
    await tx.like.create({ data: { postId, userId } })
    return true
  })

  const likeCount = await prisma.like.count({ where: { postId, commentId: null } })

  if (post.userId !== userId) {
    if (liked) {
      void createNotification({
        userId: post.userId,
        actorId: userId,
        type: 'like',
        postId,
      }).catch((err) => {
        logger.error('createNotification (like) failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      })
      void recordLikeReceivedService(post.userId).catch((err) => {
        logger.error('recordLikeReceived failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      })
    } else {
      void deleteNotification({
        userId: post.userId,
        actorId: userId,
        type: 'like',
        postId,
      }).catch((err) => {
        logger.error('deleteNotification (like) failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }
  }

  return { found: true, liked, likeCount }
}
