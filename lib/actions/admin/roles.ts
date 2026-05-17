'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireAdmin, actionSuccess, actionError } from '@/lib/actions/utils'
import { ACTION_UPDATE_ADMIN_ROLE, ACTION_ADD_ADMIN, ACTION_REMOVE_ADMIN } from '@/lib/constants/admin-actions'
import { ERR_USER_NOT_FOUND, ERR_CANNOT_CHANGE_OWN_ROLE, ERR_CANNOT_MANAGE_HIGHER_ROLE, ERR_OPERATION_FAILED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_ADMIN_ROLES } from '@/lib/constants/routes'
import { logger } from '@/lib/logger'
import { canManageRole } from '@/lib/admin-permissions'
import { AdminRole } from '@prisma/client'
import { adminIdSchema } from './_schemas'

const adminRoleSchema = z.nativeEnum(AdminRole)

/**
 * 管理者一覧を取得
 */
export async function getAdminRoles() {
  const admin = await requireAdmin('roles:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const admins = await prisma.adminUser.findMany({
      include: {
        user: {
          select: { id: true, nickname: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return { admins }
  } catch (error) {
    logger.error('Get admin roles error', { error: error instanceof Error ? error.message : String(error) })
    return { admins: [] }
  }
}

export async function updateAdminRole(targetUserId: string, newRole: AdminRole) {
  const admin = await requireAdmin('roles:manage')
  if ('error' in admin) return actionError(admin.error)

  const idParsed = adminIdSchema.safeParse(targetUserId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)
  const roleParsed = adminRoleSchema.safeParse(newRole)
  if (!roleParsed.success) return actionError(ERR_INVALID_INPUT)

  if (idParsed.data === admin.userId) {
    return actionError(ERR_CANNOT_CHANGE_OWN_ROLE)
  }

  try {
    const targetAdmin = await prisma.adminUser.findUnique({ where: { userId: idParsed.data } })
    if (!targetAdmin) return actionError(ERR_USER_NOT_FOUND)

    // 自分より高い権限のロールは変更不可（権限昇格防止）。
    if (!canManageRole(admin.role, targetAdmin.role)) {
      return actionError(ERR_CANNOT_MANAGE_HIGHER_ROLE)
    }
    if (!canManageRole(admin.role, roleParsed.data)) {
      return actionError(ERR_CANNOT_MANAGE_HIGHER_ROLE)
    }

    await prisma.$transaction([
      prisma.adminUser.update({
        where: { userId: idParsed.data },
        data: { role: roleParsed.data },
      }),
      prisma.adminLog.create({
        data: {
          adminId: admin.userId,
          action: ACTION_UPDATE_ADMIN_ROLE,
          targetType: 'user',
          targetId: idParsed.data,
          details: JSON.stringify({ oldRole: targetAdmin.role, newRole: roleParsed.data }),
        },
      }),
    ])

    revalidatePath(ROUTE_ADMIN_ROLES)
    return actionSuccess()
  } catch (error) {
    logger.error('Update admin role error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function addAdmin(userId: string, role: AdminRole) {
  const admin = await requireAdmin('roles:manage')
  if ('error' in admin) return actionError(admin.error)

  const idParsed = adminIdSchema.safeParse(userId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)
  const roleParsed = adminRoleSchema.safeParse(role)
  if (!roleParsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const user = await prisma.user.findUnique({ where: { id: idParsed.data } })
    if (!user) return actionError(ERR_USER_NOT_FOUND)

    if (!canManageRole(admin.role, roleParsed.data)) {
      return actionError(ERR_CANNOT_MANAGE_HIGHER_ROLE)
    }

    await prisma.$transaction([
      prisma.adminUser.create({
        data: { userId: idParsed.data, role: roleParsed.data },
      }),
      prisma.adminLog.create({
        data: {
          adminId: admin.userId,
          action: ACTION_ADD_ADMIN,
          targetType: 'user',
          targetId: idParsed.data,
          details: JSON.stringify({ role: roleParsed.data }),
        },
      }),
    ])

    revalidatePath(ROUTE_ADMIN_ROLES)
    return actionSuccess()
  } catch (error) {
    logger.error('Add admin error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function removeAdmin(targetUserId: string) {
  const admin = await requireAdmin('roles:manage')
  if ('error' in admin) return actionError(admin.error)

  const idParsed = adminIdSchema.safeParse(targetUserId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)

  if (idParsed.data === admin.userId) {
    return actionError(ERR_CANNOT_CHANGE_OWN_ROLE)
  }

  try {
    const targetAdmin = await prisma.adminUser.findUnique({ where: { userId: idParsed.data } })
    if (!targetAdmin) return actionError(ERR_USER_NOT_FOUND)

    if (!canManageRole(admin.role, targetAdmin.role)) {
      return actionError(ERR_CANNOT_MANAGE_HIGHER_ROLE)
    }

    await prisma.$transaction([
      prisma.adminUser.delete({ where: { userId: idParsed.data } }),
      prisma.adminLog.create({
        data: {
          adminId: admin.userId,
          action: ACTION_REMOVE_ADMIN,
          targetType: 'user',
          targetId: idParsed.data,
          details: JSON.stringify({ removedRole: targetAdmin.role }),
        },
      }),
    ])

    revalidatePath(ROUTE_ADMIN_ROLES)
    return actionSuccess()
  } catch (error) {
    logger.error('Remove admin error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}
