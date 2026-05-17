'use server'

/**
 * システム監視用Server Actions
 *
 * ヘルスチェック、レート制限状況、Redis接続状態を監視します。
 *
 * @module lib/actions/admin/monitoring
 */

import { prisma } from '@/lib/db'
import { getRedisClient } from '@/lib/redis'
import { requireAdmin, actionSuccess, actionError } from '@/lib/actions/utils'
import { ONE_DAY_MS, HEALTH_CHECK_PING_TTL_SECONDS, REDIS_LATENCY_DEGRADED_THRESHOLD_MS } from '@/lib/constants/limits'
import { ERR_MONITORING_DATA_FETCH_FAILED } from '@/lib/constants/errors'
import logger from '@/lib/logger'

export type SystemHealthStatus = {
  database: { status: 'healthy' | 'unhealthy'; latencyMs: number }
  redis: { status: 'healthy' | 'unhealthy' | 'degraded'; latencyMs: number }
  timestamp: string
}

export type MonitoringStats = {
  health: SystemHealthStatus
  counts: {
    totalUsers: number
    totalPosts: number
    activeUsersToday: number
    postsToday: number
    pendingReports: number
    pendingModeration: number
  }
  rateLimiting: {
    recentBlocks: number
  }
}

/**
 * システムヘルス情報を取得
 */
async function checkSystemHealth(): Promise<SystemHealthStatus> {
  const timestamp = new Date().toISOString()

  // DB接続チェック
  let dbStatus: SystemHealthStatus['database'] = { status: 'unhealthy', latencyMs: 0 }
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    dbStatus = { status: 'healthy', latencyMs: Date.now() - dbStart }
  } catch (err) {
    logger.error('Monitoring: DB health check failed:', err)
    dbStatus = { status: 'unhealthy', latencyMs: 0 }
  }

  // Redis接続チェック
  let redisStatus: SystemHealthStatus['redis'] = { status: 'unhealthy', latencyMs: 0 }
  try {
    const redis = getRedisClient()
    const redisStart = Date.now()
    await redis.set('health:ping', 'pong', { ex: HEALTH_CHECK_PING_TTL_SECONDS })
    const result = await redis.get('health:ping')
    const latencyMs = Date.now() - redisStart
    if (result === 'pong') {
      redisStatus = { status: latencyMs > REDIS_LATENCY_DEGRADED_THRESHOLD_MS ? 'degraded' : 'healthy', latencyMs }
    } else {
      redisStatus = { status: 'degraded', latencyMs }
    }
  } catch (err) {
    logger.error('Monitoring: Redis health check failed:', err)
    redisStatus = { status: 'unhealthy', latencyMs: 0 }
  }

  return { database: dbStatus, redis: redisStatus, timestamp }
}

/**
 * 監視ダッシュボード用データを取得
 */
export async function getMonitoringStats() {
  const admin = await requireAdmin('stats:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const health = await checkSystemHealth()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      totalUsers,
      totalPosts,
      activeUsersToday,
      postsToday,
      pendingReports,
      pendingModeration,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.user.count({ where: { updatedAt: { gte: today } } }),
      prisma.post.count({ where: { createdAt: { gte: today } } }),
      prisma.report.count({ where: { status: 'pending' } }),
      prisma.moderationQueue.count({ where: { status: 'pending' } }),
    ])

    // レート制限ブロック数の取得（SecurityEventがあれば）
    let recentBlocks = 0
    try {
      recentBlocks = await prisma.securityEvent.count({
        where: {
          eventType: 'rate_limit_exceeded',
          createdAt: { gte: new Date(Date.now() - ONE_DAY_MS) },
        },
      })
    } catch {
      // SecurityEventテーブルにrate_limit_exceededがなくてもOK
    }

    const stats: MonitoringStats = {
      health,
      counts: {
        totalUsers,
        totalPosts,
        activeUsersToday,
        postsToday,
        pendingReports,
        pendingModeration,
      },
      rateLimiting: { recentBlocks },
    }

    return actionSuccess(stats)
  } catch (error) {
    logger.error('Failed to get monitoring stats:', error)
    return actionError(ERR_MONITORING_DATA_FETCH_FAILED)
  }
}
