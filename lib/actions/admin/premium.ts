/**
 * 管理者用プレミアム会員管理 Server Actions。
 *
 * 全操作で `requireAdmin('premium:*')` による認可を行い、変更系は
 * `AdminLog` に監査記録を残す。Stripe 経由の自動サブスクリプションとは
 * 独立した手動付与・取り消し・延長フロー（プロモーション / カスタマー
 * サポート / テスト用途）を提供する。
 *
 * @module lib/actions/admin/premium
 */

'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import {
  DEFAULT_PAGE_LIMIT,
  MIN_ADMIN_SEARCH_QUERY_LENGTH,
  ADMIN_PREMIUM_SEARCH_LIMIT,
  PREMIUM_EXPIRING_WARN_DAYS,
  DEFAULT_PREMIUM_GRANT_DAYS,
} from '@/lib/constants/limits'
import { requireAdmin, actionSuccess, actionError } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
import {
  ERR_USER_NOT_FOUND,
  ERR_NOT_PREMIUM_USER,
  ERR_OPERATION_FAILED,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'
import { ROUTE_FEED, ROUTE_ADMIN_PREMIUM } from '@/lib/constants/routes'
import { ACTION_GRANT_PREMIUM, ACTION_REVOKE_PREMIUM, ACTION_EXTEND_PREMIUM } from '@/lib/constants/admin-actions'
import { logger } from '@/lib/logger'
import { containsInsensitive } from '@/lib/actions/prisma-filters'
import { adminIdSchema, premiumDurationDaysSchema } from './_schemas'

/**
 * プレミアム資格を付与する。期限は現在時刻 + `durationDays` 日。
 *
 * @param targetUserId 対象ユーザー ID
 * @param durationDays 有効期間（日数。既定値は `DEFAULT_PREMIUM_GRANT_DAYS`）
 */
export async function grantPremium(targetUserId: string, durationDays: number = DEFAULT_PREMIUM_GRANT_DAYS) {
  const admin = await requireAdmin('premium:manage')
  if ('error' in admin) return actionError(admin.error)
  const adminId = admin.userId

  const idParsed = adminIdSchema.safeParse(targetUserId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)
  const daysParsed = premiumDurationDaysSchema.safeParse(durationDays)
  if (!daysParsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: idParsed.data },
    })

    if (!targetUser) {
      return actionError(ERR_USER_NOT_FOUND)
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + daysParsed.data)

    await prisma.user.update({
      where: { id: idParsed.data },
      data: {
        isPremium: true,
        premiumExpiresAt: expiresAt,
      },
    })

    await prisma.adminLog.create({
      data: {
        adminId: adminId,
        action: ACTION_GRANT_PREMIUM,
        targetType: 'user',
        targetId: idParsed.data,
        details: { durationDays: daysParsed.data, expiresAt: expiresAt.toISOString() },
      },
    })

    revalidatePath(ROUTE_ADMIN_PREMIUM)
    return actionSuccess({ expiresAt })
  } catch (error) {
    logger.error('Grant premium error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * プレミアム資格を取り消す。Stripe 連携情報（`stripeCustomerId` /
 * `stripeSubscriptionId`）は再登録時の継続利用を考慮して残す。
 */
export async function revokePremium(targetUserId: string) {
  const admin = await requireAdmin('premium:manage')
  if ('error' in admin) return actionError(admin.error)
  const adminId = admin.userId

  const idParsed = adminIdSchema.safeParse(targetUserId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: idParsed.data },
      select: { isPremium: true },
    })

    if (!targetUser) {
      return actionError(ERR_USER_NOT_FOUND)
    }

    if (!targetUser.isPremium) {
      return actionError(ERR_NOT_PREMIUM_USER)
    }

    await prisma.user.update({
      where: { id: idParsed.data },
      data: {
        isPremium: false,
        premiumExpiresAt: null,
      },
    })

    await prisma.adminLog.create({
      data: {
        adminId: adminId,
        action: ACTION_REVOKE_PREMIUM,
        targetType: 'user',
        targetId: idParsed.data,
      },
    })

    revalidatePath(ROUTE_ADMIN_PREMIUM)
    return actionSuccess()
  } catch (error) {
    logger.error('Revoke premium error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * プレミアム期限を延長する。期限が未来なら現在の期限から、
 * 期限切れ / 非プレミアムなら現在時刻から `additionalDays` 日加算する。
 */
export async function extendPremium(targetUserId: string, additionalDays: number) {
  const admin = await requireAdmin('premium:manage')
  if ('error' in admin) return actionError(admin.error)
  const adminId = admin.userId

  const idParsed = adminIdSchema.safeParse(targetUserId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)
  const daysParsed = premiumDurationDaysSchema.safeParse(additionalDays)
  if (!daysParsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: idParsed.data },
      select: { isPremium: true, premiumExpiresAt: true },
    })

    if (!targetUser) {
      return actionError(ERR_USER_NOT_FOUND)
    }

    const baseDate = targetUser.premiumExpiresAt && targetUser.premiumExpiresAt > new Date()
      ? targetUser.premiumExpiresAt
      : new Date()

    const newExpiresAt = new Date(baseDate)
    newExpiresAt.setDate(newExpiresAt.getDate() + daysParsed.data)

    await prisma.user.update({
      where: { id: idParsed.data },
      data: {
        isPremium: true,
        premiumExpiresAt: newExpiresAt,
      },
    })

    await prisma.adminLog.create({
      data: {
        adminId: adminId,
        action: ACTION_EXTEND_PREMIUM,
        targetType: 'user',
        targetId: idParsed.data,
        details: { additionalDays: daysParsed.data, newExpiresAt: newExpiresAt.toISOString() },
      },
    })

    revalidatePath(ROUTE_ADMIN_PREMIUM)
    return actionSuccess({ newExpiresAt })
  } catch (error) {
    logger.error('Extend premium error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * プレミアム会員一覧を取得する。
 * `premiumExpiresAt` 昇順 + `id` 昇順で並べ、期限が近いユーザーを優先表示する。
 */
export async function getPremiumUsers(options: { search?: string; limit?: number; cursor?: string } = {}) {
  const admin = await requireAdmin('premium:view')
  if ('error' in admin) return actionError(admin.error)

  const { search, limit = DEFAULT_PAGE_LIMIT, cursor } = options

  try {
    const where = {
      isPremium: true,
      ...(search && {
        OR: [
          { email: containsInsensitive(search) },
          { nickname: containsInsensitive(search) },
        ],
      }),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          nickname: true,
          avatarUrl: true,
          isPremium: true,
          premiumExpiresAt: true,
          stripeSubscriptionId: true,
          createdAt: true,
        },
        orderBy: [{ premiumExpiresAt: 'asc' }, { id: 'asc' }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.user.count({ where }),
    ])

    const nextCursor = users.length === limit ? users[users.length - 1]?.id : undefined
    return { users, total, nextCursor }
  } catch (error) {
    logger.error('Get premium users error', { error: error instanceof Error ? error.message : String(error) })
    return { users: [], total: 0, nextCursor: undefined }
  }
}

/**
 * プレミアム会員統計を取得する。管理ダッシュボード用。
 *
 * - `totalPremiumUsers`: `isPremium === true` の総数
 * - `newThisMonth`: 今月 1 日以降に作成された有料ユーザー
 * - `expiringIn7Days`: 期限が今日〜`PREMIUM_EXPIRING_WARN_DAYS` 日以内
 * - `totalRevenue`: `Payment.status === 'succeeded'` の合計
 */
export async function getPremiumStats() {
  const admin = await requireAdmin('premium:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const now = new Date()
    const sevenDaysLater = new Date()
    sevenDaysLater.setDate(sevenDaysLater.getDate() + PREMIUM_EXPIRING_WARN_DAYS)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [totalPremiumUsers, expiringIn7Days, newThisMonth, totalPayments] = await Promise.all([
      prisma.user.count({
        where: { isPremium: true },
      }),
      prisma.user.count({
        where: {
          isPremium: true,
          premiumExpiresAt: {
            gte: now,
            lte: sevenDaysLater,
          },
        },
      }),
      prisma.user.count({
        where: {
          isPremium: true,
          createdAt: { gte: monthStart },
        },
      }),
      prisma.payment.aggregate({
        where: { status: 'succeeded' },
        _sum: { amount: true },
      }),
    ])

    return {
      totalPremiumUsers,
      newThisMonth,
      expiringIn7Days,
      totalRevenue: totalPayments._sum.amount || 0,
    }
  } catch (error) {
    logger.error('Get premium stats error', { error: error instanceof Error ? error.message : String(error) })
    return { totalPremiumUsers: 0, newThisMonth: 0, expiringIn7Days: 0, totalRevenue: 0 }
  }
}

/**
 * プレミアム付与 / 取り消しの操作対象ユーザーを検索する。
 * `MIN_ADMIN_SEARCH_QUERY_LENGTH` 未満は空配列を返す（スキャン抑止）。
 */
export async function searchUserForPremium(query: string) {
  const admin = await requireAdmin('premium:view')
  if ('error' in admin) return actionError(admin.error)

  if (!query || query.length < MIN_ADMIN_SEARCH_QUERY_LENGTH) {
    return { users: [] }
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { nickname: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        isPremium: true,
        premiumExpiresAt: true,
      },
      take: ADMIN_PREMIUM_SEARCH_LIMIT,
    })

    return { users }
  } catch (error) {
    logger.error('Search user for premium error', { error: error instanceof Error ? error.message : String(error) })
    return { users: [] }
  }
}

