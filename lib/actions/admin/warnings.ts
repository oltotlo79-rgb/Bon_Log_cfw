'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { requireAdmin, actionSuccess, actionError } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
import {
  ERR_USER_NOT_FOUND,
  ERR_WARNING_NOT_FOUND,
  ERR_CANNOT_WARN_ADMIN,
  ERR_OPERATION_FAILED,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'
import { ROUTE_ADMIN_WARNINGS, ROUTE_ADMIN_USERS } from '@/lib/constants/routes'
import { logger } from '@/lib/logger'
import {
  ACTION_ISSUE_WARNING,
  ACTION_DEACTIVATE_WARNING,
} from '@/lib/constants/admin-actions'
import { WarningLevel } from '@prisma/client'
import { adminIdSchema, adminOptionalIdSchema, adminWarningReasonSchema } from './_schemas'

const issueWarningSchema = z.object({
  userId: adminIdSchema,
  level: z.nativeEnum(WarningLevel),
  reason: adminWarningReasonSchema,
  // 関連通報 ID は省略可・空文字可（後段で `|| null` に正規化）
  relatedReportId: adminOptionalIdSchema,
  expiresAt: z.string().optional(),
})

export async function getWarnings(options?: {
  userId?: string
  level?: WarningLevel
  isActive?: boolean
  search?: string
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('warnings:view')
  if ('error' in admin) return actionError(admin.error)

  const {
    userId,
    level,
    isActive,
    search,
    limit = DEFAULT_PAGE_LIMIT,
    cursor,
  } = options || {}

  try {
    const where = {
      ...(userId && { userId }),
      ...(level && { level }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        user: {
          OR: [
            { nickname: { contains: search } },
            { email: { contains: search } },
          ],
        },
      }),
    }

    const [warnings, total] = await Promise.all([
      prisma.userWarning.findMany({
        where,
        include: {
          user: { select: { id: true, nickname: true, email: true, avatarUrl: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.userWarning.count({ where }),
    ])

    const nextCursor = warnings.length === limit ? warnings[warnings.length - 1]?.id : undefined
    return { warnings, total, nextCursor }
  } catch (error) {
    logger.error('Get warnings error', { error: error instanceof Error ? error.message : String(error) })
    return { warnings: [], total: 0, nextCursor: undefined }
  }
}

export async function issueWarning(data: {
  userId: string
  level: WarningLevel
  reason: string
  relatedReportId?: string
  expiresAt?: string
}) {
  const admin = await requireAdmin('warnings:issue')
  if ('error' in admin) return actionError(admin.error)

  const parsed = issueWarningSchema.safeParse(data)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  const input = parsed.data

  try {
    const user = await prisma.user.findUnique({ where: { id: input.userId } })
    if (!user) return actionError(ERR_USER_NOT_FOUND)

    const targetAdmin = await prisma.adminUser.findUnique({ where: { userId: input.userId } })
    if (targetAdmin) return actionError(ERR_CANNOT_WARN_ADMIN)

    const warningData = {
      userId: input.userId,
      level: input.level,
      reason: input.reason,
      relatedReportId: input.relatedReportId || null,
      issuedBy: admin.userId,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    }

    // temp_suspend / permanent_ban は対象ユーザーを即停止する。
    const shouldSuspend = input.level === 'temp_suspend' || input.level === 'permanent_ban'

    await prisma.$transaction([
      prisma.userWarning.create({ data: warningData }),
      ...(shouldSuspend
        ? [
            prisma.user.update({
              where: { id: input.userId },
              data: { isSuspended: true, suspendedAt: new Date() },
            }),
          ]
        : []),
      prisma.adminLog.create({
        data: {
          adminId: admin.userId,
          action: ACTION_ISSUE_WARNING,
          targetType: 'user',
          targetId: input.userId,
          details: JSON.stringify({
            level: input.level,
            reason: input.reason,
          }),
        },
      }),
    ])

    revalidatePath(ROUTE_ADMIN_WARNINGS)
    revalidatePath(ROUTE_ADMIN_USERS)
    return actionSuccess()
  } catch (error) {
    logger.error('Issue warning error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function deactivateWarning(warningId: string) {
  const admin = await requireAdmin('warnings:issue')
  if ('error' in admin) return actionError(admin.error)

  const parsed = adminIdSchema.safeParse(warningId)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const warning = await prisma.userWarning.findUnique({ where: { id: parsed.data } })
    if (!warning) return actionError(ERR_WARNING_NOT_FOUND)

    await prisma.$transaction([
      prisma.userWarning.update({
        where: { id: parsed.data },
        data: { isActive: false },
      }),
      prisma.adminLog.create({
        data: {
          adminId: admin.userId,
          action: ACTION_DEACTIVATE_WARNING,
          targetType: 'user',
          targetId: warning.userId,
          details: JSON.stringify({ warningId: parsed.data }),
        },
      }),
    ])

    revalidatePath(ROUTE_ADMIN_WARNINGS)
    return actionSuccess()
  } catch (error) {
    logger.error('Deactivate warning error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function getUserWarningsSummary(userId: string) {
  const admin = await requireAdmin('warnings:view')
  if ('error' in admin) return actionError(admin.error)

  const parsed = adminIdSchema.safeParse(userId)
  if (!parsed.success) return { total: 0, active: 0, byLevel: {} }
  userId = parsed.data

  try {
    const [total, active, byLevel] = await Promise.all([
      prisma.userWarning.count({ where: { userId } }),
      prisma.userWarning.count({ where: { userId, isActive: true } }),
      prisma.userWarning.groupBy({
        by: ['level'],
        where: { userId, isActive: true },
        _count: true,
      }),
    ])

    return {
      total,
      active,
      byLevel: byLevel.reduce<Record<string, number>>(
        (acc, item) => ({ ...acc, [item.level]: item._count }),
        {}
      ),
    }
  } catch (error) {
    logger.error('Get user warnings summary error', { error: error instanceof Error ? error.message : String(error) })
    return { total: 0, active: 0, byLevel: {} }
  }
}
