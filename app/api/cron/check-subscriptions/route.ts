import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendSubscriptionExpiringEmail, sendSubscriptionExpiredEmail } from '@/lib/email'
import { verifyCronAuth } from '@/lib/cron-auth'
import { API_ERR_UNAUTHORIZED, API_ERR_INTERNAL_SERVER_ERROR } from '@/lib/constants/errors'
import { SUBSCRIPTION_EXPIRY_WARNING_DAYS, ONE_DAY_MS, SUBSCRIPTION_EMAIL_BATCH_SIZE } from '@/lib/constants/limits'
import { SCHEDULED_POST_STATUS } from '@/lib/constants/status'
import { logger } from '@/lib/logger'
import { createSystemNotificationsBulk } from '@/lib/services/notification-bulk'

// Vercel Cron Job用 - サブスクリプション期限切れチェック
// cron: 0 1 * * * (毎日 1 時に実行)

function countEmailResults(results: PromiseSettledResult<{ success: boolean }>[]): {
  sent: number
  failed: number
} {
  const sent = results.filter(
    (r): r is PromiseFulfilledResult<{ success: boolean }> =>
      r.status === 'fulfilled' && r.value.success
  ).length
  return { sent, failed: results.length - sent }
}

/**
 * メール送信をバッチに分割して実行する。プレミアム会員が大規模化しても全件を一度に
 * fan-out せず、Resend のレート制限・メモリスパイクを避ける。
 */
async function sendEmailsInBatches<T>(
  items: readonly T[],
  send: (item: T) => Promise<{ success: boolean }>
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0
  for (let i = 0; i < items.length; i += SUBSCRIPTION_EMAIL_BATCH_SIZE) {
    const chunk = items.slice(i, i + SUBSCRIPTION_EMAIL_BATCH_SIZE)
    const results = await Promise.allSettled(chunk.map(send))
    const counted = countEmailResults(results)
    sent += counted.sent
    failed += counted.failed
  }
  return { sent, failed }
}

/** 期限切れプレミアムを失効させ、予約投稿をキャンセルし、失効メールを送る。 */
async function processExpiredSubscriptions(now: Date): Promise<{
  expiredCount: number
  cancelledPostsCount: number
  emailsSent: number
  emailsFailed: number
}> {
  const expiredUsers = await prisma.user.findMany({
    where: { isPremium: true, premiumExpiresAt: { lt: now } },
    select: { id: true, email: true, nickname: true, premiumExpiresAt: true },
  })

  if (expiredUsers.length === 0) {
    return { expiredCount: 0, cancelledPostsCount: 0, emailsSent: 0, emailsFailed: 0 }
  }

  const userIds = expiredUsers.map((u) => u.id)

  // プレミアムステータスをリセット（stripe ID は再購読用に保持）
  const result = await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { isPremium: false },
  })

  // 期限切れユーザーの pending 予約投稿をキャンセル
  const cancelledPosts = await prisma.scheduledPost.updateMany({
    where: { userId: { in: userIds }, status: SCHEDULED_POST_STATUS.PENDING },
    data: { status: SCHEDULED_POST_STATUS.CANCELLED },
  })

  const { sent, failed } = await sendEmailsInBatches(expiredUsers, (user) =>
    sendSubscriptionExpiredEmail(user.email, user.nickname)
  )

  return {
    expiredCount: result.count,
    cancelledPostsCount: cancelledPosts.count,
    emailsSent: sent,
    emailsFailed: failed,
  }
}

