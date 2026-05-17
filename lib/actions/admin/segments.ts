'use server'

import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { requireAdmin, actionSuccess, actionError } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
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

type SegmentRule = z.infer<typeof segmentRuleSchema>
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

    const where = buildPrismaWhere(conditions)
    const count = await prisma.user.count({ where })

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

/**
 * セグメント条件から Prisma.UserWhereInput を構築する。
 * 戻り値を `Prisma.UserWhereInput` 型で明示し、呼び出し側のキャストを不要にする。
 */
function buildPrismaWhere(conditions: SegmentConditions): Prisma.UserWhereInput {
  const clauses: Prisma.UserWhereInput[] = conditions.rules.map((rule) => ruleToWhere(rule))
  return conditions.logic === 'OR' ? { OR: clauses } : { AND: clauses }
}

/**
 * 単一ルールを Prisma.UserWhereInput に変換する。
 *
 * Note: postCount / followerCount の厳密な数値比較は Prisma のネイティブ where
 * 句では表現できないため、`some: {}`（存在チェック）に縮退している。
 * 精密な件数フィルタが必要な場合は raw SQL で実装すること。
 */
function ruleToWhere(rule: SegmentRule): Prisma.UserWhereInput {
  switch (rule.field) {
    case 'createdAt': {
      if (typeof rule.value !== 'string') return {}
      const date = new Date(rule.value)
      if (Number.isNaN(date.getTime())) return {}
      return { createdAt: mapDateOperator(rule.operator, date) }
    }
    case 'isPremium':
      return { isPremium: rule.value === true || rule.value === 'true' }
    case 'isSuspended':
      return { isSuspended: rule.value === true || rule.value === 'true' }
    case 'location':
      if (typeof rule.value !== 'string') return {}
      return { location: { contains: rule.value } }
    case 'postCount':
      return { posts: { some: {} } }
    case 'followerCount':
      return { followers: { some: {} } }
    default:
      return {}
  }
}

/**
 * 日付比較演算子を Prisma のクエリ形式にマップする。
 * 未知の演算子は eq と同値（= 完全一致）として扱う。
 */
function mapDateOperator(op: SegmentRule['operator'], value: Date): Prisma.DateTimeFilter | Date {
  switch (op) {
    case 'gt':
      return { gt: value }
    case 'lt':
      return { lt: value }
    case 'gte':
      return { gte: value }
    case 'lte':
      return { lte: value }
    case 'eq':
    default:
      return value
  }
}
