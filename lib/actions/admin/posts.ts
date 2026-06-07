'use server'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { revalidatePath } from 'next/cache'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { requireAdmin, actionSuccess, actionError } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { detachHashtagsFromPost } from '@/lib/services/hashtag-sync'
import { revalidatePopularTagsCache, revalidateTrendingGenresCache } from '@/lib/cache'
import { ERR_POST_NOT_FOUND, ERR_OPERATION_FAILED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_ADMIN_POSTS } from '@/lib/constants/routes'
import { ACTION_DELETE_POST } from '@/lib/constants/admin-actions'
import { logger } from '@/lib/logger'
import { adminIdSchema, adminReasonSchema } from './_schemas'

export async function getAdminPosts(options?: {
  search?: string
  hasReports?: boolean
  sortBy?: 'createdAt' | 'likeCount' | 'reportCount'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('posts:view')
  if ('error' in admin) return actionError(admin.error)

  const {
    search,
    hasReports = false,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    limit = DEFAULT_PAGE_LIMIT,
    cursor,
  } = options || {}

  try {
    // hasReports=true のときだけ、対象テーブル全体ではなく通報のある投稿 ID 集合に絞り込む。
    let reportedPostIds: string[] = []
    if (hasReports) {
      const reports = await prisma.report.findMany({
        where: { targetType: 'post' },
        select: { targetId: true },
        distinct: ['targetId'],
      })
      reportedPostIds = reports.map((r: typeof reports[number]) => r.targetId)
    }

    const where = {
      ...(search && {
        content: { contains: search },
      }),
      ...(hasReports && {
        id: { in: reportedPostIds },
      }),
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: {
            select: USER_MINIMAL_SELECT,
          },
          _count: {
            select: { likes: true, comments: { where: { deletedAt: null } } },
          },
        },
        orderBy:
          sortBy === 'likeCount'
            ? [{ likes: { _count: sortOrder } }, { id: sortOrder }]
            : [{ [sortBy]: sortOrder }, { id: sortOrder }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.post.count({ where }),
    ])

    // N+1 回避: groupBy で全対象 ID の通報件数をまとめて取得する。
    const postIds = posts.map((post: typeof posts[number]) => post.id)
    const reportCounts = postIds.length > 0
      ? await prisma.report.groupBy({
          by: ['targetId'],
          where: { targetType: 'post', targetId: { in: postIds } },
          _count: { targetId: true },
        })
      : []

    const reportCountMap = new Map(
      reportCounts.map((r: { targetId: string; _count: { targetId: number } }) => [r.targetId, r._count.targetId] as const)
    )

    const postsWithReportCount = posts.map((post: typeof posts[number]) => ({
      ...post,
      reportCount: reportCountMap.get(post.id) ?? 0,
    }))

    const nextCursor = posts.length === limit ? posts[posts.length - 1]?.id : undefined
    return { posts: postsWithReportCount, total, nextCursor }
  } catch (error) {
    logger.error('Get admin posts error', { error: error instanceof Error ? error.message : String(error) })
    return { posts: [], total: 0, nextCursor: undefined }
  }
}

export async function deletePostByAdmin(postId: string, reason: string) {
  const admin = await requireAdmin('posts:delete')
  if ('error' in admin) return actionError(admin.error)
  const adminUserId = admin.userId

  const idParsed = adminIdSchema.safeParse(postId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)
  const reasonParsed = adminReasonSchema.safeParse(reason)
  if (!reasonParsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const post = await prisma.post.findUnique({
      where: { id: idParsed.data },
      select: { id: true },
    })

    if (!post) {
      return actionError(ERR_POST_NOT_FOUND)
    }

    // ユーザー削除と同様に、denormalized な Hashtag.count を維持するため事前に detach する。
    // PostHashtag 行は cascade で消えるが count は別途減算しないとドリフトする（best-effort）。
    await detachHashtagsFromPost(idParsed.data)

    // interactive トランザクションで削除と監査ログを atomic に書き込む。
    await prisma.$transaction(async (tx) => {
      await tx.post.delete({ where: { id: idParsed.data } })
      await tx.adminLog.create({
        data: {
          adminId: adminUserId,
          action: ACTION_DELETE_POST,
          targetType: 'post',
          targetId: idParsed.data,
          details: JSON.stringify({ reason: reasonParsed.data }),
        },
      })
    })

    revalidatePath(ROUTE_ADMIN_POSTS)
    revalidatePopularTagsCache()
    revalidateTrendingGenresCache()
    return actionSuccess()
  } catch (error) {
    logger.error('Delete post by admin error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}
