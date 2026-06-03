'use server'

import { prisma } from '@/lib/db'
import {
  ONE_HOUR_MS,
  ONE_DAY_MS,
  SUSPICIOUS_LIKES_PER_HOUR,
  SUSPICIOUS_POSTS_PER_DAY,
  SUSPICIOUS_REPORTS_THRESHOLD,
  SUSPICIOUS_FOLLOWS_PER_HOUR,
  ACTIVITY_PREVIEW_LENGTH,
  ACTIVITY_ID_PREVIEW_LENGTH,
} from '@/lib/constants/limits'
import { requireAdmin, actionError } from '@/lib/actions/utils'
import { clampLimit } from '@/lib/actions/pagination'
import { ERR_USER_NOT_FOUND, ERR_OPERATION_FAILED } from '@/lib/constants/errors'
import { logger } from '@/lib/logger'

type ActivityItem = {
  type: 'post' | 'comment' | 'like' | 'follow' | 'login'
  id: string
  description: string
  createdAt: Date
  metadata?: Record<string, unknown>
}

/**
 * ユーザーのアクティビティタイムラインを集約して取得
 */
export async function getUserActivity(userId: string, options?: {
  limit?: number
}) {
  const admin = await requireAdmin('users:activity')
  if ('error' in admin) return actionError(admin.error)

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nickname: true },
    })
    if (!user) return actionError(ERR_USER_NOT_FOUND)

    const limit = clampLimit(options?.limit)
    const [posts, comments, likes, follows, devices] = await Promise.all([
      prisma.post.findMany({
        where: { userId },
        select: { id: true, content: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.comment.findMany({
        where: { userId },
        select: { id: true, content: true, createdAt: true, postId: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.like.findMany({
        where: { userId },
        select: { id: true, postId: true, commentId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.follow.findMany({
        where: { followerId: userId },
        select: { followerId: true, followingId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.userDevice.findMany({
        where: { userId },
        select: { id: true, ipAddress: true, userAgent: true, lastSeenAt: true },
        orderBy: { lastSeenAt: 'desc' },
        take: limit,
      }),
    ])

    const activities: ActivityItem[] = [
      ...posts.map(p => ({
        type: 'post' as const,
        id: p.id,
        description: `投稿: ${(p.content || '').slice(0, ACTIVITY_PREVIEW_LENGTH)}`,
        createdAt: p.createdAt,
      })),
      ...comments.map(c => ({
        type: 'comment' as const,
        id: c.id,
        description: `コメント: ${(c.content || '').slice(0, ACTIVITY_PREVIEW_LENGTH)}`,
        createdAt: c.createdAt,
        metadata: { postId: c.postId },
      })),
      ...likes.map(l => ({
        type: 'like' as const,
        id: l.id,
        description: l.commentId ? 'コメントにいいね' : '投稿にいいね',
        createdAt: l.createdAt,
        metadata: { postId: l.postId, commentId: l.commentId },
      })),
      ...follows.map(f => ({
        type: 'follow' as const,
        id: `${f.followerId}-${f.followingId}`,
        description: `ユーザー ${f.followingId.slice(0, ACTIVITY_ID_PREVIEW_LENGTH)}... をフォロー`,
        createdAt: f.createdAt,
      })),
      ...devices.map(d => ({
        type: 'login' as const,
        id: d.id,
        description: `ログイン (IP: ${d.ipAddress || '不明'})`,
        createdAt: d.lastSeenAt,
        metadata: { ip: d.ipAddress, userAgent: d.userAgent },
      })),
    ]

    // 時系列でソートし、上限を適用
    activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return {
      user,
      activities: activities.slice(0, limit),
      total: activities.length,
    }
  } catch (error) {
    logger.error('getUserActivity failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/**
 * 不審行動を検知
 */
export async function detectSuspiciousBehavior(userId: string) {
  const admin = await requireAdmin('users:activity')
  if ('error' in admin) return actionError(admin.error)

  try {
    const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS)
    const oneDayAgo = new Date(Date.now() - ONE_DAY_MS)

    const [likesLastHour, postsLastDay, reportsAgainst, followsLastHour] = await Promise.all([
      prisma.like.count({ where: { userId, createdAt: { gte: oneHourAgo } } }),
      prisma.post.count({ where: { userId, createdAt: { gte: oneDayAgo } } }),
      prisma.report.count({ where: { targetType: 'user', targetId: userId } }),
      prisma.follow.count({ where: { followerId: userId, createdAt: { gte: oneHourAgo } } }),
    ])

    const flags = []
    if (likesLastHour > SUSPICIOUS_LIKES_PER_HOUR) flags.push({ type: 'mass_likes', value: likesLastHour, threshold: SUSPICIOUS_LIKES_PER_HOUR })
    if (postsLastDay > SUSPICIOUS_POSTS_PER_DAY) flags.push({ type: 'mass_posts', value: postsLastDay, threshold: SUSPICIOUS_POSTS_PER_DAY })
    if (reportsAgainst > SUSPICIOUS_REPORTS_THRESHOLD) flags.push({ type: 'many_reports', value: reportsAgainst, threshold: SUSPICIOUS_REPORTS_THRESHOLD })
    if (followsLastHour > SUSPICIOUS_FOLLOWS_PER_HOUR) flags.push({ type: 'mass_follows', value: followsLastHour, threshold: SUSPICIOUS_FOLLOWS_PER_HOUR })

    return { userId, flags, isSuspicious: flags.length > 0 }
  } catch (error) {
    logger.error('detectSuspiciousBehavior failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}
