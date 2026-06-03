/**
 * サブスクリプション（プレミアム会員）関連の Server Actions。
 * Stripe Checkout / カスタマーポータル / 状態取得 / 支払い履歴 / 即時解約。
 *
 * @module lib/actions/subscription
 *
 * Returns custom shape instead of ActionResult because Stripe redirect 系
 * (`createCheckoutSession`, `createCustomerPortalSession`) は呼び出し側が
 * `result.url` で window.location 遷移するため `{ url }` の plain object が直接的、
 * 状態取得系 (`getSubscriptionStatus`, `getPaymentHistory`, `getMembershipInfo`) は
 * 未ログイン / フリーユーザー時にデフォルト値を返したい read-heavy パスのため、
 * `ActionResult` でラップせずプレーン値を返す方針を取る。
 * `cancelSubscriptionImmediately` は副作用ありの mutation のため `ActionResult` を返す。
 */

'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAuth, requireNotGuest, requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import { ERR_USER_NOT_FOUND, ERR_ALREADY_PREMIUM, ERR_PRICE_NOT_FOUND, ERR_SUBSCRIPTION_NOT_FOUND, ERR_SUBSCRIPTION_CANCEL_FAILED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { getAppUrl } from '@/lib/env'
import { stripe, STRIPE_PRICE_ID_MONTHLY, STRIPE_PRICE_ID_YEARLY } from '@/lib/stripe'
import { ROUTE_SETTINGS_SUBSCRIPTION } from '@/lib/constants/routes'
import logger from '@/lib/logger'

/**
 * Stripe 課金系 Action で受け取る `priceType` の許容値。
 * リテラル型をランタイムで再検証することで、任意文字列の流入を防ぐ。
 */
const priceTypeSchema = z.enum(['monthly', 'yearly'])
import {
  DEFAULT_PAGE_LIMIT,
  THIRTY_DAYS_MS,
  ONE_SECOND_MS,
  MAX_POST_CONTENT_FREE,
  MAX_POST_CONTENT_PREMIUM,
  MAX_POST_IMAGES_FREE,
  MAX_POST_IMAGES_PREMIUM,
  MAX_POST_VIDEOS_FREE,
  MAX_POST_VIDEOS_PREMIUM,
} from '@/lib/constants/limits'

/**
 * Stripe Checkout Session を作成し、決済ページの URL を返す。
 * 既存の Stripe 顧客がなければ作成して `stripeCustomerId` に保存する。
 *
 * Why rate limit: 連打で Stripe 側に customer / session が無駄に増えるのを防ぐ。
 */
export async function createCheckoutSession(priceType: 'monthly' | 'yearly' = 'monthly') {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = priceTypeSchema.safeParse(priceType)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'stripe_billing')
  if (rl) return actionError(rl.error)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, stripeCustomerId: true, isPremium: true },
  })

  if (!user) return actionError(ERR_USER_NOT_FOUND)
  if (user.isPremium) return actionError(ERR_ALREADY_PREMIUM)

  const priceId = parsed.data === 'yearly' ? STRIPE_PRICE_ID_YEARLY : STRIPE_PRICE_ID_MONTHLY
  if (!priceId) return actionError(ERR_PRICE_NOT_FOUND)

  let customerId = user.stripeCustomerId
  if (!customerId) {
    // metadata.userId は Webhook で誰の支払いか識別するため必須
    const customer = await stripe.customers.create({
      email: user.email!,
      metadata: { userId },
    })
    customerId = customer.id
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    })
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${getAppUrl()}${ROUTE_SETTINGS_SUBSCRIPTION}?success=true`,
    cancel_url: `${getAppUrl()}${ROUTE_SETTINGS_SUBSCRIPTION}?canceled=true`,
    metadata: { userId },
  })

  return { url: checkoutSession.url }
}

/**
 * Stripe カスタマーポータル（プラン変更・解約・請求履歴）の URL を返す。
 * Stripe API を都度叩くため、連打防止のレート制限を入れる。
 */
export async function createCustomerPortalSession() {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const rl = await enforceUserRateLimit(userId, 'stripe_billing')
  if (rl) return actionError(rl.error)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  })

  if (!user?.stripeCustomerId) return actionError(ERR_SUBSCRIPTION_NOT_FOUND)

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${getAppUrl()}${ROUTE_SETTINGS_SUBSCRIPTION}`,
  })

  return { url: portalSession.url }
}

/**
 * 現在のサブスクリプション状態を返す。
 * Stripe API が `current_period_end` を欠くケースに備え、DB の `premiumExpiresAt` にフォールバックする。
 */
