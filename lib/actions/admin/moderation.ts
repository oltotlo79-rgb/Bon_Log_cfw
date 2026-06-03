'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { DEFAULT_PAGE_LIMIT, BULK_MODERATION_MAX } from '@/lib/constants/limits'
import { requireAdmin, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { invalidateNgWordsCache } from '@/lib/ng-word-checker'
import {
  ERR_NG_WORD_REQUIRED,
  ERR_NG_WORD_DUPLICATE,
  ERR_NG_WORD_NOT_FOUND,
  ERR_MODERATION_ITEM_NOT_FOUND,
  ERR_BULK_OPERATION_LIMIT,
  ERR_NG_WORD_REGEX_INVALID,
  ERR_NG_WORD_REGEX_UNSAFE,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'
import {
  adminIdSchema,
  ngWordSchema,
  ngWordRegexSchema,
  bulkModerationIdsSchema,
  bulkDeletePostIdsSchema,
  bulkSuspendUserIdsSchema,
  moderationActionSchema,
} from './_schemas'
import {
  ROUTE_ADMIN_NG_WORDS,
  ROUTE_ADMIN_MODERATION_QUEUE,
  ROUTE_ADMIN_POSTS,
  ROUTE_ADMIN_USERS,
} from '@/lib/constants/routes'
import {
  ACTION_CREATE_NG_WORD,
  ACTION_DELETE_NG_WORD,
  ACTION_MODERATION_APPROVED,
  ACTION_MODERATION_REJECTED,
  ACTION_BULK_MODERATION_APPROVED,
  ACTION_BULK_MODERATION_REJECTED,
  ACTION_BULK_DELETE_POSTS,
  ACTION_BULK_SUSPEND_USERS,
} from '@/lib/constants/admin-actions'
import logger from '@/lib/logger'
import type { ModerationStatus, ReportTargetType } from '@prisma/client'

const ERR_BULK_LIMIT = ERR_BULK_OPERATION_LIMIT

const createNgWordSchema = z.object({
  word: ngWordSchema,
  // 空文字は許可: 呼び出し側で `category || 'inappropriate'` のデフォルトに任せる
  category: z.string().max(50).optional(),
  isRegex: z.boolean().optional(),
})

const reviewModerationItemSchema = z.object({
  id: adminIdSchema,
  action: moderationActionSchema,
})

const bulkReviewModerationSchema = z.object({
  ids: bulkModerationIdsSchema,
  action: moderationActionSchema,
})

// NGワード管理

export async function getNgWords(options?: {
  search?: string
  category?: string
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('moderation:ng_words')
  if ('error' in admin) return actionError(admin.error)

  const { search, category, limit = DEFAULT_PAGE_LIMIT, cursor } = options || {}

  const where = {
    ...(search && { word: { contains: search } }),
    ...(category && { category }),
  }

  const [words, total] = await Promise.all([
    prisma.ngWord.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...buildCursorPagination(cursor, limit),
    }),
    prisma.ngWord.count({ where }),
  ])

  const nextCursor = words.length === limit ? words[words.length - 1]?.id : undefined
  return { words, total, nextCursor }
}

/**
 * NGワードの集計値のみを取得する。
 *
 * `getNgWords({ limit: 10000 })` で全件を取得して JS 側でフィルタする
 * 旧実装を置き換えるための軽量な count 専用関数。
 * 大量のワードがあっても DB 側で count されるため O(1) に近いメモリで処理できる。
 */
export async function getNgWordStats(): Promise<
  { total: number; activeCount: number; inactiveCount: number } | { error: string }
> {
  const admin = await requireAdmin('moderation:ng_words')
  if ('error' in admin) return { error: admin.error }

  const [total, activeCount] = await Promise.all([
    prisma.ngWord.count(),
    prisma.ngWord.count({ where: { isActive: true } }),
  ])
  return { total, activeCount, inactiveCount: total - activeCount }
}

export async function createNgWord(data: {
  word: string
  category: string
  isRegex?: boolean
}) {
  const admin = await requireAdmin('moderation:ng_words')
  if ('error' in admin) return actionError(admin.error)

  const parsed = createNgWordSchema.safeParse(data)
  if (!parsed.success) return actionError(ERR_NG_WORD_REQUIRED)
  const input = parsed.data

  if (input.isRegex) {
    // 正規表現専用の長さ上限 (NG_WORD_REGEX_MAX_LENGTH) は ngWordRegexSchema で再検証する。
    const regexParsed = ngWordRegexSchema.safeParse(input.word)
    if (!regexParsed.success) return actionError(ERR_INVALID_INPUT)
    try {
      new RegExp(input.word)
    } catch {
      return actionError(ERR_NG_WORD_REGEX_INVALID)
    }
    // ReDoS 対策: カタストロフィックバックトラッキングを誘発するパターン (例: (a+)+, (a|a)+) を弾く。
    const redosPattern = /(\(.*[+*].*\))[+*]|\(\?[^)]*[+*][^)]*\)[+*]/
    if (redosPattern.test(input.word)) {
      return actionError(ERR_NG_WORD_REGEX_UNSAFE)
    }
  }

  const existing = await prisma.ngWord.findUnique({ where: { word: input.word } })
  if (existing) return actionError(ERR_NG_WORD_DUPLICATE)

  await prisma.$transaction([
    prisma.ngWord.create({
      data: {
        word: input.word,
        category: input.category || 'inappropriate',
        isRegex: input.isRegex ?? false,
        createdBy: admin.userId,
      },
    }),
    prisma.adminLog.create({
      data: {
        adminId: admin.userId,
        action: ACTION_CREATE_NG_WORD,
        targetType: 'ng_word',
        details: JSON.stringify({ word: input.word }),
      },
    }),
  ])

  await invalidateNgWordsCache()
  revalidatePath(ROUTE_ADMIN_NG_WORDS)
  return actionSuccess()
}

