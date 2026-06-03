'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { requireAdmin, actionSuccess, actionError } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { buildSegmentCountQuery } from '@/lib/services/segment-evaluation'
import {
  ERR_SEGMENT_NOT_FOUND,
  ERR_SEGMENT_NAME_REQUIRED,
  ERR_SEGMENT_CONDITIONS_INVALID,
  ERR_OPERATION_FAILED,
} from '@/lib/constants/errors'
import { ROUTE_ADMIN_SEGMENTS } from '@/lib/constants/routes'
import { logger } from '@/lib/logger'

// バリデーションスキーマ（Zod で型・境界値を安全に検証）

/**
 * セグメントルールの許容値。
 * `as unknown as` キャストを避けるため、値域を Zod スキーマで明示する。
 */
const segmentRuleSchema = z.object({
  field: z.enum([
    'createdAt',
    'postCount',
    'isPremium',
    'isSuspended',
    'location',
    'followerCount',
  ]),
  operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte', 'contains', 'is']),
  value: z.union([z.string(), z.number(), z.boolean()]),
})

const segmentConditionsSchema = z.object({
  rules: z.array(segmentRuleSchema),
  logic: z.enum(['AND', 'OR']),
})

type SegmentConditions = z.infer<typeof segmentConditionsSchema>

export async function getSegments(options?: {
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('segments:view')
  if ('error' in admin) return actionError(admin.error)

  const { limit = DEFAULT_PAGE_LIMIT, cursor } = options || {}

  try {
    const [segments, total] = await Promise.all([
      prisma.userSegment.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.userSegment.count(),
    ])

    const nextCursor = segments.length === limit ? segments[segments.length - 1]?.id : undefined
    return { segments, total, nextCursor }
  } catch (error) {
    logger.error('Get segments error', { error: error instanceof Error ? error.message : String(error) })
    return { segments: [], total: 0, nextCursor: undefined }
  }
}

export async function createSegment(data: {
  name: string
  description?: string
  conditions: SegmentConditions
}) {
  const admin = await requireAdmin('segments:manage')
  if ('error' in admin) return actionError(admin.error)

  if (!data.name?.trim()) return actionError(ERR_SEGMENT_NAME_REQUIRED)

  const validatedConditions = segmentConditionsSchema.safeParse(data.conditions)
  if (!validatedConditions.success) return actionError(ERR_SEGMENT_CONDITIONS_INVALID)

  try {
    const segment = await prisma.userSegment.create({
      data: {
        name: data.name.trim(),
        description: data.description || null,
        conditions: validatedConditions.data,
        createdBy: admin.userId,
      },
    })

    revalidatePath(ROUTE_ADMIN_SEGMENTS)
    return actionSuccess(segment)
  } catch (error) {
    logger.error('Create segment error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function deleteSegment(id: string) {
  const admin = await requireAdmin('segments:manage')
  if ('error' in admin) return actionError(admin.error)

  try {
    const segment = await prisma.userSegment.findUnique({ where: { id } })
    if (!segment) return actionError(ERR_SEGMENT_NOT_FOUND)

    await prisma.userSegment.delete({ where: { id } })
    revalidatePath(ROUTE_ADMIN_SEGMENTS)
    return actionSuccess()
  } catch (error) {
    logger.error('Delete segment error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function evaluateSegment(id: string) {
  const admin = await requireAdmin('segments:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const segment = await prisma.userSegment.findUnique({ where: { id } })
    if (!segment) return actionError(ERR_SEGMENT_NOT_FOUND)

    const conditions = parseSegmentConditions(segment.conditions)
    if (!conditions) return actionError(ERR_SEGMENT_CONDITIONS_INVALID)

    // postCount / followerCount を正確に比較するため相関サブクエリ付きの raw SQL を使う。
    const rows = await prisma.$queryRaw<{ count: number }[]>(buildSegmentCountQuery(conditions))
    const count = Number(rows[0]?.count ?? 0)

    return { count }
  } catch (error) {
    logger.error('Evaluate segment error', { error: error instanceof Error ? error.message : String(error) })
    return { count: 0 }
  }
}

// 内部ヘルパー

/**
 * Prisma の Json フィールドから `SegmentConditions` を安全にパースする。
 * 型ガードではなく Zod で境界検証することで `as unknown as` ダブルキャストを排除。
 */
function parseSegmentConditions(raw: unknown): SegmentConditions | null {
  const r = segmentConditionsSchema.safeParse(raw)
  return r.success ? r.data : null
}
