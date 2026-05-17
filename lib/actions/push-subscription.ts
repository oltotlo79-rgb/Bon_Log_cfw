/**
 * プッシュ通知購読管理のServer Actions
 *
 * ユーザーのプッシュ通知購読の登録・解除・状態取得を提供する。
 *
 * @module lib/actions/push-subscription
 */

'use server'

import { prisma } from '@/lib/db'
import { requireAuth, requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import { MAX_PUSH_SUBSCRIPTIONS_PER_USER } from '@/lib/constants/limits'
import {
  ERR_PUSH_SUBSCRIBE_FAILED,
  ERR_PUSH_UNSUBSCRIBE_FAILED,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'
import logger from '@/lib/logger'
import { z } from 'zod'

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

/**
 * プッシュ通知購読を登録する。
 * 同一エンドポイントが既に登録済みの場合はキーを更新する。
 */
export async function subscribePush(subscription: {
  endpoint: string
  keys: { p256dh: string; auth: string }
}) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const parsed = subscriptionSchema.safeParse(subscription)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  const { endpoint, keys } = parsed.data

  try {
    // 購読数チェック（デバイス上限）
    const existingCount = await prisma.pushSubscription.count({
      where: { userId },
    })

    // 同一エンドポイントが既にあるか確認
    const existing = await prisma.pushSubscription.findUnique({
      where: { userId_endpoint: { userId, endpoint } },
    })

    if (!existing && existingCount >= MAX_PUSH_SUBSCRIPTIONS_PER_USER) {
      // 最も古い購読を削除して枠を空ける
      const oldest = await prisma.pushSubscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
      if (oldest) {
        await prisma.pushSubscription.delete({ where: { id: oldest.id } })
      }
    }

    // upsert: 既存のエンドポイントはキーを更新、新規は作成
    await prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint } },
      update: { p256dh: keys.p256dh, auth: keys.auth },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    })

    return actionSuccess()
  } catch (error) {
    logger.error('Push subscribe error:', error)
    return actionError(ERR_PUSH_SUBSCRIBE_FAILED)
  }
}

/**
 * プッシュ通知購読を解除する。
 */
export async function unsubscribePush(endpoint: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  if (!endpoint) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    await prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    })

    return actionSuccess()
  } catch (error) {
    logger.error('Push unsubscribe error:', error)
    return actionError(ERR_PUSH_UNSUBSCRIBE_FAILED)
  }
}

/**
 * 現在のユーザーのプッシュ通知購読状態を取得する。
 */
export async function getPushSubscriptionStatus() {
  const authResult = await requireAuth()
  if ('error' in authResult) return { subscribed: false, count: 0 }
  const userId = authResult.userId

  const count = await prisma.pushSubscription.count({
    where: { userId },
  })

  return { subscribed: count > 0, count }
}
