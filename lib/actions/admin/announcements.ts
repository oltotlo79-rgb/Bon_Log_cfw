'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { revalidatePath, revalidateTag } from 'next/cache'
import { DEFAULT_PAGE_LIMIT, NOTIFICATION_BATCH_SIZE } from '@/lib/constants/limits'
import { requireAdmin, actionSuccess, actionError } from '@/lib/actions/utils'
import { withAuth } from '@/types/action-result'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { createNotificationsBulk } from '@/lib/services/notification-bulk'
import { ERR_ANNOUNCEMENT_NOT_FOUND, ERR_ANNOUNCEMENT_TITLE_REQUIRED, ERR_OPERATION_FAILED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_ADMIN_ANNOUNCEMENTS } from '@/lib/constants/routes'
import { logger } from '@/lib/logger'
import { ACTION_CREATE_ANNOUNCEMENT, ACTION_DELETE_ANNOUNCEMENT } from '@/lib/constants/admin-actions'
import { AnnouncementType } from '@prisma/client'

/**
 * お知らせ入力スキーマ。`z.infer` 経由で各 Action のパラメータ型として再利用する。
 * 管理画面経由の入力であっても実行時に検証し、型と実値を一致させる。
 */
const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
  type: z.nativeEnum(AnnouncementType),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
})
type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>

const updateAnnouncementSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  type: z.nativeEnum(AnnouncementType).optional(),
  isActive: z.boolean().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().nullable().optional(),
})
type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>

export async function getAnnouncements(options?: {
  isActive?: boolean
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('announcements:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const { isActive, limit = DEFAULT_PAGE_LIMIT, cursor } = options || {}

    const where = {
      ...(isActive !== undefined && { isActive }),
    }

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.announcement.count({ where }),
    ])

    const nextCursor = announcements.length === limit ? announcements[announcements.length - 1]?.id : undefined
    return { announcements, total, nextCursor }
  } catch (error) {
    logger.error('getAnnouncements failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function createAnnouncement(data: CreateAnnouncementInput) {
  return withAuth(requireAdmin('announcements:manage'), async (admin) => {
    const parsed = createAnnouncementSchema.safeParse(data)
    if (!parsed.success) return actionError(ERR_INVALID_INPUT)
    data = parsed.data
    if (!data.title.trim()) return actionError(ERR_ANNOUNCEMENT_TITLE_REQUIRED)

    try {
      const announcement = await prisma.announcement.create({
        data: {
          title: data.title.trim(),
          content: data.content,
          type: data.type,
          startsAt: new Date(data.startsAt),
          endsAt: data.endsAt ? new Date(data.endsAt) : null,
          createdBy: admin.userId,
        },
      })

      // typeがnotificationまたはbothの場合、全ユーザーにシステム通知を作成
      //
      // カーソルベースでページング:
      // - オフセット方式は後半のページほど線形に遅くなる（skip N = N 行スキャン）
      // - cursor + PK インデックスは常に O(log n) でページを取得できる
      // - 大規模ユーザーテーブルでもスケールする
      if (data.type === 'notification' || data.type === 'both') {
        // システム通知は createNotificationsBulk 経由で配信（CLAUDE.md ルール6）。
        // - checkBlocks=false: system 通知は管理者→全員の一方向告知でブロック対象外
        // - skipPushNotification=true: 全ユーザー一斉 push は通知過多になるため抑止（既存挙動を維持）
        // - 通知本文は Announcement 表から参照する設計（Notification モデルに body カラムなし）
        let cursor: string | undefined
        while (true) {
          const users = await prisma.user.findMany({
            select: { id: true },
            take: NOTIFICATION_BATCH_SIZE,
            orderBy: { id: 'asc' },
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
          })
          if (users.length === 0) break

          await createNotificationsBulk({
            recipientIds: users.map((u) => u.id),
            actorId: admin.userId,
            type: 'system',
            checkBlocks: false,
            skipPushNotification: true,
          })

          // バッチサイズ未満 = 最後のページ
          if (users.length < NOTIFICATION_BATCH_SIZE) break
          cursor = users[users.length - 1]?.id
          if (!cursor) break
        }
      }

      await prisma.adminLog.create({
        data: {
          adminId: admin.userId,
          action: ACTION_CREATE_ANNOUNCEMENT,
          targetType: 'announcement',
          targetId: announcement.id,
          details: JSON.stringify({ title: data.title }),
        },
      })

      revalidatePath(ROUTE_ADMIN_ANNOUNCEMENTS)
      revalidateTag('announcements', 'max')
      return actionSuccess()
    } catch (error) {
      logger.error('createAnnouncement failed', { error: error instanceof Error ? error.message : String(error) })
      return actionError(ERR_OPERATION_FAILED)
    }
  })
}

export async function updateAnnouncement(id: string, data: UpdateAnnouncementInput) {
  return withAuth(requireAdmin('announcements:manage'), async () => {
    const parsed = updateAnnouncementSchema.safeParse(data)
    if (!parsed.success) return actionError(ERR_INVALID_INPUT)
    data = parsed.data
    try {
      const existing = await prisma.announcement.findUnique({ where: { id } })
      if (!existing) return actionError(ERR_ANNOUNCEMENT_NOT_FOUND)

      await prisma.announcement.update({
        where: { id },
        data: {
          ...(data.title && { title: data.title.trim() }),
          ...(data.content !== undefined && { content: data.content }),
          ...(data.type && { type: data.type }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.startsAt && { startsAt: new Date(data.startsAt) }),
          ...(data.endsAt !== undefined && { endsAt: data.endsAt ? new Date(data.endsAt) : null }),
        },
      })

      revalidatePath(ROUTE_ADMIN_ANNOUNCEMENTS)
      revalidateTag('announcements', 'max')
      return actionSuccess()
    } catch (error) {
      logger.error('updateAnnouncement failed', { error: error instanceof Error ? error.message : String(error) })
      return actionError(ERR_OPERATION_FAILED)
    }
  })
}

export async function deleteAnnouncement(id: string) {
  return withAuth(requireAdmin('announcements:manage'), async (admin) => {
    try {
      const existing = await prisma.announcement.findUnique({ where: { id } })
      if (!existing) return actionError(ERR_ANNOUNCEMENT_NOT_FOUND)

      await prisma.$transaction([
        prisma.announcement.delete({ where: { id } }),
        prisma.adminLog.create({
          data: {
            adminId: admin.userId,
            action: ACTION_DELETE_ANNOUNCEMENT,
            targetType: 'announcement',
            targetId: id,
            details: JSON.stringify({ title: existing.title }),
          },
        }),
      ])

      revalidatePath(ROUTE_ADMIN_ANNOUNCEMENTS)
      revalidateTag('announcements', 'max')
      return actionSuccess()
    } catch (error) {
      logger.error('deleteAnnouncement failed', { error: error instanceof Error ? error.message : String(error) })
      return actionError(ERR_OPERATION_FAILED)
    }
  })
}