/** 期限切れ間近（既定 3 日以内）のユーザーに事前警告メール + アプリ内通知を送る。 */
async function sendExpiryWarnings(now: Date): Promise<{
  expiringCount: number
  emailsSent: number
  emailsFailed: number
}> {
  const threeDaysLater = new Date(now.getTime() + SUBSCRIPTION_EXPIRY_WARNING_DAYS * ONE_DAY_MS)

  const expiringUsers = await prisma.user.findMany({
    where: {
      isPremium: true,
      premiumExpiresAt: { gt: now, lte: threeDaysLater },
    },
    select: { id: true, email: true, nickname: true, premiumExpiresAt: true },
  })

  // where で gt/lte 指定済みのため premiumExpiresAt は実質 NOT NULL だが、
  // 型情報が伝わらないため flatMap で null/undefined を弾いて絞り込む。
  const emailTargets = expiringUsers.flatMap((user) =>
    user.premiumExpiresAt
      ? [{ email: user.email, nickname: user.nickname, premiumExpiresAt: user.premiumExpiresAt }]
      : []
  )
  const { sent, failed } = await sendEmailsInBatches(emailTargets, (u) =>
    sendSubscriptionExpiringEmail(u.email, u.nickname, u.premiumExpiresAt)
  )

  // アプリ内通知（過去24時間に同種通知が無いユーザーのみ＝1日1回に制限）
  const userIds = expiringUsers.map((u) => u.id)
  const existingNotifications = await prisma.notification.findMany({
    where: {
      userId: { in: userIds },
      type: 'subscription_expiring',
      createdAt: { gte: new Date(now.getTime() - ONE_DAY_MS) },
    },
    select: { userId: true },
  })
  const alreadyNotifiedUserIds = new Set(existingNotifications.map((n) => n.userId))
  const usersToNotify = expiringUsers.filter((u) => !alreadyNotifiedUserIds.has(u.id))

  if (usersToNotify.length > 0) {
    try {
      await createSystemNotificationsBulk({
        recipientIds: usersToNotify.map((u) => u.id),
        type: 'subscription_expiring',
        skipPushNotification: true,
      })
    } catch (err: unknown) {
      logger.error('Failed to create in-app notifications:', err)
    }
  }

  return { expiringCount: expiringUsers.length, emailsSent: sent, emailsFailed: failed }
}

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

    // Vercel Cron は GET のみ起動するため、失効処理と「期限間近の事前警告」を
    // 同一ジョブで実行する（警告を POST 専用にすると cron から発火されず予告なし解約になる）。
    const expired = await processExpiredSubscriptions(now)
    const warnings = await sendExpiryWarnings(now)

    logger.info(
      `Subscription check: ${expired.expiredCount} expired, ${expired.cancelledPostsCount} scheduled posts cancelled, ${warnings.expiringCount} expiring-soon warned`
    )

    return NextResponse.json({
      success: true,
      message: `Processed ${expired.expiredCount} expired subscriptions, warned ${warnings.expiringCount} expiring`,
      processedCount: expired.expiredCount,
      cancelledPostsCount: expired.cancelledPostsCount,
      emailsSent: expired.emailsSent,
      emailsFailed: expired.emailsFailed,
      expiringCount: warnings.expiringCount,
      warningEmailsSent: warnings.emailsSent,
      warningEmailsFailed: warnings.emailsFailed,
    })
  } catch (error) {
    logger.error('Cron job error (check-subscriptions):', error)
    return NextResponse.json(
      { success: false, error: API_ERR_INTERNAL_SERVER_ERROR },
      { status: 500 }
    )
  }
}

// 期限切れ間近の警告のみを単独実行する手動/外部トリガー用エンドポイント
export async function POST(request: NextRequest) {
  // HMAC署名ベースの認証
  const authHeader = request.headers.get('authorization')
  const timestampHeader = request.headers.get('x-cron-timestamp')

  const authResult = verifyCronAuth(authHeader, timestampHeader, request.nextUrl.pathname)
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error || API_ERR_UNAUTHORIZED }, { status: 401 })
  }

  try {
    const warnings = await sendExpiryWarnings(new Date())

    logger.info(
      `Subscription warning: ${warnings.expiringCount} users expiring within 3 days, ${warnings.emailsSent} emails sent, ${warnings.emailsFailed} emails failed`
    )

    return NextResponse.json({
      success: true,
      message: `Found ${warnings.expiringCount} users with expiring subscriptions`,
      expiringCount: warnings.expiringCount,
      emailsSent: warnings.emailsSent,
      emailsFailed: warnings.emailsFailed,
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
