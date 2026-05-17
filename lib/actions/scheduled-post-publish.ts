/**
 * 予約投稿の公開バッチ処理（cron/手動実行用）
 *
 * @module lib/actions/scheduled-post-publish
 */

'use server'

import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import { SCHEDULED_POST_STATUS } from '@/lib/constants/status'
import { ERR_AUTH_ERROR } from '@/lib/constants/errors'
import { getCronSecret } from '@/lib/env'
import { actionSuccess, actionError } from '@/lib/actions/utils'
import type { ActionResult } from '@/types/action-result'

/**
 * 公開時刻を過ぎた pending の予約投稿を Post として公開する。
 * 並列で transaction を実行し、失敗したものは status=failed に更新する。
 *
 * @param cronSecret - 環境変数 CRON_SECRET との一致を検証するトークン
 */
export async function publishScheduledPosts(
  cronSecret?: string,
): Promise<ActionResult<{ published: number; failed: number }>> {
  const expectedSecret = getCronSecret()
  if (expectedSecret && cronSecret !== expectedSecret) {
    return actionError(ERR_AUTH_ERROR)
  }

  const now = new Date()

  const scheduledPosts = await prisma.scheduledPost.findMany({
    where: {
      status: SCHEDULED_POST_STATUS.PENDING,
      scheduledAt: { lte: now },
    },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      genres: true,
    },
  })

  const results = await Promise.allSettled(
    scheduledPosts.map(async (scheduled) => {
      return prisma.$transaction(async (tx) => {
        const post = await tx.post.create({
          data: {
            userId: scheduled.userId,
            content: scheduled.content,
            media: scheduled.media.length > 0 ? {
              create: scheduled.media.map((m: typeof scheduled.media[number]) => ({
                url: m.url,
                type: m.type,
                sortOrder: m.sortOrder,
              })),
            } : undefined,
            genres: scheduled.genres.length > 0 ? {
              create: scheduled.genres.map((g: typeof scheduled.genres[number]) => ({
                genreId: g.genreId,
              })),
            } : undefined,
          },
        })

        await tx.scheduledPost.update({
          where: { id: scheduled.id },
          data: {
            status: SCHEDULED_POST_STATUS.PUBLISHED,
            publishedPostId: post.id,
          },
        })

        return post.id
      })
    }),
  )

  let publishedCount = 0
  let failedCount = 0

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const scheduled = scheduledPosts[i]
    if (!result || !scheduled) continue
    if (result.status === 'fulfilled') {
      publishedCount++
    } else {
      logger.error(`Failed to publish scheduled post ${scheduled.id}:`, result.reason)
      try {
        await prisma.scheduledPost.update({
          where: { id: scheduled.id },
          data: { status: SCHEDULED_POST_STATUS.FAILED },
        })
      } catch (updateError) {
        logger.error(`Failed to mark scheduled post ${scheduled.id} as failed:`, updateError)
      }
      failedCount++
    }
  }

  return actionSuccess({ published: publishedCount, failed: failedCount })
}
