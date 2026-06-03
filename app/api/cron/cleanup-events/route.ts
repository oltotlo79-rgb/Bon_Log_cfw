/**
 * 古いデータを削除する定期 Cron ジョブ。
 *
 * 1) 終了日から 6 ヶ月経過したイベント (`events`)
 * 2) 処理から 30 日経過した Webhook 冪等性レコード (`webhook_events`)
 * 3) 有効期限切れのメール確認 / パスワードリセットトークン (発行時に同一 email 分しか
 *    deleteMany しないため、未消費の失効トークンが蓄積する。これを定期回収する)
 *
 * Vercel Cron Jobs により毎月 1 日 0 時 (JST) に自動実行される。
 *
 * @module app/api/cron/cleanup-events
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  EVENT_RETENTION_MONTHS,
  WEBHOOK_EVENT_RETENTION_DAYS,
  ONE_DAY_MS,
} from '@/lib/constants/limits'
import { verifyCronAuth } from '@/lib/cron-auth'
import { API_ERR_UNAUTHORIZED, API_ERR_INTERNAL_SERVER_ERROR } from '@/lib/constants/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/cleanup-events
 *
 * 終了日から6ヶ月以上経過したイベントを削除
 */
export async function GET(request: NextRequest) {
  // 認証チェック（HMAC署名 + タイミング攻撃対策）
  const authResult = verifyCronAuth(
    request.headers.get('authorization'),
    request.headers.get('x-cron-timestamp'),
    request.nextUrl.pathname
  )
  if (!authResult.valid) {
    return NextResponse.json(
      { error: authResult.error || API_ERR_UNAUTHORIZED },
      { status: 401 }
    )
  }

  try {
    // 6ヶ月前の日付を計算
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - EVENT_RETENTION_MONTHS)

    // Webhook 冪等性レコード保持の cutoff (今日から 30 日前)
    const webhookCutoff = new Date(Date.now() - WEBHOOK_EVENT_RETENTION_DAYS * ONE_DAY_MS)

    // 失効トークンの cutoff (現在時刻。expires < now を削除)
    const now = new Date()

    // 終了日がnullの場合は開始日を使用
    // 終了日または開始日が6ヶ月以上前のイベントを削除
    // 各処理は独立しているので Promise.all で並列実行し、片方が落ちても他方は返せるようにする。
    const [eventResult, webhookResult, emailTokenResult, passwordTokenResult] = await Promise.all([
      prisma.event.deleteMany({
        where: {
          OR: [
            // 終了日がある場合：終了日が6ヶ月以上前
            {
              endDate: {
                not: null,
                lt: sixMonthsAgo,
              },
            },
            // 終了日がない場合：開始日が6ヶ月以上前
            {
              endDate: null,
              startDate: {
                lt: sixMonthsAgo,
              },
            },
          ],
        },
      }),
      prisma.webhookEvent.deleteMany({
        where: { processedAt: { lt: webhookCutoff } },
      }),
      prisma.emailVerificationToken.deleteMany({
        where: { expires: { lt: now } },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { expires: { lt: now } },
      }),
    ])

    const expiredTokensDeleted = emailTokenResult.count + passwordTokenResult.count

    logger.info(
      `[Cron] Deleted ${eventResult.count} old events, ${webhookResult.count} old webhook events, ${expiredTokensDeleted} expired tokens`,
    )

    return NextResponse.json({
      success: true,
      deletedCount: eventResult.count,
      cutoffDate: sixMonthsAgo.toISOString(),
      webhookDeletedCount: webhookResult.count,
      webhookCutoffDate: webhookCutoff.toISOString(),
      expiredTokensDeleted,
    })
  } catch (error) {
    logger.error('[Cron] Event cleanup error:', error)
    return NextResponse.json(
      { error: API_ERR_INTERNAL_SERVER_ERROR },
      { status: 500 }
    )
  }
}