export async function deleteNgWord(id: string) {
  const admin = await requireAdmin('moderation:ng_words')
  if ('error' in admin) return actionError(admin.error)

  const parsed = adminIdSchema.safeParse(id)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const word = await prisma.ngWord.findUnique({ where: { id: parsed.data } })
  if (!word) return actionError(ERR_NG_WORD_NOT_FOUND)

  await prisma.$transaction([
    prisma.ngWord.delete({ where: { id: parsed.data } }),
    prisma.adminLog.create({
      data: {
        adminId: admin.userId,
        action: ACTION_DELETE_NG_WORD,
        targetType: 'ng_word',
        targetId: parsed.data,
        details: JSON.stringify({ word: word.word }),
      },
    }),
  ])

  await invalidateNgWordsCache()
  revalidatePath(ROUTE_ADMIN_NG_WORDS)
  return actionSuccess()
}

export async function toggleNgWord(id: string) {
  const admin = await requireAdmin('moderation:ng_words')
  if ('error' in admin) return actionError(admin.error)

  const parsed = adminIdSchema.safeParse(id)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const word = await prisma.ngWord.findUnique({ where: { id: parsed.data } })
  if (!word) return actionError(ERR_NG_WORD_NOT_FOUND)

  await prisma.ngWord.update({
    where: { id: parsed.data },
    data: { isActive: !word.isActive },
  })

  await invalidateNgWordsCache()
  revalidatePath(ROUTE_ADMIN_NG_WORDS)
  return actionSuccess()
}

// モデレーションキュー

export async function getModerationQueue(options?: {
  status?: ModerationStatus
  targetType?: ReportTargetType
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('moderation:view')
  if ('error' in admin) return actionError(admin.error)

  const { status, targetType, limit = DEFAULT_PAGE_LIMIT, cursor } = options || {}

  const where = {
    ...(status && { status }),
    ...(targetType && { targetType }),
  }

  const [items, total] = await Promise.all([
    prisma.moderationQueue.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...buildCursorPagination(cursor, limit),
    }),
    prisma.moderationQueue.count({ where }),
  ])

  const nextCursor = items.length === limit ? items[items.length - 1]?.id : undefined
  return { items, total, nextCursor }
}

