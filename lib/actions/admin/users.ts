'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { DEFAULT_PAGE_LIMIT, MAX_RELATION_FETCH } from '@/lib/constants/limits'
import { requireAdmin, actionSuccess, actionError } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { ERR_USER_NOT_FOUND, ERR_USER_ALREADY_SUSPENDED, ERR_USER_NOT_SUSPENDED, ERR_CANNOT_DELETE_SELF, ERR_CANNOT_DELETE_ADMIN, ERR_OPERATION_FAILED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_ADMIN_USERS } from '@/lib/constants/routes'
import { ACTION_SUSPEND_USER, ACTION_ACTIVATE_USER, ACTION_DELETE_USER } from '@/lib/constants/admin-actions'
import { logger } from '@/lib/logger'
import { ReportTargetType } from '@prisma/client'
import { recalculateHashtagCountsCore } from '@/lib/services/hashtag-recount'
import { adminIdSchema, adminReasonSchema } from './_schemas'

export async function getAdminUsers(options?: {
  search?: string
  status?: 'all' | 'active' | 'suspended'
  sortBy?: 'createdAt' | 'postCount' | 'nickname'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('users:view')
  if ('error' in admin) return actionError(admin.error)

  const {
    search,
    status = 'all',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    limit = DEFAULT_PAGE_LIMIT,
    cursor,
  } = options || {}

  try {
    const where = {
      ...(search && {
        OR: [
          { nickname: { contains: search } },
          { email: { contains: search } },
        ],
      }),
      ...(status === 'suspended' && { isSuspended: true }),
      ...(status === 'active' && { isSuspended: false }),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          nickname: true,
          avatarUrl: true,
          createdAt: true,
          isSuspended: true,
          suspendedAt: true,
          _count: {
            select: { posts: true },
          },
        },
        // id を第二キーにして同値時の順序を安定化
        orderBy:
          sortBy === 'postCount'
            ? [{ posts: { _count: sortOrder } }, { id: sortOrder }]
            : [{ [sortBy]: sortOrder }, { id: sortOrder }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.user.count({ where }),
    ])

    const nextCursor = users.length === limit ? users[users.length - 1]?.id : undefined
    return { users, total, nextCursor }
  } catch (error) {
    logger.error('Get admin users error', { error: error instanceof Error ? error.message : String(error) })
    return { users: [], total: 0, nextCursor: undefined }
  }
}

/**
 * ユーザー詳細情報を取得（管理者用）。通報件数も併せて返す。
 */