/**
 * 管理者自身のプレミアム状態をトグルする。
 * 有料機能の動作確認・検証用途。期限は無期限（`null`）で運用する。
 */
export async function toggleAdminPremium() {
  const admin = await requireAdmin('premium:manage')
  if ('error' in admin) return actionError(admin.error)
  const adminId = admin.userId

  try {
    const user = await prisma.user.findUnique({
      where: { id: adminId },
      select: { isPremium: true },
    })

    if (!user) {
      return actionError(ERR_USER_NOT_FOUND)
    }

    const newIsPremium = !user.isPremium

    // ON / OFF 共通の update（`premiumExpiresAt` は両方とも null）。
    await prisma.user.update({
      where: { id: adminId },
      data: {
        isPremium: newIsPremium,
        premiumExpiresAt: null,
      },
    })

    await prisma.adminLog.create({
      data: {
        adminId: adminId,
        action: newIsPremium ? ACTION_GRANT_PREMIUM : ACTION_REVOKE_PREMIUM,
        targetType: 'user',
        targetId: adminId,
        details: { selfToggle: true, newState: newIsPremium },
      },
    })

    revalidatePath(ROUTE_ADMIN_PREMIUM)
    revalidatePath(ROUTE_FEED)
    return actionSuccess({ isPremium: newIsPremium })
  } catch (error) {
    logger.error('Toggle admin premium error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * 管理者自身のプレミアム状態を取得する。
 */
export async function getAdminPremiumStatus() {
  const admin = await requireAdmin('premium:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const user = await prisma.user.findUnique({
      where: { id: admin.userId },
      select: { isPremium: true, premiumExpiresAt: true },
    })

    if (!user) {
      return actionError(ERR_USER_NOT_FOUND)
    }

    return { isPremium: user.isPremium, premiumExpiresAt: user.premiumExpiresAt }
  } catch (error) {
    logger.error('Get admin premium status error', { error: error instanceof Error ? error.message : String(error) })
    return { isPremium: false, premiumExpiresAt: null }
  }
}
