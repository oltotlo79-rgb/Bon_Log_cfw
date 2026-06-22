/**
 * RevenueCat Webhook イベント処理のドメインロジック。
 *
 * Route Handler から呼ばれ、イベント種別に応じて User.isPremium /
 * premiumExpiresAt を更新する。送信元検証・冪等性ガードは Route Handler 側で
 * 実施済みの前提で呼び出される。
 *
 * @module lib/services/revenuecat
 */

import 'server-only'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import logger from '@/lib/logger'

/**
 * RevenueCat Webhook ペイロードの Zod スキーマ。
 *
 * 公式仕様 (https://www.revenuecat.com/docs/integrations/webhooks) に準拠。
 * 未知フィールドは passthrough() で受け流し、必要最低限のみ検証することで
 * RevenueCat の後方互換追加フィールドに耐性を持たせる。
 */
export const revenueCatEventSchema = z.object({
  /**
   * RevenueCat が発行するイベント固有の UUID。冪等性キーに使用する。
   * 公式フィールド名: `id`
   */
  id: z.string().min(1),
  /**
   * イベント種別。公式定義値のみ受け付け、それ以外は route handler 側で無視する。
   * 公式フィールド名: `type`
   */
  type: z.string().min(1),
  /**
   * モバイル SDK 初期化時に設定されたアプリユーザー ID。
   * 本プロジェクトでは User.id（cuid）を設定する前提。
   * 公式フィールド名: `app_user_id`
   */
  app_user_id: z.string().min(1),
  /**
   * サブスクリプション有効期限（ミリ秒エポック）。
   * CANCELLATION では null の場合がある。
   * 公式フィールド名: `expiration_at_ms`
   */
  expiration_at_ms: z.number().int().nullable().optional(),
})

export const revenueCatPayloadSchema = z.object({
  /**
   * RevenueCat Webhook ペイロードのトップレベルは `{ event: {...}, api_version: "1.0" }` 形式。
   */
  event: revenueCatEventSchema,
  api_version: z.string().optional(),
})

export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>

/**
 * RevenueCat Webhook の event.type 定数。
 *
 * Why 文字列定数: Zod の z.enum は配列を先に宣言する必要があり、
 * 定数オブジェクトとして export することで呼び出し元でも型安全に参照できる。
 */
export const REVENUECAT_EVENT_TYPES = {
  INITIAL_PURCHASE: 'INITIAL_PURCHASE',
  RENEWAL: 'RENEWAL',
  CANCELLATION: 'CANCELLATION',
  EXPIRATION: 'EXPIRATION',
} as const

export type RevenueCatEventType =
  (typeof REVENUECAT_EVENT_TYPES)[keyof typeof REVENUECAT_EVENT_TYPES]

/**
 * RevenueCat イベントを処理して User テーブルのプレミアム状態を更新する。
 *
 * - INITIAL_PURCHASE / RENEWAL: isPremium=true、premiumExpiresAt 更新
 * - CANCELLATION: 現有効期限まで isPremium=true を維持（即時 false にしない）
 * - EXPIRATION: isPremium=false
 * - その他: 無視して正常終了
 *
 * @returns `{ handled: true }` 処理済み / `{ handled: false }` 無視されたイベント
 */
export async function processRevenueCatEvent(
  event: RevenueCatEvent,
): Promise<{ handled: boolean; userId?: string }> {
  const { type, app_user_id: appUserId, expiration_at_ms: expirationAtMs } = event

  const user = await prisma.user.findUnique({
    where: { id: appUserId },
    select: { id: true },
  })

  if (!user) {
    // 存在しないユーザーへのイベントは再送ループを防ぐため 200 で終了する。
    // ユーザー削除後に RevenueCat から届く可能性があるため警告レベルでログ。
    logger.error('RevenueCat webhook: user not found, ignoring event', {
      eventId: event.id,
      eventType: type,
      appUserId,
    })
    return { handled: true }
  }

  switch (type) {
    case REVENUECAT_EVENT_TYPES.INITIAL_PURCHASE:
    case REVENUECAT_EVENT_TYPES.RENEWAL: {
      const premiumExpiresAt =
        typeof expirationAtMs === 'number' ? new Date(expirationAtMs) : null

      await prisma.user.update({
        where: { id: user.id },
        data: {
          isPremium: true,
          ...(premiumExpiresAt !== null && { premiumExpiresAt }),
        },
      })

      logger.info('RevenueCat: user premium activated', {
        userId: user.id,
        eventType: type,
        premiumExpiresAt,
      })
      return { handled: true, userId: user.id }
    }

    case REVENUECAT_EVENT_TYPES.CANCELLATION: {
      // キャンセルは「次回更新をしない」だけで現在の有効期限まではプレミアムを維持する。
      // isPremium の状態変更は EXPIRATION イベントを待つ。
      logger.info('RevenueCat: subscription cancelled, premium maintained until expiry', {
        userId: user.id,
        expirationAtMs,
      })
      return { handled: true, userId: user.id }
    }

    case REVENUECAT_EVENT_TYPES.EXPIRATION: {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isPremium: false,
          premiumExpiresAt: null,
        },
      })

      logger.info('RevenueCat: user premium expired', { userId: user.id })
      return { handled: true, userId: user.id }
    }

    default: {
      // 既知の未対応イベント（PRODUCT_CHANGE, SUBSCRIBER_ALIAS 等）は安全に無視する。
      logger.info('RevenueCat: unhandled event type, ignoring', {
        eventId: event.id,
        eventType: type,
      })
      return { handled: false }
    }
  }
}