export async function getAdminUserDetail(userId: string) {
  const admin = await requireAdmin('users:view')
  if ('error' in admin) return actionError(admin.error)

  const parsed = adminIdSchema.safeParse(userId)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const user = await prisma.user.findUnique({
      where: { id: parsed.data },
      include: {
        _count: {
          select: {
            posts: true,
            comments: true,
            followers: true,
            following: true,
          },
        },
      },
    })

    if (!user) {
      return actionError(ERR_USER_NOT_FOUND)
    }

    const userPostIds = await prisma.post
      .findMany({ where: { userId: parsed.data }, select: { id: true }, take: MAX_RELATION_FETCH })
      .then((posts: { id: string }[]) => posts.map((p: { id: string }) => p.id))

    const reportCount = await prisma.report.count({
      where: {
        OR: [
          { targetType: ReportTargetType.user, targetId: parsed.data },
          ...(userPostIds.length > 0
            ? [{ targetType: ReportTargetType.post, targetId: { in: userPostIds } }]
            : []),
        ],
      },
    })

    return { user, reportCount }
  } catch (error) {
    logger.error('Get admin user detail error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * ユーザーを一時停止する。`reason` は AdminLog の details に記録する。
 *
 * Why no rate limit: admin 操作で対象 1 件あたり 1 リクエスト、UI 上もボタンクリック単位の
 * 操作。`requireAdmin('users:suspend')` で十分な権限ゲートが入っている。
 */
export async function suspendUser(userId: string, reason: string) {
  const admin = await requireAdmin('users:suspend')
  if ('error' in admin) return actionError(admin.error)
  const adminUserId = admin.userId

  const idParsed = adminIdSchema.safeParse(userId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)
  const reasonParsed = adminReasonSchema.safeParse(reason)
  if (!reasonParsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const user = await prisma.user.findUnique({
      where: { id: idParsed.data },
    })

    if (!user) {
      return actionError(ERR_USER_NOT_FOUND)
    }

    if (user.isSuspended) {
      return actionError(ERR_USER_ALREADY_SUSPENDED)
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: idParsed.data },
        data: {
          isSuspended: true,
          suspendedAt: new Date(),
        },
      }),
      prisma.adminLog.create({
        data: {
          adminId: adminUserId,
          action: ACTION_SUSPEND_USER,
          targetType: 'user',
          targetId: idParsed.data,
          details: JSON.stringify({ reason: reasonParsed.data }),
        },
      }),
    ])

    revalidatePath(ROUTE_ADMIN_USERS)
    return actionSuccess()
  } catch (error) {
    logger.error('Suspend user error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function activateUser(userId: string) {
  const admin = await requireAdmin('users:suspend')
  if ('error' in admin) return actionError(admin.error)
  const adminUserId = admin.userId

  const idParsed = adminIdSchema.safeParse(userId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const user = await prisma.user.findUnique({
      where: { id: idParsed.data },
    })

    if (!user) {
      return actionError(ERR_USER_NOT_FOUND)
    }

    if (!user.isSuspended) {
      return actionError(ERR_USER_NOT_SUSPENDED)
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: idParsed.data },
        data: {
          isSuspended: false,
          suspendedAt: null,
        },
      }),
      prisma.adminLog.create({
        data: {
          adminId: adminUserId,
          action: ACTION_ACTIVATE_USER,
          targetType: 'user',
          targetId: idParsed.data,
          details: JSON.stringify({}),
        },
      }),
    ])

    revalidatePath(ROUTE_ADMIN_USERS)
    return actionSuccess()
  } catch (error) {
    logger.error('Activate user error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * ユーザーを完全削除する（カスケード削除）。
 *
 * Why "完全削除" を分けて持つ:
 *   - 通常運用は `suspendUser` を推奨。
 *   - GDPR 等のデータ削除要求や明らかな悪質アカウントの除去にこの API を使う。
 *
 * 安全装置:
 *   - 自分自身は削除不可
 *   - 管理者ユーザーは削除不可
 *   - カスケード削除後にハッシュタグカウントを再計算（孤立カウントを残さない）
 */
export async function deleteUserByAdmin(userId: string, reason: string) {
  const admin = await requireAdmin('users:delete')
  if ('error' in admin) return actionError(admin.error)
  const adminUserId = admin.userId

  const idParsed = adminIdSchema.safeParse(userId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)
  const reasonParsed = adminReasonSchema.safeParse(reason)
  if (!reasonParsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const user = await prisma.user.findUnique({
      where: { id: idParsed.data },
    })

    if (!user) {
      return actionError(ERR_USER_NOT_FOUND)
    }

    if (idParsed.data === adminUserId) {
      return actionError(ERR_CANNOT_DELETE_SELF)
    }

    const targetAdminUser = await prisma.adminUser.findUnique({
      where: { userId: idParsed.data },
    })

    if (targetAdminUser) {
      return actionError(ERR_CANNOT_DELETE_ADMIN)
    }

    await prisma.$transaction([
      prisma.user.delete({
        where: { id: idParsed.data },
      }),
      prisma.adminLog.create({
        data: {
          adminId: adminUserId,
          action: ACTION_DELETE_USER,
          targetType: 'user',
          targetId: idParsed.data,
          details: JSON.stringify({ reason: reasonParsed.data, deletedEmail: user.email, deletedNickname: user.nickname }),
        },
      }),
    ])

    await recalculateHashtagCountsCore()

    revalidatePath(ROUTE_ADMIN_USERS)
    return actionSuccess()
  } catch (error) {
    logger.error('Delete user by admin error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}
