import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import Stripe from 'stripe'
import { z } from 'zod'
import type { EntitlementStatus } from '@prisma/client'
import logger from '@/lib/logger'
import { PREMIUM_FALLBACK_DAYS, ONE_DAY_MS, ONE_SECOND_MS } from '@/lib/constants/limits'
import { createNotification } from '@/lib/services/notification-core'
import { ensureWebhookEventOnce, deleteWebhookEvent } from '@/lib/services/webhook-idempotency'
import {
  applyEntitlementEvent,
  recomputeUserPremiumAggregate,
} from '@/lib/services/premium-entitlements'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  API_ERR_WEBHOOK_NOT_CONFIGURED,
  API_ERR_MISSING_SIGNATURE,
  API_ERR_INVALID_SIGNATURE,
  API_ERR_TOO_MANY_REQUESTS,
  API_ERR_WEBHOOK_PROCESSING_FAILED,
} from '@/lib/constants/errors'

const WEBHOOK_PROVIDER_STRIPE = 'stripe'

export const dynamic = 'force-dynamic'

/**
 * ============================================================
 * 外部 API (Stripe) 境界バリデーション
 * ============================================================
 *
 * Stripe SDK の型は expand / SDK バージョン間で揺れやすい
 * （例: `current_period_end` が `Subscription` 直下から `items.data[].current_period_end`
 *  へ移動するなど）。Webhook ハンドラで実際に参照する最低限のフィールドだけを
 * Zod で検証することで、`as unknown as` キャストを排除し、未知形状の payload を
 * ランタイムで安全に弾く。
 *
 * 検証に失敗した場合は 200 を返して Stripe の 24 時間リトライを止め、
 * event.id と issues をログに記録してオブザーバビリティを確保する。
 */

const stripeSubscriptionSchema = z.object({
  id: z.string(),
  status: z.string(),
  // 新しい Stripe API では current_period_end が Subscription 直下から
  // items.data[].current_period_end へ移動したため、両方の位置を許容する。
  current_period_end: z.number().int().optional(),
  items: z
    .object({
      data: z.array(z.object({ current_period_end: z.number().int().optional() })).optional(),
    })
    .optional(),
  // 「現在有効だが次回更新しない」状態（entitlement のメタデータとして保存する）
  cancel_at_period_end: z.boolean().optional(),
})

/** Subscription の課金周期終了 unix 秒を、API バージョン差を吸収して取得する。 */
function getSubscriptionPeriodEnd(
  subscription: z.infer<typeof stripeSubscriptionSchema>,
): number | undefined {
  return subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end
}

/**
 * Stripe の raw subscription status を PremiumEntitlement の status へ写像する。
 *
 * 既存実装（customer.subscription.updated ハンドラ）は `status === 'active'` の
 * リテラル比較のみで isPremium を決めていたため、その挙動をそのまま踏襲する
 * （trialing / past_due / unpaid / canceled / incomplete 等は全て非アクティブ扱い＝
 * 猶予期間なしの既存仕様。ここで挙動を変更すると Stripe のみで購読中の既存 Web
 * ユーザーの失効タイミングが変わってしまうため、意図的に変更しない）。
 */
function mapStripeStatusToEntitlementStatus(status: string): EntitlementStatus {
  return status === 'active' ? 'active' : 'inactive'
}

// Stripe の invoice / payment_intent / subscription フィールドは expand 無しの場合は
// ID 文字列（または null）。expand 済みオブジェクトは現状使っていないため文字列のみ許容する。
const stripeInvoiceSchema = z.object({
  subscription: z.string().nullish(),
  payment_intent: z.string().nullish(),
  amount_paid: z.number(),
  currency: z.string(),
  billing_reason: z.string().nullish(),
})

const stripeCheckoutSessionSchema = z.object({
  metadata: z.record(z.string(), z.string()).nullish(),
  subscription: z.string().nullish(),
  customer: z.string().nullish(),
  invoice: z.string().nullish(),
})

// charge.refunded: 返金された Charge。expand 無しでは payment_intent / customer は ID 文字列。
// refunded=true は全額返金、amount_refunded < amount は一部返金を表す。
const stripeChargeSchema = z.object({
  payment_intent: z.string().nullish(),
  customer: z.string().nullish(),
  refunded: z.boolean().nullish(),
  amount: z.number().nullish(),
  amount_refunded: z.number().nullish(),
})

