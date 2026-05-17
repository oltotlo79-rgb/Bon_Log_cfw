/**
 * プレミアム会員の判定・制限値管理。
 *
 * 無料／プレミアムの 2 種類を扱い、期限切れは参照時に自動失効させる。
 *
 * @module lib/premium
 */

import { cache } from 'react'
import { prisma } from '@/lib/db'
import {
  MAX_POST_CONTENT_FREE,
  MAX_POST_IMAGES_FREE,
  MAX_POST_VIDEOS_FREE,
  MAX_DAILY_POSTS_FREE,
  MAX_POST_CONTENT_PREMIUM,
  MAX_POST_IMAGES_PREMIUM,
  MAX_POST_VIDEOS_PREMIUM,
  MAX_DAILY_POSTS_PREMIUM,
} from '@/lib/constants/limits'

export type MembershipType = 'free' | 'premium'

export interface MembershipLimits {
  maxPostLength: number
  maxImages: number
  maxVideos: number
  maxDailyPosts: number
  canSchedulePost: boolean
  canViewAnalytics: boolean
}

const FREE_LIMITS: MembershipLimits = {
  maxPostLength: MAX_POST_CONTENT_FREE,
  maxImages: MAX_POST_IMAGES_FREE,
  maxVideos: MAX_POST_VIDEOS_FREE,
  maxDailyPosts: MAX_DAILY_POSTS_FREE,
  canSchedulePost: false,
  canViewAnalytics: false,
}

const PREMIUM_LIMITS: MembershipLimits = {
  maxPostLength: MAX_POST_CONTENT_PREMIUM,
  maxImages: MAX_POST_IMAGES_PREMIUM,
  maxVideos: MAX_POST_VIDEOS_PREMIUM,
  maxDailyPosts: MAX_DAILY_POSTS_PREMIUM,
  canSchedulePost: true,
  canViewAnalytics: true,
}

/**
 * プレミアム会員かどうかを判定する。
 * 期限切れの場合は `isPremium` を false に更新してから false を返す（参照時自動失効）。
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true, premiumExpiresAt: true },
  })

  if (!user || !user.isPremium) return false

  if (user.premiumExpiresAt && user.premiumExpiresAt < new Date()) {
    await prisma.user.update({
      where: { id: userId },
      data: { isPremium: false },
    })
    return false
  }

  return true
}

/** 会員種別に応じた制限値を取得する。 */
export const getMembershipLimits = cache(async (userId: string): Promise<MembershipLimits> => {
  const isPremium = await isPremiumUser(userId)
  return isPremium ? PREMIUM_LIMITS : FREE_LIMITS
})

/** 会員種別を文字列で返す。UI 表示や条件分岐に使用。 */
export async function getMembershipType(userId: string): Promise<MembershipType> {
  const isPremium = await isPremiumUser(userId)
  return isPremium ? 'premium' : 'free'
}

/**
 * プレミアム会員の詳細ステータスを返す。
 * 設定画面・サブスク管理画面向け。ユーザーが存在しなければ null。
 */
export async function getPremiumStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPremium: true,
      premiumExpiresAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  })

  if (!user) {
    return null
  }

  return {
    isPremium: user.isPremium,
    premiumExpiresAt: user.premiumExpiresAt,
    hasStripeSubscription: !!user.stripeSubscriptionId,
  }
}

/**
 * 期限切れプレミアム会員を一括で無効化する。
 * Cron から定期実行することを想定。戻り値は更新件数。
 */
export async function checkPremiumExpiry(): Promise<number> {
  const result = await prisma.user.updateMany({
    where: {
      isPremium: true,
      premiumExpiresAt: {
        lt: new Date(),
      },
    },
    data: {
      isPremium: false,
    },
  })

  return result.count
}

export { FREE_LIMITS, PREMIUM_LIMITS }
