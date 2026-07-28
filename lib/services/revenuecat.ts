/**
 * RevenueCat Webhook イベント処理のドメインロジック。
 *
 * Route Handler から呼ばれ、`PremiumEntitlement`（provider='revenuecat'）と
 * User aggregate（isPremium / premiumExpiresAt）を更新する。送信元検証・冪等性ガードは
 * Route Handler 側で実施済みの前提で呼び出される。
 *
 * @module lib/services/revenuecat
 */

import 'server-only'
import { z } from 'zod'
import logger from '@/lib/logger'
import {
  applyEntitlementEventAndRecompute,
  type ApplyAndRecomputeResult,
} from '@/lib/services/premium-entitlements'
import { prisma } from '@/lib/db'

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
  /**
   * イベントが RevenueCat 側で発生した時刻（ミリ秒エポック）。
   * out-of-order 到着したイベントを無視するための基準値に使う
   * （PremiumEntitlement.providerEventAt）。
   * 公式フィールド名: `event_timestamp_ms`
   */
  event_timestamp_ms: z.number().int().nullish(),
  /**
   * ストア側の商品 ID（entitlement のメタデータとして保存する）。
   * 公式フィールド名: `product_id`
   */
  product_id: z.string().nullish(),
  /**
   * 元の取引 ID。Stripe の subscription id に相当する provider 側の権利識別子として使う。
   * 公式フィールド名: `original_transaction_id`
   */
  original_transaction_id: z.string().nullish(),
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
 *
 * 権利へ影響しない/させない既知イベント（実装しない理由）:
 * - BILLING_ISSUE: 支払い遅延の通知だが、RevenueCat 側の猶予期間中は購読が有効なまま
 *   継続する。ここで権利を落とすと猶予期間中の正規ユーザーを即座に失効させてしまうため、
 *   明示的に無視する（最終的な失効は EXPIRATION イベントで処理される）。
 * - TRANSFER: 別の app_user_id へ購読を移管するイベント。ペイロードには
 *   `transferred_from`/`transferred_to` が必要だが本スキーマでは未取得のため、
 *   誤ったユーザーへ entitlement を付け替えるリスクを避けて no-op とする
 *   （必要になった場合はスキーマ拡張とセットで実装する）。
 * - PRODUCT_CHANGE / SUBSCRIBER_ALIAS: 権利の有効性そのものには影響しないため無視する。
 * - 返金: RevenueCat は「返金専用」の event type を発行せず、CANCELLATION
 *   （`expiration_at_ms` 到来まで維持）または EXPIRATION（即時失効）として届く。
 *   どちらも下記で処理済みのため追加対応は不要。
 */
export const REVENUECAT_EVENT_TYPES = {
  INITIAL_PURCHASE: 'INITIAL_PURCHASE',
  RENEWAL: 'RENEWAL',
  UNCANCELLATION: 'UNCANCELLATION',
  CANCELLATION: 'CANCELLATION',
  EXPIRATION: 'EXPIRATION',
} as const

export type RevenueCatEventType =
  (typeof REVENUECAT_EVENT_TYPES)[keyof typeof REVENUECAT_EVENT_TYPES]

/**
 * RevenueCat イベントを処理して PremiumEntitlement（provider='revenuecat'）と
 * User aggregate（isPremium / premiumExpiresAt）を更新する。
 *
 * - INITIAL_PURCHASE / RENEWAL / UNCANCELLATION: status='active'、expiresAt 更新
 * - CANCELLATION: 現有効期限まで status='active' を維持（即時 false にしない）。
 *   cancelAtPeriodEnd=true のメタデータのみ記録し、status/expiresAt は変更しない。
 * - EXPIRATION: status='expired'、expiresAt=null
 * - その他: 無視して正常終了
 *
 * @returns `{ handled: true }` 処理済み / `{ handled: false }` 無視されたイベント
 */