export async function reviewModerationItem(id: string, action: 'approved' | 'rejected') {
  const admin = await requireAdmin('moderation:action')
  if ('error' in admin) return actionError(admin.error)

  const parsed = reviewModerationItemSchema.safeParse({ id, action })
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  const input = parsed.data

  const item = await prisma.moderationQueue.findUnique({ where: { id: input.id } })
  if (!item) return actionError(ERR_MODERATION_ITEM_NOT_FOUND)

  await prisma.$transaction([
    prisma.moderationQueue.update({
      where: { id: input.id },
      data: {
        status: input.action,
        reviewedBy: admin.userId,
        reviewedAt: new Date(),
      },
    }),
    prisma.adminLog.create({
      data: {
        adminId: admin.userId,
        action: input.action === 'approved' ? ACTION_MODERATION_APPROVED : ACTION_MODERATION_REJECTED,
        targetType: item.targetType,
        targetId: item.targetId,
        details: JSON.stringify({ queueId: input.id }),
      },
    }),
  ])

  if (input.action === 'rejected') {
    if (item.targetType === 'post') {
      await prisma.post.delete({ where: { id: item.targetId } }).catch((err) => { logger.warn('Failed to delete moderation target', { targetId: item.targetId, err }) })
    } else if (item.targetType === 'comment') {
      await prisma.comment.delete({ where: { id: item.targetId } }).catch((err) => { logger.warn('Failed to delete moderation target', { targetId: item.targetId, err }) })
    }
  }

  revalidatePath(ROUTE_ADMIN_MODERATION_QUEUE)
  return actionSuccess()
}

export async function bulkReviewModeration(ids: string[], action: 'approved' | 'rejected') {
  const admin = await requireAdmin('moderation:action')
  if ('error' in admin) return actionError(admin.error)

  const parsed = bulkReviewModerationSchema.safeParse({ ids, action })
  if (!parsed.success) {
    // 件数上限超過は明示的に区別 (BULK_MODERATION_MAX を超えた場合のメッセージ)
    if (ids.length > BULK_MODERATION_MAX || ids.length === 0) {
      return actionError(ERR_BULK_LIMIT)
    }
    return actionError(ERR_INVALID_INPUT)
  }
  const input = parsed.data

  const rl = await enforceUserRateLimit(admin.userId, 'admin_bulk')
  if (rl) return actionError(rl.error)

  await prisma.moderationQueue.updateMany({
    where: { id: { in: input.ids } },
    data: {
      status: input.action,
      reviewedBy: admin.userId,
      reviewedAt: new Date(),
    },
  })

  await prisma.adminLog.create({
    data: {
      adminId: admin.userId,
      action: input.action === 'approved' ? ACTION_BULK_MODERATION_APPROVED : ACTION_BULK_MODERATION_REJECTED,
      details: JSON.stringify({ count: input.ids.length, ids: input.ids }),
    },
  })

  revalidatePath(ROUTE_ADMIN_MODERATION_QUEUE)
  return actionSuccess()
}

export async function bulkDeletePosts(postIds: string[]) {
  const admin = await requireAdmin('posts:bulk_action')
  if ('error' in admin) return actionError(admin.error)

  const parsed = bulkDeletePostIdsSchema.safeParse(postIds)
  if (!parsed.success) return actionError(ERR_BULK_LIMIT)
  const ids = parsed.data

  const rl = await enforceUserRateLimit(admin.userId, 'admin_bulk')
  if (rl) return actionError(rl.error)

  await prisma.$transaction([
    prisma.post.deleteMany({ where: { id: { in: ids } } }),
    prisma.adminLog.create({
      data: {
        adminId: admin.userId,
        action: ACTION_BULK_DELETE_POSTS,
        details: JSON.stringify({ count: ids.length, ids }),
      },
    }),
  ])

  revalidatePath(ROUTE_ADMIN_POSTS)
  return actionSuccess()
}

export async function bulkSuspendUsers(userIds: string[]) {
  const admin = await requireAdmin('users:suspend')
  if ('error' in admin) return actionError(admin.error)

  const parsed = bulkSuspendUserIdsSchema.safeParse(userIds)
  if (!parsed.success) return actionError(ERR_BULK_LIMIT)
  const ids = parsed.data

  const rl = await enforceUserRateLimit(admin.userId, 'admin_bulk')
  if (rl) return actionError(rl.error)

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: { in: ids }, isSuspended: false },
      data: { isSuspended: true, suspendedAt: new Date() },
    }),
    prisma.adminLog.create({
      data: {
        adminId: admin.userId,
        action: ACTION_BULK_SUSPEND_USERS,
        details: JSON.stringify({ count: ids.length, ids }),
      },
    }),
  ])

  revalidatePath(ROUTE_ADMIN_USERS)
  return actionSuccess()
}
