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
