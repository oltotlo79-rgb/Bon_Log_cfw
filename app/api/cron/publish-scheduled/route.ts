import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyCronAuth } from '@/lib/cron-auth'
import { CRON_BATCH_SIZE, CRON_FUNCTION_TIMEOUT_SECONDS } from '@/lib/constants/limits'

// Next.js のルートセグメント設定 `maxDuration` は静的解析されるためリテラル値必須。
// 下の `maxDuration = 60` と `CRON_FUNCTION_TIMEOUT_SECONDS` の値が乖離した場合、
// この型代入がコンパイル時に失敗し CI で検出できる。
const _ASSERT_CRON_TIMEOUT_MATCHES: typeof CRON_FUNCTION_TIMEOUT_SECONDS = 60
void _ASSERT_CRON_TIMEOUT_MATCHES
import { SCHEDULED_POST_STATUS } from '@/lib/constants/status'
import { API_ERR_UNAUTHORIZED, API_ERR_INTERNAL_SERVER_ERROR } from '@/lib/constants/errors'
import { logger } from '@/lib/logger'

type TransactionClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// Vercel Cron Job用 - 予約投稿の自動公開
// cron: */5 * * * * (5分ごとに実行)

export async function GET(request: NextRequest) {
  // HMAC署名ベースの認証
  const authHeader = request.headers.get('authorization')
  const timestampHeader = request.headers.get('x-cron-timestamp')

  const authResult = verifyCronAuth(authHeader, timestampHeader, request.nextUrl.pathname)
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error || API_ERR_UNAUTHORIZED }, { status: 401 })
  }

  try {
    const now = new Date()

    // 公開時刻が過ぎた予約投稿を取得（必要なカラムのみ）
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
      return NextResponse.json({
        success: true,
        message: 'No scheduled posts to publish',
        publishedCount: 0,
      })
    }

    let publishedCount = 0
    let failedCount = 0

    for (const scheduledPost of scheduledPosts) {
      try {
        // ユーザーが有効かチェック
        if (!scheduledPost.user || scheduledPost.user.isSuspended) {
          await prisma.scheduledPost.update({
            where: { id: scheduledPost.id },
            data: { status: SCHEDULED_POST_STATUS.FAILED },
          })
          failedCount++
          logger.warn(`Scheduled post ${scheduledPost.id}: User suspended or not found`)
          continue
        }

        // トランザクションで投稿作成と予約投稿の更新を行う
        await prisma.$transaction(async (tx: TransactionClient) => {
          // 投稿を作成
          const post = await tx.post.create({
            data: {
              userId: scheduledPost.userId,
              content: scheduledPost.content,
            },
          })

          // メディアを作成
          if (scheduledPost.media.length > 0) {
            await tx.postMedia.createMany({
              data: scheduledPost.media.map((m: typeof scheduledPost.media[number]) => ({
                postId: post.id,
                url: m.url,
                type: m.type,
                sortOrder: m.sortOrder,
              })),
            })
          }

          // ジャンルを作成
          if (scheduledPost.genres.length > 0) {
            await tx.postGenre.createMany({
              data: scheduledPost.genres.map((g: typeof scheduledPost.genres[number]) => ({
                postId: post.id,
                genreId: g.genreId,
              })),
            })
          }

          // 予約投稿のステータスを更新
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
        // 個別の投稿エラーをログして続行
        logger.error(`Failed to publish scheduled post ${scheduledPost.id}:`, error)
        failedCount++

        // ステータスを失敗に更新
        await prisma.scheduledPost.update({
          where: { id: scheduledPost.id },
          data: { status: SCHEDULED_POST_STATUS.FAILED },
        }).catch(() => {
          // 更新失敗は無視
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Published ${publishedCount} scheduled posts`,
      publishedCount,
      failedCount,
    })
  } catch (error) {
    logger.error('Cron job error (publish-scheduled):', error)
    return NextResponse.json(
      { success: false, error: API_ERR_INTERNAL_SERVER_ERROR },
      { status: 500 }
    )
  }
}

// Vercel Cron設定
export const dynamic = 'force-dynamic'
/**
 * Vercel Function のタイムアウト（秒）。
 *
 * Next.js はルートセグメント設定 (`maxDuration`) をビルド時に静的解析するため、
 * 定数識別子を直接バインドできない。リテラル値でエクスポートし、実値と
 * `CRON_FUNCTION_TIMEOUT_SECONDS` の一致はファイル冒頭の型アサーションで保証する。
 */
export const maxDuration = 60