export async function getSubscriptionStatus() {
  const auth = await requireAuth()
  if ('error' in auth) return actionError(auth.error)
  const guestCheck = await requireNotGuest()
  if (guestCheck) return actionError(guestCheck.error)
  const userId = auth.userId

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPremium: true,
      premiumExpiresAt: true,
      stripeSubscriptionId: true,
      stripeCustomerId: true,
    },
  })

  if (!user) return actionError(ERR_USER_NOT_FOUND)

  let subscription = null
  if (user.stripeSubscriptionId) {
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
      // Stripe SDK の型は API バージョン差分で current_period_end をトップレベルに持たない
      // ことがある（アイテム内へ移動）。Reflect.get で unknown として取り出し数値チェックする。
      const rawPeriodEnd: unknown = Reflect.get(stripeSubscription, 'current_period_end')
      const periodEnd =
        typeof rawPeriodEnd === 'number' && Number.isFinite(rawPeriodEnd) ? rawPeriodEnd : null
      const currentPeriodEnd = periodEnd && periodEnd > 0
        ? new Date(periodEnd * ONE_SECOND_MS)
        : user.premiumExpiresAt ?? new Date(Date.now() + THIRTY_DAYS_MS)

      subscription = {
        status: stripeSubscription.status,
        currentPeriodEnd,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      }
    } catch {
      // Stripe 側に存在しない場合は subscription=null のまま返す
    }
  }

  return {
    isPremium: user.isPremium,
    premiumExpiresAt: user.premiumExpiresAt,
    subscription,
  }
}

/** 支払い履歴（最新 DEFAULT_PAGE_LIMIT 件）を新しい順で返す。 */
export async function getPaymentHistory() {
  const auth = await requireAuth()
  if ('error' in auth) return actionError(auth.error)
  const guestCheck = await requireNotGuest()
  if (guestCheck) return actionError(guestCheck.error)
  const userId = auth.userId

  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: DEFAULT_PAGE_LIMIT,
  })

  return { payments }
}

/**
 * サブスクリプションを即時解約する（返金なし）。
 * カスタマーポータル経由の「期間終了で解約」とは異なり、プレミアム権限をその場で剥奪する。
 *
 * Why rate limit: Stripe cancel API への連打を抑え、誤操作の連続実行を防ぐ。
 */
export async function cancelSubscriptionImmediately() {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const rl = await enforceUserRateLimit(userId, 'stripe_billing')
  if (rl) return actionError(rl.error)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeSubscriptionId: true },
  })

  if (!user?.stripeSubscriptionId) return actionError(ERR_SUBSCRIPTION_NOT_FOUND)

  try {
    await stripe.subscriptions.cancel(user.stripeSubscriptionId)
    await prisma.user.update({
      where: { id: userId },
      data: {
        isPremium: false,
        stripeSubscriptionId: null,
        premiumExpiresAt: null,
      },
    })
    revalidatePath(ROUTE_SETTINGS_SUBSCRIPTION)
    return actionSuccess()
  } catch (error) {
    logger.error('Failed to cancel subscription:', error)
    return actionError(ERR_SUBSCRIPTION_CANCEL_FAILED)
  }
}

/**
 * 会員種別と対応する機能制限（文字数・画像枚数・予約投稿可否など）を返す。
 * 未ログイン時は無料会員相当の値を返す。
 */
export async function getMembershipInfo() {
  const auth = await requireAuth()
  if ('error' in auth) {
    return {
      isPremium: false,
      limits: {
        maxPostLength: MAX_POST_CONTENT_FREE,
        maxImages: MAX_POST_IMAGES_FREE,
        maxVideos: MAX_POST_VIDEOS_FREE,
        canSchedulePost: false,
        canViewAnalytics: false,
      },
    }
  }
  const userId = auth.userId

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true, premiumExpiresAt: true },
  })

  const isPremium = !!user?.isPremium &&
    (!user.premiumExpiresAt || user.premiumExpiresAt > new Date())

  return {
    isPremium,
    limits: isPremium ? {
      maxPostLength: MAX_POST_CONTENT_PREMIUM,
      maxImages: MAX_POST_IMAGES_PREMIUM,
      maxVideos: MAX_POST_VIDEOS_PREMIUM,
      canSchedulePost: true,
      canViewAnalytics: true,
    } : {
      maxPostLength: MAX_POST_CONTENT_FREE,
      maxImages: MAX_POST_IMAGES_FREE,
      maxVideos: MAX_POST_VIDEOS_FREE,
      canSchedulePost: false,
      canViewAnalytics: false,
    },
  }
}
