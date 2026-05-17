/**
 * 古いイベントを削除するCronジョブ
 *
 * 終了日から6ヶ月経過したイベントをデータベースから削除します。
 * Vercel Cron Jobsにより毎月1日0時(JST)に自動実行されます。
 *
 * @module app/api/cron/cleanup-events
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { EVENT_RETENTION_MONTHS } from '@/lib/constants/limits'
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

    // 終了日がnullの場合は開始日を使用
    // 終了日または開始日が6ヶ月以上前のイベントを削除
    const result = await prisma.event.deleteMany({
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
    })

    logger.info(`[Cron] Deleted ${result.count} old events`)

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      cutoffDate: sixMonthsAgo.toISOString(),
    })
  } catch (error) {
    logger.error('[Cron] Event cleanup error:', error)
    return NextResponse.json(
      { error: API_ERR_INTERNAL_SERVER_ERROR },
      { status: 500 }
    )
  }
}
