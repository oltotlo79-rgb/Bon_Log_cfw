/**
 * @module lib/services/scheduled-post-publisher
 *
 * 予約投稿の自動公開コアロジック。
 *
 * Why services 層: `'use server'` を付けると Next.js がこのモジュールの全 export を
 * クライアントから呼び出し可能な RPC エンドポイントとして公開してしまう。
 * このロジックは cron Route Handler 専用であり、任意クライアントからの到達を
 * 防ぐため `'use server'` を付けずに services 層に置く。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { SCHEDULED_POST_STATUS } from '@/lib/constants/status'
import { CRON_BATCH_SIZE } from '@/lib/constants/limits'

export interface PublishResult {
  publishedCount: number
  failedCount: number
}

/**
 * 公開時刻を過ぎた pending の予約投稿を Post として公開する。
 *
 * - take: CRON_BATCH_SIZE で 1 実行あたりの上限を設ける（無制限スキャン防止）
 * - isSuspended のユーザーの予約投稿は FAILED に変更して skip する
 * - $transaction で投稿作成・ステータス更新をアトミックに行う
 * - 個別の投稿エラーは握りつぶさず FAILED に更新し、全体を止めない
 */
export async function publishDueScheduledPosts(): Promise<PublishResult> {
  const now = new Date()

  const scheduledPosts = await prisma.scheduledPost.findMany({
    where: {
      status: SCHEDULED_POST_STATUS.PENDING,
      scheduledAt: { lte: now },
    },
    select: {
      id: true,
      userId: true,
      content: true,
      user: { select: { id: true, isSuspended: true } },
      media: {
        select: { url: true, type: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
      genres: { select: { genreId: true } },
    },
    take: CRON_BATCH_SIZE,
  })

  if (scheduledPosts.length === 0) {
    return { publishedCount: 0, failedCount: 0 }
  }

  let publishedCount = 0
  let failedCount = 0

  for (const scheduledPost of scheduledPosts) {
    try {
      if (!scheduledPost.user || scheduledPost.user.isSuspended) {
        await prisma.scheduledPost.update({
          where: { id: scheduledPost.id },
          data: { status: SCHEDULED_POST_STATUS.FAILED },
        })
        failedCount++
        logger.warn(`Scheduled post ${scheduledPost.id}: User suspended or not found`)
        continue
      }

      await prisma.$transaction(async (tx) => {
        const post = await tx.post.create({
          data: {
            userId: scheduledPost.userId,
            content: scheduledPost.content,
          },
        })

        if (scheduledPost.media.length > 0) {
          await tx.postMedia.createMany({
            data: scheduledPost.media.map((m) => ({
              postId: post.id,
              url: m.url,
              type: m.type,
              sortOrder: m.sortOrder,
            })),
          })
        }

        if (scheduledPost.genres.length > 0) {
          await tx.postGenre.createMany({
            data: scheduledPost.genres.map((g) => ({
              postId: post.id,
              genreId: g.genreId,
            })),
          })
        }

        await tx.scheduledPost.update({
          where: { id: scheduledPost.id },
          data: {
            status: SCHEDULED_POST_STATUS.PUBLISHED,
            publishedPostId: post.id,
          },
        })
      })

      publishedCount++
    } catch (error) {
      logger.error(`Failed to publish scheduled post ${scheduledPost.id}:`, error)
      failedCount++

      await prisma.scheduledPost.update({
        where: { id: scheduledPost.id },
        data: { status: SCHEDULED_POST_STATUS.FAILED },
      }).catch(() => {
        // ステータス更新失敗は次回バッチで再試行させる
      })
    }
  }

  return { publishedCount, failedCount }
}
