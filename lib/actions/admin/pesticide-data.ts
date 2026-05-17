'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import {
  DEFAULT_PAGE_LIMIT,
  PESTICIDE_DETAIL_HISTORY_LIMIT,
  MAX_PESTICIDE_LIST_LIMIT,
  MAX_PESTICIDE_NAME_LENGTH,
  MAX_PESTICIDE_REGISTRATION_NUMBER_LENGTH,
  MAX_PESTICIDE_DESCRIPTION_LENGTH,
  MAX_SLUG_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
} from '@/lib/constants/limits'
import { ACTION_CREATE_PESTICIDE, ACTION_UPDATE_PESTICIDE, ACTION_DELETE_PESTICIDE } from '@/lib/constants/admin-actions'
import { requireAdmin, actionSuccess, actionError } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
import {
  ERR_PESTICIDE_NOT_FOUND,
  ERR_PESTICIDE_NAME_REQUIRED,
  ERR_OPERATION_FAILED,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'
import { ROUTE_ADMIN_PESTICIDE_DATA } from '@/lib/constants/routes'
import { logger } from '@/lib/logger'
import { PesticideType } from '@prisma/client'

const pesticideIdSchema = z.string().min(1).max(MAX_SLUG_LENGTH)

const pesticideTypeSchema = z.nativeEnum(PesticideType)

const pesticideNameSchema = z
  .string()
  .trim()
  .min(1, { message: ERR_PESTICIDE_NAME_REQUIRED })
  .max(MAX_PESTICIDE_NAME_LENGTH)

const pesticideRegistrationNumberSchema = z
  .string()
  .trim()
  .max(MAX_PESTICIDE_REGISTRATION_NUMBER_LENGTH)

const pesticideDescriptionSchema = z
  .string()
  .max(MAX_PESTICIDE_DESCRIPTION_LENGTH)

const pesticideSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SLUG_LENGTH)
  .regex(/^[a-z0-9-]+$/, { message: ERR_INVALID_INPUT })

const formulationTypeIdSchema = z.string().min(1).max(MAX_SLUG_LENGTH)

const getAdminPesticidesSchema = z.object({
  search: z.string().max(MAX_SEARCH_QUERY_LENGTH).optional(),
  pesticideType: pesticideTypeSchema.optional(),
  limit: z.number().int().positive().max(MAX_PESTICIDE_LIST_LIMIT).optional(),
  cursor: z.string().max(MAX_SLUG_LENGTH).optional(),
})

const createPesticideSchema = z.object({
  name: pesticideNameSchema,
  registrationNumber: pesticideRegistrationNumberSchema.optional(),
  pesticideType: pesticideTypeSchema,
  formulationTypeId: formulationTypeIdSchema.optional(),
  description: pesticideDescriptionSchema.optional(),
  slug: pesticideSlugSchema,
})

const updatePesticideSchema = z.object({
  name: pesticideNameSchema.optional(),
  registrationNumber: pesticideRegistrationNumberSchema.nullable().optional(),
  pesticideType: pesticideTypeSchema.optional(),
  formulationTypeId: formulationTypeIdSchema.nullable().optional(),
  description: pesticideDescriptionSchema.nullable().optional(),
})

const getPesticideHistorySchema = z.object({
  pesticideId: pesticideIdSchema.optional(),
  limit: z.number().int().positive().max(MAX_PESTICIDE_LIST_LIMIT).optional(),
  cursor: z.string().max(MAX_SLUG_LENGTH).optional(),
})

/**
 * 農薬一覧を取得
 */
