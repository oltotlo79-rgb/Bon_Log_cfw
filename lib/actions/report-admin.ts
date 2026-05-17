/**
 * 通報管理（管理者向け）のServer Actions
 *
 * @module lib/actions/report-admin
 */

'use server'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_RELATION } from '@/lib/prisma/shared-includes'
import { revalidatePath } from 'next/cache'
import type { ReportTargetType, ReportStatus } from '@/lib/constants/report'
import { TARGET_TYPE_LABELS } from '@/lib/constants/report'
import { ADMIN_LOGS_PAGE_LIMIT } from '@/lib/constants/limits'
import { REPORT_STATUS } from '@/lib/constants/status'
import { ERR_REPORT_NOT_FOUND, ERR_DELETE_FAILED } from '@/lib/constants/errors'
import { requireAdmin, actionSuccess, actionError } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { ROUTE_ADMIN_REPORTS } from '@/lib/constants/routes'

/**
 * 通報一覧を取得（管理者用）。ステータスと対象種別でフィルター可能。
 */
export async function getReports(options?: {
  status?: ReportStatus
  targetType?: ReportTargetType
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('reports:view')
  if ('error' in admin) return actionError(admin.error)

  const { status, targetType, limit = ADMIN_LOGS_PAGE_LIMIT, cursor } = options || {}

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where: {
        ...(status && { status }),
        ...(targetType && { targetType }),
      },
      include: {
        reporter: USER_MINIMAL_RELATION,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...buildCursorPagination(cursor, limit),
    }),
    prisma.report.count({
      where: {
        ...(status && { status }),
        ...(targetType && { targetType }),
      },
    }),
  ])

  const nextCursor = reports.length === limit ? reports[reports.length - 1]?.id : undefined
  return { reports, total, nextCursor }
}

/**
 * 通報ステータスを更新（管理者用）。管理ログも同時に作成する。
 */
export async function updateReportStatus(reportId: string, status: ReportStatus, note?: string) {
  const admin = await requireAdmin('reports:action')
  if ('error' in admin) return actionError(admin.error)
  const adminUserId = admin.userId

  const report = await prisma.report.findUnique({ where: { id: reportId } })
  if (!report) return actionError(ERR_REPORT_NOT_FOUND)

  await prisma.$transaction([
    prisma.report.update({ where: { id: reportId }, data: { status } }),
    prisma.adminLog.create({
      data: {
        adminId: adminUserId,
        action: 'update_report_status',
        targetType: 'report',
        targetId: reportId,
        details: JSON.stringify({ previousStatus: report.status, newStatus: status, note }),
      },
    }),
  ])

  revalidatePath(ROUTE_ADMIN_REPORTS)
  return actionSuccess()
}

/**
 * 通報対象のコンテンツを削除（管理者用）。
 * user の場合は削除ではなくアカウント停止処理となる。
 */
export async function deleteReportedContent(targetType: ReportTargetType, targetId: string) {
  const admin = await requireAdmin('reports:action')
  if ('error' in admin) return actionError(admin.error)
  const adminUserId = admin.userId

  try {
    switch (targetType) {
      case 'post':
        await prisma.post.delete({ where: { id: targetId } })
        break
      case 'comment':
        await prisma.comment.delete({ where: { id: targetId } })
        break
      case 'event':
        await prisma.event.delete({ where: { id: targetId } })
        break
      case 'shop':
        await prisma.bonsaiShop.delete({ where: { id: targetId } })
        break
      case 'review':
        await prisma.shopReview.delete({ where: { id: targetId } })
        break
      case 'user':
        await prisma.user.update({
          where: { id: targetId },
          data: { isSuspended: true, suspendedAt: new Date() },
        })
        break
    }

    await prisma.report.deleteMany({ where: { targetType, targetId } })

    const label = TARGET_TYPE_LABELS[targetType]
    await prisma.adminLog.create({
      data: {
        adminId: adminUserId,
        action: targetType === 'user' ? 'suspend_user' : 'delete_content',
        targetType,
        targetId,
        details: JSON.stringify({
          action: targetType === 'user' ? 'アカウント停止' : `${label}を削除`,
        }),
      },
    })

    revalidatePath(ROUTE_ADMIN_REPORTS)
    return actionSuccess()
  } catch {
    return actionError(ERR_DELETE_FAILED)
  }
}

/**
 * 通報レコードを削除（管理者用）。コンテンツ自体は削除しない。
 */
export async function deleteReport(reportId: string) {
  const admin = await requireAdmin('reports:action')
  if ('error' in admin) return actionError(admin.error)
  const adminUserId = admin.userId

  try {
    await prisma.report.delete({ where: { id: reportId } })

    await prisma.adminLog.create({
      data: {
        adminId: adminUserId,
        action: 'delete_report',
        targetType: 'report',
        targetId: reportId,
        details: JSON.stringify({ action: '通報レコードを削除' }),
      },
    })

    revalidatePath(ROUTE_ADMIN_REPORTS)
    return actionSuccess()
  } catch {
    return actionError(ERR_DELETE_FAILED)
  }
}

/**
 * 通報統計を取得（管理ダッシュボード用）。
 */
export async function getReportStats() {
  const admin = await requireAdmin('reports:view')
  if ('error' in admin) return actionError(admin.error)

  const [pending, reviewed, resolved, dismissed, byType] = await Promise.all([
    prisma.report.count({ where: { status: REPORT_STATUS.PENDING } }),
    prisma.report.count({ where: { status: REPORT_STATUS.REVIEWED } }),
    prisma.report.count({ where: { status: REPORT_STATUS.RESOLVED } }),
    prisma.report.count({ where: { status: REPORT_STATUS.DISMISSED } }),
    prisma.report.groupBy({ by: ['targetType'], _count: true }),
  ])

  return {
    stats: {
      pending,
      reviewed,
      resolved,
      dismissed,
      total: pending + reviewed + resolved + dismissed,
      byType: byType.reduce((acc: Record<string, number>, item: { targetType: string; _count: number }) => {
        acc[item.targetType] = item._count
        return acc
      }, {}),
    },
  }
}