// charge.dispute.created: チャージバック。返金確定前のため破壊的更新はせず、アラート目的でログ化する。
const stripeDisputeSchema = z.object({
  charge: z.string().nullish(),
  payment_intent: z.string().nullish(),
  reason: z.string().nullish(),
  status: z.string().nullish(),
  amount: z.number().nullish(),
})

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: API_ERR_WEBHOOK_NOT_CONFIGURED }, { status: 503 })
  }

  // IP ベース rate limit: 公開エンドポイントなので、署名検証 (HMAC) ですら
  // 偽 webhook の大量送信で計算コストを消費される可能性がある。
  // Stripe からの正規 webhook は専用 IP プールから送られるため 60/min/IP で十分。
  // fail-open: Redis 障害時に正規 Stripe webhook を取りこぼすと売上影響が出るため。
  const rl = await checkRateLimit(request, 'api')
  if (!rl.success) {
    return NextResponse.json({ error: API_ERR_TOO_MANY_REQUESTS }, { status: 429 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: API_ERR_MISSING_SIGNATURE }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    logger.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: API_ERR_INVALID_SIGNATURE }, { status: 400 })
  }

  // 冪等性ガード: Stripe は失敗時に最大 24 時間リトライするため、
  // 同一 event.id の二重処理（重複通知・残高重複加算等）を webhook_events への
  // UNIQUE INSERT で防止する。重複は 200 を返してリトライを終了させる。
  try {
    const idem = await ensureWebhookEventOnce(WEBHOOK_PROVIDER_STRIPE, event.id)
    if (idem.alreadyProcessed) {
      return NextResponse.json({ received: true, duplicate: true })
    }
  } catch (err) {
    // 冪等性記録の DB 失敗は処理を継続（5xx を返すと Stripe がリトライしてしまう）。
    // 既存の payment.findUnique 等の二次防御に委ねる。
    logger.error('Webhook idempotency check failed; proceeding without lock', {
      eventId: event.id,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  // out-of-order 防御の基準時刻。Stripe Event は常に top-level `created`（event 発生時刻・unix 秒）
  // を持つため、これを providerEventAt として使う（古い expiration が新しい renewal の後に
  // 届いても巻き戻さないための比較基準）。
  const eventAt = new Date(event.created * ONE_SECOND_MS)

  switch (event.type) {
    // 決済完了 → 有料会員有効化
    case 'checkout.session.completed': {
      try {
        const parsed = stripeCheckoutSessionSchema.safeParse(event.data.object)
        if (!parsed.success) {
          logger.error('checkout.session.completed: payload validation failed', {
            eventId: event.id,
            issues: parsed.error.issues,
          })
          break
        }
        const session = parsed.data
        const userId = session.metadata?.userId
        const subscriptionId = session.subscription
        const customerId = session.customer

        logger.info('checkout.session.completed:', { userId, subscriptionId, customerId })

        if (userId && subscriptionId) {
          const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId)
          const subParsed = stripeSubscriptionSchema.safeParse(subscriptionResponse)
          if (!subParsed.success) {
            logger.error('checkout.session.completed: subscription payload validation failed', {
              eventId: event.id,
              subscriptionId,
              issues: subParsed.error.issues,
            })
            break
          }
          const currentPeriodEnd = getSubscriptionPeriodEnd(subParsed.data)

          // 有効期限を計算（取得できない場合は30日後をデフォルト）
          const premiumExpiresAt = currentPeriodEnd
            ? new Date(currentPeriodEnd * ONE_SECOND_MS)
            : new Date(Date.now() + PREMIUM_FALLBACK_DAYS * ONE_DAY_MS)

          logger.info('currentPeriodEnd:', currentPeriodEnd, 'premiumExpiresAt:', premiumExpiresAt)

          // legacy カラム（stripeCustomerId/stripeSubscriptionId）の更新・stripe entitlement の
          // upsert・User aggregate 再計算を単一トランザクションで atomic に行う
          // （途中失敗で provider record と aggregate が半端に commit されないようにするため）。
          await prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: userId },
              data: {
                stripeCustomerId: customerId ?? null,
                stripeSubscriptionId: subscriptionId,
              },
            })
            // 既存実装は checkout.session.completed 到達時点で subscription.status を問わず
            // 有効化していたため、その挙動を踏襲し status は常に 'active' とする。
            await applyEntitlementEvent(tx, {
              userId,
              provider: 'stripe',
              providerRef: subscriptionId,
              status: 'active',
              cancelAtPeriodEnd: subParsed.data.cancel_at_period_end ?? false,
              expiresAt: premiumExpiresAt,
              eventAt,
              eventId: event.id,
            })
            // aggregate の有効判定は「実処理時点の現在時刻」で行う（eventAt は out-of-order
            // 判定専用の基準値であり、"今この瞬間 premium かどうか" の判定には使わない）。
            await recomputeUserPremiumAggregate(tx, userId)
          })

          // 支払い履歴を記録（サブスクリプションの場合、invoiceから取得）
          if (session.invoice) {
            const invoiceResponse = await stripe.invoices.retrieve(session.invoice)
            const invParsed = stripeInvoiceSchema.safeParse(invoiceResponse)
            if (!invParsed.success) {
              logger.error('checkout.session.completed: invoice payload validation failed', {
                eventId: event.id,
                invoiceId: session.invoice,
                issues: invParsed.error.issues,
              })
              break
            }
            const invoice = invParsed.data
            if (invoice.payment_intent) {
              // Idempotency: skip if payment already recorded
              const existingPayment = await prisma.payment.findUnique({
                where: { stripePaymentId: invoice.payment_intent },
              })
              if (!existingPayment) {
                await prisma.payment.create({
                  data: {
                    userId,
                    stripePaymentId: invoice.payment_intent,
                    amount: invoice.amount_paid,
                    currency: invoice.currency,
                    status: 'succeeded',
                    description: 'プレミアム会員登録',
                  },
                })
              }
            }
          }

          logger.info(`User ${userId} upgraded to premium`)
        } else {
          logger.error('Missing userId or subscriptionId:', { userId, subscriptionId })
        }
      } catch (err) {
        logger.error('Failed to handle checkout.session.completed:', err)
        await deleteWebhookEvent(WEBHOOK_PROVIDER_STRIPE, event.id)
        return NextResponse.json({ error: API_ERR_WEBHOOK_PROCESSING_FAILED }, { status: 500 })
      }
      break
    }

    // サブスクリプション更新（更新・期限延長）
    case 'customer.subscription.updated': {
      try {
        const parsed = stripeSubscriptionSchema.safeParse(event.data.object)
        if (!parsed.success) {
          logger.error('customer.subscription.updated: payload validation failed', {
            eventId: event.id,
            issues: parsed.error.issues,
          })
          break
        }
        const { id: subscriptionId, status: subscriptionStatus } = parsed.data
        const currentPeriodEnd = getSubscriptionPeriodEnd(parsed.data)

        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        })

        logger.info('customer.subscription.updated:', {
          subscriptionId,
          status: subscriptionStatus,
          currentPeriodEnd,
          userId: user?.id,
        })

        if (user) {
          const premiumExpiresAt = currentPeriodEnd
            ? new Date(currentPeriodEnd * ONE_SECOND_MS)
            : new Date(Date.now() + PREMIUM_FALLBACK_DAYS * ONE_DAY_MS)

          await prisma.$transaction(async (tx) => {
            await applyEntitlementEvent(tx, {
              userId: user.id,
              provider: 'stripe',
              providerRef: subscriptionId,
              status: mapStripeStatusToEntitlementStatus(subscriptionStatus),
              cancelAtPeriodEnd: parsed.data.cancel_at_period_end ?? false,
              expiresAt: premiumExpiresAt,
              eventAt,
              eventId: event.id,
            })
            await recomputeUserPremiumAggregate(tx, user.id)
          })

          logger.info(`User ${user.id} subscription updated: ${subscriptionStatus}`)
        }
      } catch (err) {
        logger.error('Failed to handle customer.subscription.updated:', err)
        await deleteWebhookEvent(WEBHOOK_PROVIDER_STRIPE, event.id)
        return NextResponse.json({ error: API_ERR_WEBHOOK_PROCESSING_FAILED }, { status: 500 })
      }
      break
    }

    // サブスクリプション解約
    case 'customer.subscription.deleted': {
      try {
        const parsed = stripeSubscriptionSchema.safeParse(event.data.object)
        if (!parsed.success) {
          logger.error('customer.subscription.deleted: payload validation failed', {
            eventId: event.id,
            issues: parsed.error.issues,
          })
          break
        }
        const subscriptionId = parsed.data.id

        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        })

        if (user) {
          await prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: user.id },
              data: { stripeSubscriptionId: null },
            })
            await applyEntitlementEvent(tx, {
              userId: user.id,
              provider: 'stripe',
              status: 'expired',
              cancelAtPeriodEnd: false,
              expiresAt: null,
              eventAt,
              eventId: event.id,
            })
            await recomputeUserPremiumAggregate(tx, user.id)
          })

          logger.info(`User ${user.id} subscription deleted`)
        }
      } catch (err) {
        logger.error('Failed to handle customer.subscription.deleted:', err)
        await deleteWebhookEvent(WEBHOOK_PROVIDER_STRIPE, event.id)
        return NextResponse.json({ error: API_ERR_WEBHOOK_PROCESSING_FAILED }, { status: 500 })
      }
      break
    }

    // 支払い失敗
    case 'invoice.payment_failed': {
      try {
        const parsed = stripeInvoiceSchema.safeParse(event.data.object)
        if (!parsed.success) {
          logger.error('invoice.payment_failed: payload validation failed', {
            eventId: event.id,
            issues: parsed.error.issues,
          })
          break
        }
        const subscriptionId = parsed.data.subscription

        logger.info('invoice.payment_failed:', { subscriptionId })

        if (subscriptionId) {
          const user = await prisma.user.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
          })

          if (user) {
            // 支払い失敗の通知（CLAUDE.md ルール6: createNotification 経由）。
            // system 通知のため createNotification 内部でブロックチェックはスキップされる。
            const notif = await createNotification({
              userId: user.id,
              actorId: user.id,
              type: 'system',
            })
            if (!notif.success) {
              logger.error('Payment-failed notification creation failed', {
                userId: user.id,
                error: notif.error,
              })
            }

            logger.info(`Payment failed for user ${user.id}`)
          }
        }
      } catch (err) {
        logger.error('Failed to handle invoice.payment_failed:', err)
        await deleteWebhookEvent(WEBHOOK_PROVIDER_STRIPE, event.id)
        return NextResponse.json({ error: API_ERR_WEBHOOK_PROCESSING_FAILED }, { status: 500 })
      }
      break
    }

    // 請求書支払い成功（継続課金）
    case 'invoice.payment_succeeded': {
      try {
        const parsed = stripeInvoiceSchema.safeParse(event.data.object)
        if (!parsed.success) {
          logger.error('invoice.payment_succeeded: payload validation failed', {
            eventId: event.id,
            issues: parsed.error.issues,
          })
          break
        }
        const invoice = parsed.data
        const subscriptionId = invoice.subscription

        logger.info('invoice.payment_succeeded:', {
          subscriptionId,
          billingReason: invoice.billing_reason,
        })

        // 継続課金の場合のみ記録（初回は checkout.session.completed で処理）
        if (subscriptionId && invoice.billing_reason === 'subscription_cycle') {
          const user = await prisma.user.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
          })

          if (user && invoice.payment_intent) {
            // Idempotency: skip if payment already recorded
            const existingPayment = await prisma.payment.findUnique({
              where: { stripePaymentId: invoice.payment_intent },
            })
            if (existingPayment) {
              logger.info(`Payment ${invoice.payment_intent} already recorded, skipping`)
            } else {
              // 支払い履歴を記録
              await prisma.payment.create({
                data: {
                  userId: user.id,
                  stripePaymentId: invoice.payment_intent,
                  amount: invoice.amount_paid,
                  currency: invoice.currency,
                  status: 'succeeded',
                  description: 'プレミアム会員更新',
                },
              })

              // 期限を延長
              const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId)
              const subParsed = stripeSubscriptionSchema.safeParse(subscriptionResponse)
              if (!subParsed.success) {
                logger.error('invoice.payment_succeeded: subscription payload validation failed', {
                  eventId: event.id,
                  subscriptionId,
                  issues: subParsed.error.issues,
                })
                break
              }
              const currentPeriodEnd = getSubscriptionPeriodEnd(subParsed.data)
              const premiumExpiresAt = currentPeriodEnd
                ? new Date(currentPeriodEnd * ONE_SECOND_MS)
                : new Date(Date.now() + PREMIUM_FALLBACK_DAYS * ONE_DAY_MS)

              // 既存実装は isPremium に触れず premiumExpiresAt のみ延長していたため、
              // entitlement 側も status は変更せず expiresAt のみ更新する
              // （status を省略すると applyEntitlementEvent は既存値を維持する）。
              await prisma.$transaction(async (tx) => {
                await applyEntitlementEvent(tx, {
                  userId: user.id,
                  provider: 'stripe',
                  providerRef: subscriptionId,
                  expiresAt: premiumExpiresAt,
                  eventAt,
                  eventId: event.id,
                })
                await recomputeUserPremiumAggregate(tx, user.id)
              })

              logger.info(`User ${user.id} subscription renewed`)
            }
          }
        }
      } catch (err) {
        logger.error('Failed to handle invoice.payment_succeeded:', err)
        await deleteWebhookEvent(WEBHOOK_PROVIDER_STRIPE, event.id)
        return NextResponse.json({ error: API_ERR_WEBHOOK_PROCESSING_FAILED }, { status: 500 })
      }
      break
    }

    // 返金 → 全額返金時はプレミアムを失効させ payment を refunded に更新
    case 'charge.refunded': {
      try {
        const parsed = stripeChargeSchema.safeParse(event.data.object)
        if (!parsed.success) {
          logger.error('charge.refunded: payload validation failed', {
            eventId: event.id,
            issues: parsed.error.issues,
          })
          break
        }
        const charge = parsed.data
        const paymentIntentId = charge.payment_intent
        const isFullRefund =
          charge.refunded === true ||
          (typeof charge.amount === 'number' &&
            typeof charge.amount_refunded === 'number' &&
            charge.amount_refunded >= charge.amount)

        // 返金対象ユーザーは payment(payment_intent) 経由で特定し、無ければ customer から引く
        const payment = paymentIntentId
          ? await prisma.payment.findUnique({ where: { stripePaymentId: paymentIntentId } })
          : null
        const user =
          (payment?.userId
            ? await prisma.user.findUnique({ where: { id: payment.userId } })
            : null) ??
          (charge.customer
            ? await prisma.user.findFirst({ where: { stripeCustomerId: charge.customer } })
            : null)

        logger.info('charge.refunded:', {
          paymentIntentId,
          isFullRefund,
          userId: user?.id,
        })

        // 一部返金ではプレミアムを維持する（全額返金時のみ失効）
        if (!isFullRefund) break

        if (payment && payment.status !== 'refunded') {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'refunded' },
          })
        }

        if (user) {
          await prisma.$transaction(async (tx) => {
            await applyEntitlementEvent(tx, {
              userId: user.id,
              provider: 'stripe',
              status: 'expired',
              cancelAtPeriodEnd: false,
              expiresAt: null,
              eventAt,
              eventId: event.id,
            })
            await recomputeUserPremiumAggregate(tx, user.id)
          })

          const notif = await createNotification({
            userId: user.id,
            actorId: user.id,
            type: 'system',
          })
          if (!notif.success) {
            logger.error('Refund notification creation failed', {
              userId: user.id,
              error: notif.error,
            })
          }

          logger.info(`User ${user.id} premium revoked due to full refund`)
        }
      } catch (err) {
        logger.error('Failed to handle charge.refunded:', err)
        await deleteWebhookEvent(WEBHOOK_PROVIDER_STRIPE, event.id)
        return NextResponse.json({ error: API_ERR_WEBHOOK_PROCESSING_FAILED }, { status: 500 })
      }
      break
    }

    // チャージバック発生 → 返金は未確定のため状態は変えず、管理者向けに Sentry へアラート
    case 'charge.dispute.created': {
      try {
        const parsed = stripeDisputeSchema.safeParse(event.data.object)
        if (!parsed.success) {
          logger.error('charge.dispute.created: payload validation failed', {
            eventId: event.id,
            issues: parsed.error.issues,
          })
          break
        }
        const dispute = parsed.data
        const payment = dispute.payment_intent
          ? await prisma.payment.findUnique({ where: { stripePaymentId: dispute.payment_intent } })
          : null

        // logger.error → 本番では Sentry に送られ、運用者が個別対応できるようにする
        logger.error('Stripe dispute created (chargeback) — requires manual review', {
          eventId: event.id,
          chargeId: dispute.charge,
          paymentIntentId: dispute.payment_intent,
          reason: dispute.reason,
          status: dispute.status,
          amount: dispute.amount,
          userId: payment?.userId ?? null,
        })
      } catch (err) {
        logger.error('Failed to handle charge.dispute.created:', err)
        await deleteWebhookEvent(WEBHOOK_PROVIDER_STRIPE, event.id)
        return NextResponse.json({ error: API_ERR_WEBHOOK_PROCESSING_FAILED }, { status: 500 })
      }
      break
    }

    default:
      logger.info(`Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
