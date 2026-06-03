'use server'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { revalidatePath } from 'next/cache'
import { revalidateShopRatingsCache } from '@/lib/cache'
import { DEFAULT_PAGE_LIMIT, MAX_RELATION_FETCH } from '@/lib/constants/limits'
import { requireAdmin, actionSuccess, actionError } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { ERR_EVENT_NOT_FOUND, ERR_SHOP_NOT_FOUND, ERR_REVIEW_NOT_FOUND, ERR_OPERATION_FAILED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_ADMIN_EVENTS, ROUTE_ADMIN_SHOPS, ROUTE_ADMIN_REVIEWS } from '@/lib/constants/routes'
import { logger } from '@/lib/logger'
import { adminIdSchema, adminReasonSchema } from './_schemas'

export async function deleteEventByAdmin(eventId: string, reason: string) {
  const admin = await requireAdmin('events:manage')
  if ('error' in admin) return actionError(admin.error)
  const adminUserId = admin.userId

  const idParsed = adminIdSchema.safeParse(eventId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)
  const reasonParsed = adminReasonSchema.safeParse(reason)
  if (!reasonParsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const event = await prisma.event.findUnique({
      where: { id: idParsed.data },
    })

    if (!event) {
      return actionError(ERR_EVENT_NOT_FOUND)
    }

    await prisma.$transaction([
      prisma.event.delete({
        where: { id: idParsed.data },
      }),
      prisma.adminLog.create({
        data: {
          adminId: adminUserId,
          action: 'delete_event',
          targetType: 'event',
          targetId: idParsed.data,
          details: JSON.stringify({ reason: reasonParsed.data }),
        },
      }),
    ])

    revalidatePath(ROUTE_ADMIN_EVENTS)
    return actionSuccess()
  } catch (error) {
    logger.error('deleteEventByAdmin failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function deleteShopByAdmin(shopId: string, reason: string) {
  const admin = await requireAdmin('shops:manage')
  if ('error' in admin) return actionError(admin.error)
  const adminUserId = admin.userId

  const idParsed = adminIdSchema.safeParse(shopId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)
  const reasonParsed = adminReasonSchema.safeParse(reason)
  if (!reasonParsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const shop = await prisma.bonsaiShop.findUnique({
      where: { id: idParsed.data },
    })

    if (!shop) {
      return actionError(ERR_SHOP_NOT_FOUND)
    }

    await prisma.$transaction([
      prisma.bonsaiShop.delete({
        where: { id: idParsed.data },
      }),
      prisma.adminLog.create({
        data: {
          adminId: adminUserId,
          action: 'delete_shop',
          targetType: 'shop',
          targetId: idParsed.data,
          details: JSON.stringify({ reason: reasonParsed.data }),
        },
      }),
    ])

    revalidatePath(ROUTE_ADMIN_SHOPS)
    return actionSuccess()
  } catch (error) {
    logger.error('deleteShopByAdmin failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function getAdminReviews(options?: {
  search?: string
  hasReports?: boolean
  sortBy?: 'createdAt' | 'rating' | 'reportCount'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('shops:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const {
      search,
      hasReports = false,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = DEFAULT_PAGE_LIMIT,
      cursor,
    } = options || {}

    // 通報されたレビューIDを取得（hasReportsがtrueの場合）
    let reportedReviewIds: string[] = []
    if (hasReports) {
      const reports = await prisma.report.findMany({
        where: { targetType: 'review' },
        select: { targetId: true },
        distinct: ['targetId'],
        take: MAX_RELATION_FETCH,
      })
      reportedReviewIds = reports.map((r: typeof reports[number]) => r.targetId)
    }

    // 検索条件の構築
    const where = {
      ...(search && {
        content: { contains: search },
      }),
      ...(hasReports && {
        id: { in: reportedReviewIds },
      }),
    }

    const [reviews, total] = await Promise.all([
      prisma.shopReview.findMany({
        where,
        select: {
          id: true,
          content: true,
          rating: true,
          isHidden: true,
          createdAt: true,
          user: {
            select: USER_MINIMAL_SELECT,
          },
          shop: {
            select: { id: true, name: true },
          },
        },
        orderBy:
          sortBy === 'rating'
            ? [{ rating: sortOrder }, { id: sortOrder }]
            : [{ [sortBy]: sortOrder }, { id: sortOrder }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.shopReview.count({ where }),
    ])

    // 各レビューの通報件数を一括取得（N+1回避）
    const reviewIds = reviews.map((review: typeof reviews[number]) => review.id)
    const reportCounts = reviewIds.length > 0
      ? await prisma.report.groupBy({
          by: ['targetId'],
          where: { targetType: 'review', targetId: { in: reviewIds } },
          _count: { targetId: true },
        })
      : []

    const reportCountMap = new Map(
      reportCounts.map((r: { targetId: string; _count: { targetId: number } }) => [r.targetId, r._count.targetId] as const)
    )

    const reviewsWithReportCount = reviews.map((review: typeof reviews[number]) => ({
      ...review,
      reportCount: reportCountMap.get(review.id) ?? 0,
    }))

    const nextCursor = reviews.length === limit ? reviews[reviews.length - 1]?.id : undefined
    return actionSuccess({ reviews: reviewsWithReportCount, total, nextCursor })
  } catch (error) {
    logger.error('getAdminReviews failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function deleteReviewByAdmin(reviewId: string, reason: string) {
  const admin = await requireAdmin('shops:manage')
  if ('error' in admin) return actionError(admin.error)
  const adminUserId = admin.userId

  const idParsed = adminIdSchema.safeParse(reviewId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)
  const reasonParsed = adminReasonSchema.safeParse(reason)
  if (!reasonParsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const review = await prisma.shopReview.findUnique({
      where: { id: idParsed.data },
    })

    if (!review) {
      return actionError(ERR_REVIEW_NOT_FOUND)
    }

    await prisma.$transaction([
      prisma.shopReview.delete({
        where: { id: idParsed.data },
      }),
      prisma.adminLog.create({
        data: {
          adminId: adminUserId,
          action: 'delete_review',
          targetType: 'review',
          targetId: idParsed.data,
          details: JSON.stringify({ reason: reasonParsed.data }),
        },
      }),
    ])

    // review 削除は店舗一覧の集計平均（getCachedShopRatings）に影響するため無効化する
    revalidateShopRatingsCache()
    revalidatePath(ROUTE_ADMIN_REVIEWS)
    return actionSuccess()
  } catch (error) {
    logger.error('deleteReviewByAdmin failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}
