import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  ensureWebhookEventOnce,
  deleteWebhookEvent,
  WEBHOOK_PROVIDER_REVENUECAT,
} from '@/lib/services/webhook-idempotency'
import { revenueCatPayloadSchema, processRevenueCatEvent } from '@/lib/services/revenuecat'
import logger from '@/lib/logger'
import {
  API_ERR_WEBHOOK_NOT_CONFIGURED,
  API_ERR_UNAUTHORIZED,
  API_ERR_TOO_MANY_REQUESTS,
  API_ERR_WEBHOOK_PROCESSING_FAILED,
  API_ERR_WEBHOOK_INVALID_JSON,
  API_ERR_WEBHOOK_PAYLOAD_VALIDATION_FAILED,
} from '@/lib/constants/errors'

export const dynamic = 'force-dynamic'

/**
 * RevenueCat Webhook 送信元検証は共有シークレットの定数時間比較で行う。
 *
 * Why timingSafeEqual: 通常の文字列比較 (===) はタイミングサイドチャネルで
 * シークレットの内容を推測される可能性がある。crypto.timingSafeEqual は
 * 比較時間を入力値に依存させないためシークレット検証に必須。
 * 長さ不一致も安全に扱うため、ダミーバッファと比較して必ず両バッファを評価する。
 */
function verifyRevenueCatAuth(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader) return false

  const expected = Buffer.from(expectedSecret, 'utf8')
  const received = Buffer.from(authHeader, 'utf8')

  // 長さが違う場合もタイミング漏洩を防ぐため、期待値の長さに揃えたダミーと比較する。
  if (received.length !== expected.length) {
    // 同じ長さの比較を必ず行って処理時間を均一にする（早期リターン禁止）
    const dummy = Buffer.alloc(expected.length)
    timingSafeEqual(dummy, expected)
    return false
  }

  return timingSafeEqual(received, expected)
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER
  // env 未設定時は fail-closed: 設定ミスで全リクエストを素通しするリスクを排除する。
  if (!expectedSecret) {
    logger.error('REVENUECAT_WEBHOOK_AUTH_HEADER is not configured')
    return NextResponse.json({ error: API_ERR_WEBHOOK_NOT_CONFIGURED }, { status: 503 })
  }

  // IP ベース rate limit: 正規 RevenueCat webhook を優先するため fail-open。
  // Stripe webhook と同じ 'api' プリセット (60/min/IP) を流用する。
  const rl = await checkRateLimit(request, 'api')
  if (!rl.success) {
    return NextResponse.json({ error: API_ERR_TOO_MANY_REQUESTS }, { status: 429 })
  }

  const authHeader = request.headers.get('authorization')
  if (!verifyRevenueCatAuth(authHeader, expectedSecret)) {
    logger.error('RevenueCat webhook: authorization header mismatch')
    return NextResponse.json({ error: API_ERR_UNAUTHORIZED }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: API_ERR_WEBHOOK_INVALID_JSON }, { status: 400 })
  }

  const parsed = revenueCatPayloadSchema.safeParse(body)
  if (!parsed.success) {
    logger.error('RevenueCat webhook: payload validation failed', {
      issues: parsed.error.issues,
    })
    // RevenueCat 側の schema 変更で永遠にリトライされないよう 200 を返す。
    // ログ・Sentry で検知して対応できるようにする。
    return NextResponse.json({ received: true, error: API_ERR_WEBHOOK_PAYLOAD_VALIDATION_FAILED })
  }

  const { event } = parsed.data
  const eventId = event.id

  // 冪等性ガード: RevenueCat は失敗時にリトライするため同一 event.id の
  // 二重処理（isPremium の多重更新等）を webhook_events への UNIQUE INSERT で防止する。
  try {
    const idem = await ensureWebhookEventOnce(WEBHOOK_PROVIDER_REVENUECAT, eventId)
    if (idem.alreadyProcessed) {
      return NextResponse.json({ received: true, duplicate: true })
    }
  } catch (err) {
    // 冪等性記録の DB 失敗は処理継続（5xx を返すと RevenueCat がリトライしてしまう）。
    logger.error('RevenueCat webhook: idempotency check failed; proceeding without lock', {
      eventId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  try {
    await processRevenueCatEvent(event)
  } catch (err) {
    logger.error('RevenueCat webhook: event processing failed', {
      eventId,
      eventType: event.type,
      error: err instanceof Error ? err.message : String(err),
    })
    // ロック解放: ハンドラが一過性エラーで失敗した場合、冪等性レコードを残すと
    // RevenueCat のリトライが「処理済み」として弾かれ永久に未処理になる。
    await deleteWebhookEvent(WEBHOOK_PROVIDER_REVENUECAT, eventId)
    return NextResponse.json({ error: API_ERR_WEBHOOK_PROCESSING_FAILED }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
