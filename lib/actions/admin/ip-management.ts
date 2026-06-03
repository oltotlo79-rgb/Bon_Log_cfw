'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  DEFAULT_PAGE_LIMIT,
  MULTI_ACCOUNT_DETECTION_LIMIT,
  MULTI_ACCOUNT_MIN_THRESHOLD,
} from '@/lib/constants/limits'
import { requireAdmin, actionError } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { ERR_OPERATION_FAILED } from '@/lib/constants/errors'
import { logger } from '@/lib/logger'

/**
 * IP アドレスごとのアクセス情報を取得
 */
export async function getIpAddresses(options?: {
  search?: string
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('ip:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const { search, limit = DEFAULT_PAGE_LIMIT, cursor } = options || {}

    const where: Prisma.UserDeviceWhereInput = {
      ipAddress: { not: null, ...(search ? { contains: search } : {}) },
    }

    const [rawDevices, total] = await Promise.all([
      prisma.userDevice.findMany({
        where,
        select: {
          id: true,
          ipAddress: true,
          userId: true,
          userAgent: true,
          lastSeenAt: true,
        },
        orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.userDevice.count({ where }),
    ])

    // ユーザー情報を別途取得
    const userIds = [...new Set(rawDevices.map(d => d.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nickname: true, email: true, avatarUrl: true, isSuspended: true },
    })
    const userMap = new Map(users.map(u => [u.id, u]))

    const devices = rawDevices.map(d => ({
      ...d,
      user: userMap.get(d.userId) || null,
    }))

    const nextCursor = rawDevices.length === limit ? rawDevices[rawDevices.length - 1]?.id : undefined
    return { devices, total, nextCursor }
  } catch (error) {
    logger.error('getIpAddresses failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * 同一IPから複数アカウントの検出（自作自演対策）
 */
export async function detectMultiAccounts() {
  const admin = await requireAdmin('ip:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    // IPアドレスごとにユーザー数を集計し、最小閾値以上のものを抽出
    const results = await prisma.$queryRaw<
      { ip_address: string; user_count: bigint; user_ids: string }[]
    >`
      SELECT ip_address, COUNT(DISTINCT user_id) as user_count,
             STRING_AGG(DISTINCT user_id, ',') as user_ids
      FROM user_devices
      WHERE ip_address IS NOT NULL AND ip_address != 'unknown'
      GROUP BY ip_address
      HAVING COUNT(DISTINCT user_id) >= ${MULTI_ACCOUNT_MIN_THRESHOLD}
      ORDER BY user_count DESC
      LIMIT ${MULTI_ACCOUNT_DETECTION_LIMIT}
    `

    const parsedResults = results.map(r => ({
      ...r,
      userIdList: r.user_ids.split(','),
    }))
    const allUserIds = parsedResults.flatMap(r => r.userIdList)
    const users = await prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, nickname: true, email: true, avatarUrl: true, isSuspended: true, createdAt: true },
    })

    const userMap = new Map(users.map(u => [u.id, u]))

    return {
      suspiciousIps: parsedResults.map(r => ({
        ipAddress: r.ip_address,
        userCount: Number(r.user_count),
        users: r.userIdList.map(id => userMap.get(id)).filter(Boolean),
      })),
    }
  } catch (error) {
    logger.error('detectMultiAccounts failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}