export async function processRevenueCatEvent(
  event: RevenueCatEvent,
): Promise<{ handled: boolean; userId?: string }> {
  const {
    type,
    app_user_id: appUserId,
    expiration_at_ms: expirationAtMs,
    event_timestamp_ms: eventTimestampMs,
    product_id: productId,
    original_transaction_id: originalTransactionId,
  } = event

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

  const eventAt = typeof eventTimestampMs === 'number' ? new Date(eventTimestampMs) : null
  const expiresAt = typeof expirationAtMs === 'number' ? new Date(expirationAtMs) : null

  const applyAndLog = async (
    label: string,
    result: Promise<ApplyAndRecomputeResult>,
  ): Promise<void> => {
    const { applied, wasPremiumBefore, isPremiumAfter, premiumExpiresAt } = await result
    logger.info(`RevenueCat: ${label}`, {
      userId: user.id,
      eventType: type,
      applied,
      wasPremiumBefore,
      isPremiumAfter,
      premiumExpiresAt,
    })
  }

  switch (type) {
    case REVENUECAT_EVENT_TYPES.INITIAL_PURCHASE:
    case REVENUECAT_EVENT_TYPES.RENEWAL:
    case REVENUECAT_EVENT_TYPES.UNCANCELLATION: {
      await applyAndLog(
        'user premium activated',
        applyEntitlementEventAndRecompute({
          userId: user.id,
          provider: 'revenuecat',
          providerRef: originalTransactionId ?? undefined,
          productId: productId ?? undefined,
          status: 'active',
          cancelAtPeriodEnd: false,
          expiresAt,
          eventAt,
          eventId: event.id,
        }),
      )
      return { handled: true, userId: user.id }
    }

    case REVENUECAT_EVENT_TYPES.CANCELLATION: {
      // キャンセルは「次回更新をしない」だけで現在の有効期限まではプレミアムを維持する。
      // status/expiresAt は変更せず、cancelAtPeriodEnd フラグのみ記録する
      // （isPremium の状態変更は EXPIRATION イベントを待つ）。
      //
      // 既存 entitlement が無い場合は書き込み対象が無いため no-op にする。
      // applyEntitlementEvent は upsert のため、ここでガードしないと
      // 「一度も購入記録が同期されていないユーザー」に対し status='active'（既定値）の
      // entitlement を新規作成してしまい、キャンセル通知だけで premium を誤って
      // 付与するバグになる（legacy 実装は DB を一切変更しなかったため、この no-op が
      // 既存挙動と等価）。
      const existing = await prisma.premiumEntitlement.findUnique({
        where: { userId_provider: { userId: user.id, provider: 'revenuecat' } },
        select: { id: true },
      })
      if (!existing) {
        logger.info('RevenueCat: cancellation received with no existing entitlement, ignoring', {
          userId: user.id,
          eventId: event.id,
        })
        return { handled: true, userId: user.id }
      }

      await applyAndLog(
        'subscription cancelled, premium maintained until expiry',
        applyEntitlementEventAndRecompute({
          userId: user.id,
          provider: 'revenuecat',
          cancelAtPeriodEnd: true,
          eventAt,
          eventId: event.id,
        }),
      )
      return { handled: true, userId: user.id }
    }

    case REVENUECAT_EVENT_TYPES.EXPIRATION: {
      await applyAndLog(
        'user premium expired',
        applyEntitlementEventAndRecompute({
          userId: user.id,
          provider: 'revenuecat',
          status: 'expired',
          cancelAtPeriodEnd: false,
          expiresAt: null,
          eventAt,
          eventId: event.id,
        }),
      )
      return { handled: true, userId: user.id }
    }

    default: {
      // 既知の未対応イベント（PRODUCT_CHANGE, SUBSCRIBER_ALIAS, BILLING_ISSUE, TRANSFER 等）は
      // 安全に無視する（理由は REVENUECAT_EVENT_TYPES の JSDoc 参照）。
      logger.info('RevenueCat: unhandled event type, ignoring', {
        eventId: event.id,
        eventType: type,
      })
      return { handled: false }
    }
  }
}