export async function getAdminPesticides(options?: {
  search?: string
  pesticideType?: PesticideType
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('pesticide_data:view')
  if ('error' in admin) return actionError(admin.error)

  const parsed = getAdminPesticidesSchema.safeParse(options ?? {})
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const { search, pesticideType, limit = DEFAULT_PAGE_LIMIT, cursor } = parsed.data

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search } },
          { registrationNumber: { contains: search } },
        ],
      }),
      ...(pesticideType && { pesticideType }),
    }

    const [pesticides, total] = await Promise.all([
      prisma.pesticide.findMany({
        where,
        include: {
          formulationType: { select: { name: true } },
          _count: { select: { effects: true, ingredients: true } },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.pesticide.count({ where }),
    ])

    const nextCursor = pesticides.length === limit ? pesticides[pesticides.length - 1]?.id : undefined
    return { pesticides, total, nextCursor }
  } catch (error) {
    logger.error('getAdminPesticides failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * 農薬詳細を取得
 */
export async function getAdminPesticideDetail(id: string) {
  const admin = await requireAdmin('pesticide_data:view')
  if ('error' in admin) return actionError(admin.error)

  const parsedId = pesticideIdSchema.safeParse(id)
  if (!parsedId.success) return actionError(ERR_INVALID_INPUT)

  try {
    const pesticide = await prisma.pesticide.findUnique({
      where: { id: parsedId.data },
      include: {
        formulationType: true,
        ingredients: {
          include: { activeIngredient: true },
        },
        effects: {
          include: { diseasePest: true },
        },
        incompatibleWith: {
          include: { incompatibleWith: { select: { id: true, name: true } } },
        },
        spreaderTypes: {
          include: { spreaderType: true },
        },
      },
    })

    if (!pesticide) return actionError(ERR_PESTICIDE_NOT_FOUND)

    const history = await prisma.pesticideDataHistory.findMany({
      where: { pesticideId: parsedId.data },
      orderBy: { createdAt: 'desc' },
      take: PESTICIDE_DETAIL_HISTORY_LIMIT,
    })

    return { pesticide, history }
  } catch (error) {
    logger.error('getAdminPesticideDetail failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * 農薬を作成
 */
export async function createPesticide(data: {
  name: string
  registrationNumber?: string
  pesticideType: PesticideType
  formulationTypeId?: string
  description?: string
  slug: string
}) {
  const admin = await requireAdmin('pesticide_data:manage')
  if ('error' in admin) return actionError(admin.error)

  const parsed = createPesticideSchema.safeParse(data)
  if (!parsed.success) {
    const nameIssue = parsed.error.issues.find((issue) => issue.path[0] === 'name')
    if (nameIssue?.message === ERR_PESTICIDE_NAME_REQUIRED) {
      return actionError(ERR_PESTICIDE_NAME_REQUIRED)
    }
    return actionError(ERR_INVALID_INPUT)
  }
  const input = parsed.data

  try {
    const pesticide = await prisma.pesticide.create({
      data: {
        name: input.name,
        registrationNumber: input.registrationNumber || null,
        pesticideType: input.pesticideType,
        formulationTypeId: input.formulationTypeId || null,
        description: input.description || null,
        slug: input.slug,
      },
    })

    await prisma.pesticideDataHistory.create({
      data: {
        pesticideId: pesticide.id,
        action: 'create',
        changes: { after: input },
        performedBy: admin.userId,
      },
    })

    await prisma.adminLog.create({
      data: {
        adminId: admin.userId,
        action: ACTION_CREATE_PESTICIDE,
        targetType: 'pesticide',
        targetId: pesticide.id,
        details: JSON.stringify({ name: input.name }),
      },
    })

    revalidatePath(ROUTE_ADMIN_PESTICIDE_DATA)
    return actionSuccess(pesticide)
  } catch (error) {
    logger.error('createPesticide failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * 農薬を更新
 */
export async function updatePesticide(id: string, data: {
  name?: string
  registrationNumber?: string | null
  pesticideType?: PesticideType
  formulationTypeId?: string | null
  description?: string | null
}) {
  const admin = await requireAdmin('pesticide_data:manage')
  if ('error' in admin) return actionError(admin.error)

  const parsedId = pesticideIdSchema.safeParse(id)
  if (!parsedId.success) return actionError(ERR_INVALID_INPUT)

  const parsed = updatePesticideSchema.safeParse(data)
  if (!parsed.success) {
    const nameIssue = parsed.error.issues.find((issue) => issue.path[0] === 'name')
    if (nameIssue?.message === ERR_PESTICIDE_NAME_REQUIRED) {
      return actionError(ERR_PESTICIDE_NAME_REQUIRED)
    }
    return actionError(ERR_INVALID_INPUT)
  }
  const input = parsed.data

  try {
    const existing = await prisma.pesticide.findUnique({ where: { id: parsedId.data } })
    if (!existing) return actionError(ERR_PESTICIDE_NOT_FOUND)

    const updated = await prisma.pesticide.update({
      where: { id: parsedId.data },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.registrationNumber !== undefined && { registrationNumber: input.registrationNumber }),
        ...(input.pesticideType !== undefined && { pesticideType: input.pesticideType }),
        ...(input.formulationTypeId !== undefined && { formulationTypeId: input.formulationTypeId }),
        ...(input.description !== undefined && { description: input.description }),
      },
    })

    await prisma.pesticideDataHistory.create({
      data: {
        pesticideId: parsedId.data,
        action: 'update',
        changes: {
          before: {
            name: existing.name,
            registrationNumber: existing.registrationNumber,
            pesticideType: existing.pesticideType,
            description: existing.description,
          },
          after: input,
        },
        performedBy: admin.userId,
      },
    })

    await prisma.adminLog.create({
      data: {
        adminId: admin.userId,
        action: ACTION_UPDATE_PESTICIDE,
        targetType: 'pesticide',
        targetId: parsedId.data,
        details: JSON.stringify({ name: updated.name }),
      },
    })

    revalidatePath(ROUTE_ADMIN_PESTICIDE_DATA)
    return actionSuccess()
  } catch (error) {
    logger.error('updatePesticide failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * 農薬を削除
 */
export async function deletePesticide(id: string) {
  const admin = await requireAdmin('pesticide_data:manage')
  if ('error' in admin) return actionError(admin.error)

  const parsedId = pesticideIdSchema.safeParse(id)
  if (!parsedId.success) return actionError(ERR_INVALID_INPUT)

  try {
    const existing = await prisma.pesticide.findUnique({ where: { id: parsedId.data } })
    if (!existing) return actionError(ERR_PESTICIDE_NOT_FOUND)

    await prisma.pesticideDataHistory.create({
      data: {
        pesticideId: parsedId.data,
        action: 'delete',
        changes: {
          before: {
            name: existing.name,
            registrationNumber: existing.registrationNumber,
            pesticideType: existing.pesticideType,
          },
        },
        performedBy: admin.userId,
      },
    })

    await prisma.$transaction([
      prisma.pesticide.delete({ where: { id: parsedId.data } }),
      prisma.adminLog.create({
        data: {
          adminId: admin.userId,
          action: ACTION_DELETE_PESTICIDE,
          targetType: 'pesticide',
          targetId: parsedId.data,
          details: JSON.stringify({ name: existing.name }),
        },
      }),
    ])

    revalidatePath(ROUTE_ADMIN_PESTICIDE_DATA)
    return actionSuccess()
  } catch (error) {
    logger.error('deletePesticide failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * 農薬データ更新履歴を取得
 */
export async function getPesticideHistory(options?: {
  pesticideId?: string
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('pesticide_data:view')
  if ('error' in admin) return actionError(admin.error)

  const parsed = getPesticideHistorySchema.safeParse(options ?? {})
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const { pesticideId, limit = DEFAULT_PAGE_LIMIT, cursor } = parsed.data

    const where = {
      ...(pesticideId && { pesticideId }),
    }

    const [history, total] = await Promise.all([
      prisma.pesticideDataHistory.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.pesticideDataHistory.count({ where }),
    ])

    const nextCursor = history.length === limit ? history[history.length - 1]?.id : undefined
    return { history, total, nextCursor }
  } catch (error) {
    logger.error('getPesticideHistory failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}
