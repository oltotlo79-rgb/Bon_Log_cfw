'use server'

import { prisma } from '@/lib/db'
import { DEFAULT_PAGE_LIMIT, ONE_DAY_MS, TOP_FAILED_IPS_LIMIT } from '@/lib/constants/limits'
import { requireAdmin, actionError } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { logger } from '@/lib/logger'
import {
  SECURITY_EVENT_FAILED_LOGIN,
  SECURITY_EVENT_PASSWORD_CHANGE,
  SECURITY_EVENT_2FA_TOGGLE,
} from '@/lib/constants/admin-actions'

/**
 * セキュリティイベント一覧を取得
 */
export async function getSecurityEvents(options?: {
  eventType?: string
  userId?: string
  ipAddress?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('security:view')
  if ('error' in admin) return actionError(admin.error)

  const {
    eventType,
    userId,
    ipAddress,
    dateFrom,
    dateTo,
    limit = DEFAULT_PAGE_LIMIT,
    cursor,
  } = options || {}

  try {
    const where = {
      ...(eventType && { eventType }),
      ...(userId && { userId }),
      ...(ipAddress && { ipAddress: { contains: ipAddress } }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    }

    const [events, total] = await Promise.all([
      prisma.securityEvent.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.securityEvent.count({ where }),
    ])

    const nextCursor = events.length === limit ? events[events.length - 1]?.id : undefined
    return { events, total, nextCursor }
  } catch (error) {
    logger.error('Get security events error', { error: error instanceof Error ? error.message : String(error) })
    return { events: [], total: 0, nextCursor: undefined }
  }
}

/**
 * セキュリティダッシュボードサマリー
 */
export async function getSecurityDashboard() {
  const admin = await requireAdmin('security:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const oneDayAgo = new Date(Date.now() - ONE_DAY_MS)
    const oneWeekAgo = new Date(Date.now() - 7 * ONE_DAY_MS)

    const [
      failedLoginsToday,
      failedLoginsWeek,
      passwordChangesToday,
      twoFactorTogglesToday,
      eventsByType,
      topFailedIps,
    ] = await Promise.all([
      prisma.securityEvent.count({
        where: { eventType: SECURITY_EVENT_FAILED_LOGIN, createdAt: { gte: oneDayAgo } },
      }),
      prisma.securityEvent.count({
        where: { eventType: SECURITY_EVENT_FAILED_LOGIN, createdAt: { gte: oneWeekAgo } },
      }),
      prisma.securityEvent.count({
        where: { eventType: SECURITY_EVENT_PASSWORD_CHANGE, createdAt: { gte: oneDayAgo } },
      }),
      prisma.securityEvent.count({
        where: { eventType: SECURITY_EVENT_2FA_TOGGLE, createdAt: { gte: oneDayAgo } },
      }),
      // イベント種別ごとの週間カウント
      prisma.securityEvent.groupBy({
        by: ['eventType'],
        where: { createdAt: { gte: oneWeekAgo } },
        _count: true,
        orderBy: { _count: { eventType: 'desc' } },
      }),
      // 失敗ログインが多いIPアドレス
      prisma.$queryRaw<{ ip_address: string; cnt: bigint }[]>`
        SELECT ip_address, COUNT(*) as cnt
        FROM security_events
        WHERE event_type = 'failed_login'
          AND created_at >= ${oneDayAgo}
          AND ip_address IS NOT NULL
        GROUP BY ip_address
        ORDER BY cnt DESC
        LIMIT ${TOP_FAILED_IPS_LIMIT}
      `,
    ])

    return {
      failedLoginsToday,
      failedLoginsWeek,
      passwordChangesToday,
      twoFactorTogglesToday,
      eventsByType: eventsByType.map(e => ({ type: e.eventType, count: e._count })),
      topFailedIps: topFailedIps.map(ip => ({ ipAddress: ip.ip_address, count: Number(ip.cnt) })),
    }
  } catch (error) {
    logger.error('Get security dashboard error', { error: error instanceof Error ? error.message : String(error) })
    return {
      failedLoginsToday: 0,
      failedLoginsWeek: 0,
      passwordChangesToday: 0,
      twoFactorTogglesToday: 0,
      eventsByType: [],
      topFailedIps: [],
    }
  }
}
