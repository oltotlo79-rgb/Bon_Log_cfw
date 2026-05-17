import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendSubscriptionExpiringEmail, sendSubscriptionExpiredEmail } from '@/lib/email'
import { verifyCronAuth } from '@/lib/cron-auth'
import { API_ERR_UNAUTHORIZED, API_ERR_INTERNAL_SERVER_ERROR } from '@/lib/constants/errors'
import { SUBSCRIPTION_EXPIRY_WARNING_DAYS, ONE_DAY_MS } from '@/lib/constants/limits'
import { SCHEDULED_POST_STATUS } from '@/lib/constants/status'
import { logger } from '@/lib/logger'
import { createSystemNotificationsBulk } from '@/lib/services/notification-bulk'

// Vercel Cron Job用 - サブスクリプション期限切れチェック
// cron: 0 0 * * * (毎日0時に実行)

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

    // 期限切れのプレミアム会員を取得
    const expiredUsers = await prisma.user.findMany({
      where: {
        isPremium: true,
        premiumExpiresAt: { lt: now },
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        premiumExpiresAt: true,
      },
    })

    if (expiredUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired subscriptions found',
        processedCount: 0,
      })
    }

    // プレミアムステータスをリセット
    const result = await prisma.user.updateMany({
      where: {
        id: { in: expiredUsers.map((u: typeof expiredUsers[number]) => u.id) },
      },
      data: {
        isPremium: false,
        // stripeCustomerIdとstripeSubscriptionIdは保持（再購読用）
      },
    })

    // 期限切れユーザーの予約投稿をキャンセル（pending状態のもののみ）
    const cancelledPosts = await prisma.scheduledPost.updateMany({
      where: {
        userId: { in: expiredUsers.map((u: typeof expiredUsers[number]) => u.id) },
        status: SCHEDULED_POST_STATUS.PENDING,
      },
      data: {
        status: SCHEDULED_POST_STATUS.CANCELLED,
      },
    })

    // 期限切れユーザーにメール通知を送信
    const emailResults = await Promise.allSettled(
      expiredUsers.map((user: typeof expiredUsers[number]) =>
        sendSubscriptionExpiredEmail(user.email, user.nickname)
      )
    )

    const emailsSent = emailResults.filter(
      (r: PromiseSettledResult<{ success: boolean }>): r is PromiseFulfilledResult<{ success: boolean }> => r.status === 'fulfilled' && r.value.success
    ).length
    const emailsFailed = emailResults.filter(
      (r: PromiseSettledResult<{ success: boolean }>) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    ).length

    logger.info(
      `Subscription check: ${result.count} users expired, ${cancelledPosts.count} scheduled posts cancelled, ${emailsSent} emails sent, ${emailsFailed} emails failed`
    )

    return NextResponse.json({
      success: true,
      message: `Processed ${result.count} expired subscriptions`,
      processedCount: result.count,
      cancelledPostsCount: cancelledPosts.count,
      emailsSent,
      emailsFailed,
    })
  } catch (error) {
    logger.error('Cron job error (check-subscriptions):', error)
    return NextResponse.json(
      { success: false, error: API_ERR_INTERNAL_SERVER_ERROR },
      { status: 500 }
    )
  }
}

// 期限切れ間近の通知（オプション）
export async function POST(request: NextRequest) {
  // HMAC署名ベースの認証
  const authHeader = request.headers.get('authorization')
  const timestampHeader = request.headers.get('x-cron-timestamp')

  const authResult = verifyCronAuth(authHeader, timestampHeader, request.nextUrl.pathname)
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error || API_ERR_UNAUTHORIZED }, { status: 401 })
  }

  try {
    const now = new Date()
    const threeDaysLater = new Date(now.getTime() + SUBSCRIPTION_EXPIRY_WARNING_DAYS * ONE_DAY_MS)

    // 3日以内に期限切れになるユーザーを取得
    const expiringUsers = await prisma.user.findMany({
      where: {
        isPremium: true,
        premiumExpiresAt: {
          gt: now,
          lte: threeDaysLater,
        },
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        premiumExpiresAt: true,
      },
    })

    // where 条件で gt/lte を指定済みのため premiumExpiresAt は実質 NOT NULL だが、
    // TypeScript 側にはその情報が伝わらないため flatMap で null/undefined を弾いて型を絞り込む。
    const emailTargets = expiringUsers.flatMap((user: typeof expiringUsers[number]) =>
      user.premiumExpiresAt
        ? [{ email: user.email, nickname: user.nickname, premiumExpiresAt: user.premiumExpiresAt }]
        : [],
    )
    const emailResults = await Promise.allSettled(
      emailTargets.map((u: { email: string; nickname: string; premiumExpiresAt: Date }) =>
        sendSubscriptionExpiringEmail(u.email, u.nickname, u.premiumExpiresAt),
      ),
    )

    const emailsSent = emailResults.filter(
      (r: PromiseSettledResult<{ success: boolean }>): r is PromiseFulfilledResult<{ success: boolean }> => r.status === 'fulfilled' && r.value.success
    ).length
    const emailsFailed = emailResults.filter(
      (r: PromiseSettledResult<{ success: boolean }>) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    ).length

    // アプリ内通知を作成（期限切れ3日前に1回のみ）
    // 重複を避けるため、既存通知を一括チェック
    const userIds = expiringUsers.map((u: typeof expiringUsers[number]) => u.id)
    const existingNotifications = await prisma.notification.findMany({
      where: {
        userId: { in: userIds },
        type: 'subscription_expiring',
        createdAt: { gte: new Date(Date.now() - ONE_DAY_MS) }, // 過去24時間以内
      },
      select: { userId: true },
    })

    const alreadyNotifiedUserIds = new Set(
      existingNotifications.map((n: { userId: string }) => n.userId)
    )
    const usersToNotify = expiringUsers.filter(
      (u: typeof expiringUsers[number]) => !alreadyNotifiedUserIds.has(u.id)
    )

    if (usersToNotify.length > 0) {
      try {
        await createSystemNotificationsBulk({
          recipientIds: usersToNotify.map((u: typeof expiringUsers[number]) => u.id),
          type: 'subscription_expiring',
          skipPushNotification: true,
        })
      } catch (err: unknown) {
        logger.error('Failed to create in-app notifications:', err)
      }
    }

    logger.info(
      `Subscription warning: ${expiringUsers.length} users expiring within 3 days, ${emailsSent} emails sent, ${emailsFailed} emails failed`
    )

    return NextResponse.json({
      success: true,
      message: `Found ${expiringUsers.length} users with expiring subscriptions`,
      expiringCount: expiringUsers.length,
      emailsSent,
      emailsFailed,
    })
  } catch (error) {
    logger.error('Cron job error (check-subscriptions warning):', error)
    return NextResponse.json(
      { success: false, error: API_ERR_INTERNAL_SERVER_ERROR },
      { status: 500 }
    )
  }
}

// Vercel Cron設定
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // CRON_FUNCTION_TIMEOUT_SECONDS と同値
