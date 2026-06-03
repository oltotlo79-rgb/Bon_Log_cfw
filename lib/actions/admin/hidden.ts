/**
 * 管理者用：非表示コンテンツ管理 Server Actions。
 * 非表示化（自動 / 手動）されたコンテンツの一覧・復元・完全削除を扱う。
 * 全ての管理操作は AdminLog に記録される。
 *
 * @module lib/actions/admin/hidden
 */

'use server'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_RELATION } from '@/lib/prisma/shared-includes'
import { revalidatePath } from 'next/cache'
import { revalidateShopRatingsCache, revalidatePopularTagsCache, revalidateTrendingGenresCache } from '@/lib/cache'
import { detachHashtagsFromPost } from '@/lib/services/hashtag-sync'
import { ADMIN_LOGS_PAGE_LIMIT, HIDDEN_CONTENT_FALLBACK_LIMIT } from '@/lib/constants/limits'
import { clampLimit } from '@/lib/actions/pagination'
import { requireAdmin, actionSuccess, actionError } from '@/lib/actions/utils'
import { ERR_OPERATION_FAILED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_ADMIN_HIDDEN } from '@/lib/constants/routes'
import { logger } from '@/lib/logger'
import { adminIdSchema, contentTypeSchema } from './_schemas'

type ContentType = 'post' | 'comment' | 'event' | 'shop' | 'review'

