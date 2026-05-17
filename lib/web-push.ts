/**
 * Web Push通知ユーティリティ
 *
 * web-pushライブラリを使用してVAPID認証のプッシュ通知を送信する。
 * 環境変数 NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY で設定。
 *
 * @module lib/web-push
 */

import webPush, { WebPushError } from 'web-push'
import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import { PUSH_NOTIFICATION_TTL_SECONDS, PUSH_SEND_CONCURRENCY, PUSH_ENDPOINT_LOG_PREVIEW_LENGTH } from '@/lib/constants/limits'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@bon-log.com'

let isConfigured = false

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  isConfigured = true
}

export interface PushPayload {
  title: string
  body: string
  tag?: string
  data?: {
    url?: string
    [key: string]: unknown
  }
}

/**
 * 指定ユーザーの全デバイスにプッシュ通知を送信する。
 * 無効な購読（410/404）は自動削除される。
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!isConfigured) {
    logger.warn('Web Push not configured: VAPID keys missing')
    return { sent: 0, failed: 0 }
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 }
  }

  const payloadString = JSON.stringify(payload)
  let sent = 0
  let failed = 0
  const expiredIds: string[] = []

  // 並列送信（PUSH_SEND_CONCURRENCY で制限）
  const chunks = []
  for (let i = 0; i < subscriptions.length; i += PUSH_SEND_CONCURRENCY) {
    chunks.push(subscriptions.slice(i, i + PUSH_SEND_CONCURRENCY))
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map((sub) =>
        webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadString,
          { TTL: PUSH_NOTIFICATION_TTL_SECONDS }
        )
      )
    )

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        sent++
      } else {
        failed++
        const target = chunk[index]
        if (!target) return
        // `web-push` は upstream HTTP エラー時に `WebPushError` を throw する (`statusCode` あり)。
        // SDK の型定義から WebPushError を import して instanceof で narrowing する。
        const statusCode = result.reason instanceof WebPushError ? result.reason.statusCode : undefined
        // 410 Gone / 404 Not Found → 購読が無効化されたため削除
        if (statusCode === 410 || statusCode === 404) {
          expiredIds.push(target.id)
        } else {
          logger.error('Push notification failed', {
            userId,
            endpoint: target.endpoint.substring(0, PUSH_ENDPOINT_LOG_PREVIEW_LENGTH),
            statusCode,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          })
        }
      }
    })
  }

  // 無効な購読を一括削除
  if (expiredIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: expiredIds } },
    })
    logger.info(`Deleted ${expiredIds.length} expired push subscriptions for user ${userId}`)
  }

  return { sent, failed }
}

/**
 * VAPID公開鍵を返す（クライアントの購読登録に必要）。
 */
export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC_KEY || null
}
