'use server'

import { prisma } from '@/lib/db'
import { ADMIN_LOGS_PAGE_LIMIT } from '@/lib/constants/limits'
import { requireAdmin, actionError } from '@/lib/actions/utils'
import { ERR_OPERATION_FAILED } from '@/lib/constants/errors'
import { logger } from '@/lib/logger'
import { buildCursorPagination } from '@/lib/actions/pagination'

/**
 * 管理者操作ログをカーソルベースで取得する。
 *
 * @param options - フィルター・カーソルパラメータ
 * @returns ログ配列・総件数・次ページのカーソル
 *
 * @example
 * ```typescript
 * const { logs, total, nextCursor } = await getAdminLogs({
 *   action: 'suspend_user',
 *   limit: 50,
 * })
 * ```
 */
export async function getAdminLogs(options?: {
  action?: string
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('logs:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const { action, limit = ADMIN_LOGS_PAGE_LIMIT, cursor } = options || {}

    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        where: action ? { action } : undefined,
        include: {
          admin: {
            include: {
              user: { select: { id: true, nickname: true } },
            },
          },
        },
        // createdAt 同値時の順序を安定させるため id を第二キーに
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.adminLog.count({
        where: action ? { action } : undefined,
      }),
    ])

    const nextCursor = logs.length === limit ? logs[logs.length - 1]?.id : undefined

    return { logs, total, nextCursor }
  } catch (error) {
    logger.error('getAdminLogs failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}
