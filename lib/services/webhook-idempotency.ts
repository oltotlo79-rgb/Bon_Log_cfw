/**
 * 外部 Webhook の冪等性ヘルパー
 *
 * @module lib/services/webhook-idempotency
 */

import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import logger from '@/lib/logger'

/** Prisma の "Unique constraint failed" エラーコード */
const PRISMA_UNIQUE_VIOLATION_CODE = 'P2002'

/** Stripe webhook の provider 識別子 */
export const WEBHOOK_PROVIDER_STRIPE = 'stripe'

/** RevenueCat webhook の provider 識別子 */
export const WEBHOOK_PROVIDER_REVENUECAT = 'revenuecat'

export type WebhookIdempotencyResult = {
  /** 既に処理済みであれば true（呼び出し元はハンドラ本体をスキップする） */
  alreadyProcessed: boolean
}

/**
 * Webhook イベントの一意性を保証する。
 *
 * INSERT に成功した場合は `alreadyProcessed=false`、UNIQUE 違反で失敗した場合は
 * `alreadyProcessed=true` を返す。INSERT 以外の DB エラーは呼び出し元へ伝播する。
 *
 * @param provider - Webhook プロバイダ識別子（'stripe' 等）
 * @param eventId  - プロバイダが発行する一意イベントID（Stripe の event.id 等）
 */
export async function ensureWebhookEventOnce(
  provider: string,
  eventId: string,
): Promise<WebhookIdempotencyResult> {
  try {
    await prisma.webhookEvent.create({
      data: { provider, eventId },
      select: { id: true },
    })
    return { alreadyProcessed: false }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PRISMA_UNIQUE_VIOLATION_CODE
    ) {
      logger.info('Duplicate webhook event ignored', { provider, eventId })
      return { alreadyProcessed: true }
    }
    // UNIQUE 以外の DB エラー（接続断等）は呼び出し元へ伝播してリトライ可能にする
    throw error
  }
}

/**
 * 冪等性レコードを取り消す。
 *
 * Why: `ensureWebhookEventOnce` は並行重複処理を防ぐため処理前に INSERT するが、
 * ハンドラが一過性エラーで失敗した場合にレコードを残すと、プロバイダのリトライが
 * 「処理済み」として弾かれて永久に未処理になる（例: 課金済みなのに権限付与されない）。
 * 失敗時に本関数でロックを解放することで、リトライが再処理できるようにする。
 */
export async function deleteWebhookEvent(provider: string, eventId: string): Promise<void> {
  try {
    await prisma.webhookEvent.deleteMany({ where: { provider, eventId } })
  } catch (error) {
    // 解放失敗はロギングのみ（呼び出し元のエラー応答を妨げない）
    logger.error('Failed to release webhook idempotency lock', {
      provider,
      eventId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
