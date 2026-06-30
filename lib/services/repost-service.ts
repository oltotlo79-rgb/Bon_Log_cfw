/**
 * @module lib/services/repost-service
 * リポスト追加・削除のドメインロジック（v1 API 用）。
 *
 * app/api/v1/posts/[id]/repost から呼ばれる。
 * 認証・レート制限は呼び出し元が担う前提。
 * 自己リポスト禁止チェックは呼び出し元が行う。
 */

import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/services/notification-core'
import { assertCanViewPost } from '@/lib/services/post-visibility'
import { checkDailyPostLimit } from '@/lib/actions/utils'
import logger from '@/lib/logger'
import {
  ERR_POST_NOT_FOUND,
  ERR_REPOST_FAILED,
} from '@/lib/constants/errors'

import { ERR_SELF_ACTION } from '@/lib/constants/errors'

export type RepostOperationResult =
  | { ok: true; reposted: boolean; repostCount: number }
  | { ok: false; error: string; status: 400 | 403 | 404 | 429 | 500 }

/**
 * 対象投稿をリポストする（冪等: 既にリポスト済みなら成功を返す）。
 *
 * - 自己リポストは 400 VALIDATION_ERROR
 * - 日次投稿上限をリポストにも適用する（Web 側と同様）
 */
export async function addRepost(
  postId: string,
  userId: string,
): Promise<RepostOperationResult> {
  // 自己リポスト禁止（投稿主の確認と閲覧権限確認を兼ねて投稿を取得）
  const targetPost = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true },
  })
  if (!targetPost) {
    return { ok: false, error: ERR_POST_NOT_FOUND, status: 404 }
  }
  if (targetPost.userId === userId) {
    return { ok: false, error: ERR_SELF_ACTION, status: 400 }
  }

  // 閲覧権限チェック（非表示・非公開・停止著者は対象外）
  if (!(await assertCanViewPost(userId, postId))) {
    return { ok: false, error: ERR_POST_NOT_FOUND, status: 404 }
  }

  // 日次上限チェック（リポストも投稿カウントに含める）
  const dailyLimitError = await checkDailyPostLimit(userId)
  if (dailyLimitError && !dailyLimitError.success) {
    return { ok: false, error: dailyLimitError.error, status: 429 }
  }

  try {
    const txResult = await prisma.$transaction(async (tx) => {
      const dup = await tx.post.findFirst({
        where: { userId, repostPostId: postId },
        select: { id: true },
      })
      if (dup) return { duplicate: true as const }

      const target = await tx.post.findUnique({
        where: { id: postId },
        select: { userId: true },
      })
      if (!target) return { notFound: true as const }

      await tx.post.create({ data: { userId, repostPostId: postId } })
      return { targetUserId: target.userId, duplicate: false as const }
    })

    if ('notFound' in txResult) {
      return { ok: false, error: ERR_POST_NOT_FOUND, status: 404 }
    }

    if (!txResult.duplicate && txResult.targetUserId !== userId) {
      await createNotification({
        userId: txResult.targetUserId,
        actorId: userId,
        type: 'repost',
        postId,
      })
    }

    const repostCount = await prisma.post.count({ where: { repostPostId: postId } })
    return { ok: true, reposted: true, repostCount }
  } catch (error) {
    // @@unique([userId, repostPostId]) 違反は並行リクエストによる二重リポスト → 冪等 ON 扱い
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const repostCount = await prisma.post.count({ where: { repostPostId: postId } })
      return { ok: true, reposted: true, repostCount }
    }
    logger.error('addRepost failed', {
      userId,
      postId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_REPOST_FAILED, status: 500 }
  }
}

/**
 * リポストを解除する（冪等: 存在しなければ成功を返す）。
 */
export async function removeRepost(
  postId: string,
  userId: string,
): Promise<RepostOperationResult> {
  // 元投稿の存在確認
  const target = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true },
  })
  if (!target) {
    return { ok: false, error: ERR_POST_NOT_FOUND, status: 404 }
  }

  try {
    await prisma.post.deleteMany({
      where: { userId, repostPostId: postId },
    })

    const repostCount = await prisma.post.count({ where: { repostPostId: postId } })
    return { ok: true, reposted: false, repostCount }
  } catch (error) {
    logger.error('removeRepost failed', {
      userId,
      postId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_REPOST_FAILED, status: 500 }
  }
}