export async function getHiddenContent(options?: {
  type?: ContentType
  limit?: number
}) {
  const admin = await requireAdmin('hidden:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const { type } = options || {}
    const limit = clampLimit(options?.limit ?? ADMIN_LOGS_PAGE_LIMIT)
    // タイプ未指定時はタイプごとに HIDDEN_CONTENT_FALLBACK_LIMIT 件ずつ取得
    const takePerType = type ? limit : HIDDEN_CONTENT_FALLBACK_LIMIT

    // 各コンテンツタイプのクエリを並列実行
    const [hiddenPosts, hiddenComments, hiddenEvents, hiddenShops, hiddenReviews] = await Promise.all([
      (!type || type === 'post')
        ? prisma.post.findMany({
            where: { isHidden: true },
            include: {
              user: USER_MINIMAL_RELATION,
              _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
            },
            orderBy: [{ hiddenAt: 'desc' }, { id: 'desc' }],
            take: takePerType,
          })
        : Promise.resolve([]),

      (!type || type === 'comment')
        ? prisma.comment.findMany({
            where: { isHidden: true },
            include: {
              user: USER_MINIMAL_RELATION,
              post: { select: { id: true } },
            },
            orderBy: [{ hiddenAt: 'desc' }, { id: 'desc' }],
            take: takePerType,
          })
        : Promise.resolve([]),

      (!type || type === 'event')
        ? prisma.event.findMany({
            where: { isHidden: true },
            include: { creator: USER_MINIMAL_RELATION },
            orderBy: [{ hiddenAt: 'desc' }, { id: 'desc' }],
            take: takePerType,
          })
        : Promise.resolve([]),

      (!type || type === 'shop')
        ? prisma.bonsaiShop.findMany({
            where: { isHidden: true },
            include: { creator: USER_MINIMAL_RELATION },
            orderBy: [{ hiddenAt: 'desc' }, { id: 'desc' }],
            take: takePerType,
          })
        : Promise.resolve([]),

      (!type || type === 'review')
        ? prisma.shopReview.findMany({
            where: { isHidden: true },
            include: {
              user: USER_MINIMAL_RELATION,
              shop: { select: { name: true } },
            },
            orderBy: [{ hiddenAt: 'desc' }, { id: 'desc' }],
            take: takePerType,
          })
        : Promise.resolve([]),
    ])

    // 結果を統合
    type CreatedBy = { id: string; nickname: string; avatarUrl: string | null }
    type HiddenItem = {
      type: ContentType; id: string; content: string | null
      createdBy: CreatedBy; hiddenAt: Date | null; reportCount: number
    }
    // 作成者が削除済み（User?のnull）の場合のフォールバック
    const DELETED_USER: CreatedBy = { id: '', nickname: '(削除済みユーザー)', avatarUrl: null }
    const item = (type: ContentType, id: string, content: string | null, createdBy: CreatedBy | null, hiddenAt: Date | null): HiddenItem =>
      ({ type, id, content, createdBy: createdBy ?? DELETED_USER, hiddenAt, reportCount: 0 })

    const results: HiddenItem[] = [
      ...hiddenPosts.map((p) => item('post', p.id, p.content, p.user, p.hiddenAt)),
      ...hiddenComments.map((c) => item('comment', c.id, c.content, c.user, c.hiddenAt)),
      ...hiddenEvents.map((e) => item('event', e.id, `${e.title}${e.description ? `: ${e.description}` : ''}`, e.creator, e.hiddenAt)),
      ...hiddenShops.map((s) => item('shop', s.id, `${s.name} (${s.address})`, s.creator, s.hiddenAt)),
      ...hiddenReviews.map((r) => item('review', r.id, `${r.shop.name}へのレビュー: ${r.content || '(コメントなし)'}`, r.user, r.hiddenAt)),
    ]

    // 通報件数を一括取得（N+1回避）
    if (results.length > 0) {
      const reportCounts = await prisma.report.groupBy({
        by: ['targetType', 'targetId'],
        where: {
          OR: results.map(r => ({ targetType: r.type, targetId: r.id })),
        },
        _count: true,
      })
      const countMap = new Map(
        reportCounts.map((r: { targetType: string; targetId: string; _count: number }) => [`${r.targetType}:${r.targetId}`, r._count] as const)
      )
      for (const item of results) {
        item.reportCount = countMap.get(`${item.type}:${item.id}`) ?? 0
      }
    }

    // 非表示日時でソート
    results.sort((a: typeof results[number], b: typeof results[number]) => {
      if (!a.hiddenAt || !b.hiddenAt) return 0
      return b.hiddenAt.getTime() - a.hiddenAt.getTime()
    })

    return { items: results }
  } catch (error) {
    logger.error('getHiddenContent failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * 非表示化されたコンテンツを再表示する。
 * 同時に関連通報を `resolved`、管理者通知を `isResolved` に更新する。
 */
export async function restoreContent(type: ContentType, id: string) {
  const admin = await requireAdmin('hidden:manage')
  if ('error' in admin) return actionError(admin.error)
  const adminId = admin.userId

  const typeParsed = contentTypeSchema.safeParse(type)
  if (!typeParsed.success) return actionError(ERR_INVALID_INPUT)
  const idParsed = adminIdSchema.safeParse(id)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)
  const parsedType = typeParsed.data
  const parsedId = idParsed.data

  try {
    switch (parsedType) {
      case 'post':
        await prisma.post.update({
          where: { id: parsedId },
          data: { isHidden: false, hiddenAt: null },
        })
        break
      case 'comment':
        await prisma.comment.update({
          where: { id: parsedId },
          data: { isHidden: false, hiddenAt: null },
        })
        break
      case 'event':
        await prisma.event.update({
          where: { id: parsedId },
          data: { isHidden: false, hiddenAt: null },
        })
        break
      case 'shop':
        await prisma.bonsaiShop.update({
          where: { id: parsedId },
          data: { isHidden: false, hiddenAt: null },
        })
        break
      case 'review':
        await prisma.shopReview.update({
          where: { id: parsedId },
          data: { isHidden: false, hiddenAt: null },
        })
        break
    }

    await prisma.report.updateMany({
      where: { targetType: parsedType, targetId: parsedId },
      data: { status: 'resolved' },
    })

    await prisma.adminNotification.updateMany({
      where: { targetType: parsedType, targetId: parsedId, isResolved: false },
      data: { isResolved: true, resolvedAt: new Date() },
    })

    await prisma.adminLog.create({
      data: {
        adminId: adminId,
        action: 'restore_content',
        targetType: parsedType,
        targetId: parsedId,
      },
    })

    // review の可視性変更は店舗一覧の集計平均（getCachedShopRatings）に影響するため明示的に無効化する
    if (parsedType === 'review') revalidateShopRatingsCache()
    // 投稿の再表示は公開面の集計（人気タグ・トレンドジャンル）の対象に復帰させるため無効化する
    if (parsedType === 'post') {
      revalidatePopularTagsCache()
      revalidateTrendingGenresCache()
    }

    revalidatePath(ROUTE_ADMIN_HIDDEN)
    return actionSuccess()
  } catch (error) {
    logger.error('restoreContent failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * 非表示コンテンツを完全削除する（カスケード削除）。取り消し不可。
 */
export async function deleteHiddenContent(type: ContentType, id: string) {
  const admin = await requireAdmin('hidden:manage')
  if ('error' in admin) return actionError(admin.error)
  const adminId = admin.userId

  const typeParsed = contentTypeSchema.safeParse(type)
  if (!typeParsed.success) return actionError(ERR_INVALID_INPUT)
  const idParsed = adminIdSchema.safeParse(id)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)
  const parsedType = typeParsed.data
  const parsedId = idParsed.data

  try {
    switch (parsedType) {
      case 'post':
        // denormalized な Hashtag.count を維持するため、cascade 削除前に detach する（best-effort）
        await detachHashtagsFromPost(parsedId)
        await prisma.post.delete({ where: { id: parsedId } })
        break
      case 'comment':
        await prisma.comment.delete({ where: { id: parsedId } })
        break
      case 'event':
        await prisma.event.delete({ where: { id: parsedId } })
        break
      case 'shop':
        await prisma.bonsaiShop.delete({ where: { id: parsedId } })
        break
      case 'review':
        await prisma.shopReview.delete({ where: { id: parsedId } })
        break
    }

    await prisma.report.deleteMany({
      where: { targetType: parsedType, targetId: parsedId },
    })

    await prisma.adminNotification.updateMany({
      where: { targetType: parsedType, targetId: parsedId, isResolved: false },
      data: { isResolved: true, resolvedAt: new Date() },
    })

    await prisma.adminLog.create({
      data: {
        adminId: adminId,
        action: 'delete_hidden_content',
        targetType: parsedType,
        targetId: parsedId,
      },
    })

    // review 削除は店舗一覧の集計平均（getCachedShopRatings）に影響するため明示的に無効化する
    if (parsedType === 'review') revalidateShopRatingsCache()
    // 投稿削除は公開面の集計（人気タグ・トレンドジャンル）に影響するため無効化する
    if (parsedType === 'post') {
      revalidatePopularTagsCache()
      revalidateTrendingGenresCache()
    }

    revalidatePath(ROUTE_ADMIN_HIDDEN)
    return actionSuccess()
  } catch (error) {
    logger.error('deleteHiddenContent failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function getAdminNotifications(options?: {
  unreadOnly?: boolean
  limit?: number
}) {
  const admin = await requireAdmin('hidden:view')
  if ('error' in admin) return actionError(admin.error)

  const { unreadOnly = false } = options || {}
  const safeLimit = clampLimit(options?.limit)

  try {
    const notifications = await prisma.adminNotification.findMany({
      where: {
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit,
    })

    const unreadCount = await prisma.adminNotification.count({
      where: { isRead: false },
    })

    return { notifications, unreadCount }
  } catch (error) {
    logger.error('getAdminNotifications failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function markAdminNotificationAsRead(notificationId: string) {
  const admin = await requireAdmin('hidden:view')
  if ('error' in admin) return actionError(admin.error)

  const parsed = adminIdSchema.safeParse(notificationId)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    await prisma.adminNotification.update({
      where: { id: parsed.data },
      data: { isRead: true },
    })

    revalidatePath(ROUTE_ADMIN_HIDDEN)
    return actionSuccess()
  } catch (error) {
    logger.error('markAdminNotificationAsRead failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function markAllAdminNotificationsAsRead() {
  const admin = await requireAdmin('hidden:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    await prisma.adminNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    })

    revalidatePath(ROUTE_ADMIN_HIDDEN)
    return actionSuccess()
  } catch (error) {
    logger.error('markAllAdminNotificationsAsRead failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}
