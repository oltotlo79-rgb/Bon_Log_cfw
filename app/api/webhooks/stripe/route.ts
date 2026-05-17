import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import Stripe from 'stripe'
import { z } from 'zod'
import logger from '@/lib/logger'
import { PREMIUM_FALLBACK_DAYS, ONE_DAY_MS, ONE_SECOND_MS } from '@/lib/constants/limits'
import { createNotification } from '@/lib/services/notification-core'
import { ensureWebhookEventOnce } from '@/lib/services/webhook-idempotency'
import {
  API_ERR_WEBHOOK_NOT_CONFIGURED,
  API_ERR_MISSING_SIGNATURE,
  API_ERR_INVALID_SIGNATURE,
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
  current_period_end: z.number().int().optional(),
})

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

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: API_ERR_WEBHOOK_NOT_CONFIGURED }, { status: 503 })
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
          const currentPeriodEnd = subParsed.data.current_period_end

          // 有効期限を計算（取得できない場合は30日後をデフォルト）
          const premiumExpiresAt = currentPeriodEnd
            ? new Date(currentPeriodEnd * ONE_SECOND_MS)
            : new Date(Date.now() + PREMIUM_FALLBACK_DAYS * ONE_DAY_MS)

          logger.info('currentPeriodEnd:', currentPeriodEnd, 'premiumExpiresAt:', premiumExpiresAt)

          await prisma.user.update({
            where: { id: userId },
            data: {
              isPremium: true,
              stripeCustomerId: customerId ?? null,
              stripeSubscriptionId: subscriptionId,
              premiumExpiresAt,
            },
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
        // Return 200 to prevent Stripe retries for processing errors
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
        const { id: subscriptionId, status: subscriptionStatus, current_period_end: currentPeriodEnd } = parsed.data

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

          await prisma.user.update({
            where: { id: user.id },
            data: {
              isPremium: subscriptionStatus === 'active',
              premiumExpiresAt,
            },
          })

          logger.info(`User ${user.id} subscription updated: ${subscriptionStatus}`)
        }
      } catch (err) {
        logger.error('Failed to handle customer.subscription.updated:', err)
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
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isPremium: false,
              stripeSubscriptionId: null,
              premiumExpiresAt: null,
            },
          })

          logger.info(`User ${user.id} subscription deleted`)
        }
      } catch (err) {
        logger.error('Failed to handle customer.subscription.deleted:', err)
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
              const currentPeriodEnd = subParsed.data.current_period_end
              const premiumExpiresAt = currentPeriodEnd
                ? new Date(currentPeriodEnd * ONE_SECOND_MS)
                : new Date(Date.now() + PREMIUM_FALLBACK_DAYS * ONE_DAY_MS)

              await prisma.user.update({
                where: { id: user.id },
                data: {
                  premiumExpiresAt,
                },
              })

              logger.info(`User ${user.id} subscription renewed`)
            }
          }
        }
      } catch (err) {
        logger.error('Failed to handle invoice.payment_succeeded:', err)
      }
      break
    }

    default:
      logger.info(`Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
