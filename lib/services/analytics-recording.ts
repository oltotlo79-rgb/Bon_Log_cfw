/**
 * @module lib/services/analytics-recording
 * UserAnalytics の累積カウンタ更新ロジック (共有 domain logic)。
 *
 * Why service 層か:
 *   - Server Action / Route Handler 双方から呼ばれる
 *   - 呼び出し側で auth / 認可 / rate-limit が済んでいる前提
 *   - service 自身は副作用 (DB upsert) のみで、HTTP / Action の境界を持たない
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { getStartOfToday } from '@/lib/utils'

type RecorderField =
  | 'profileViews'
  | 'postViews'
  | 'likesReceived'
  | 'newFollowers'

/**
 * 指定ユーザーの当日 UserAnalytics の任意 field を +1 する。
 *
 * Why throw する設計か:
 *   service 層は副作用 (DB upsert) のみで HTTP / Action の境界を持たない。
 *   失敗は caller (Action / Route Handler) が判断してログ・レスポンスを決める。
 *   既存 Action 側は try/catch で `actionError` に詰め替える方針。
 */
async function incrementAnalyticsField(userId: string, field: RecorderField): Promise<void> {
  const today = getStartOfToday()
  await prisma.userAnalytics.upsert({
    where: { userId_date: { userId, date: today } },
    update: { [field]: { increment: 1 } },
    create: { userId, date: today, [field]: 1 },
  })
}

export async function recordProfileViewService(userId: string): Promise<void> {
  return incrementAnalyticsField(userId, 'profileViews')
}

export async function recordPostViewService(userId: string): Promise<void> {
  return incrementAnalyticsField(userId, 'postViews')
}

export async function recordLikeReceivedService(userId: string): Promise<void> {
  return incrementAnalyticsField(userId, 'likesReceived')
}

export async function recordNewFollowerService(userId: string): Promise<void> {
  return incrementAnalyticsField(userId, 'newFollowers')
}
