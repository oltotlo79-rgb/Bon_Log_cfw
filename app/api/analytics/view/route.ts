/**
 * @module app/api/analytics/view
 * Server Component から切り離した「閲覧」beacon の受信口。
 *
 * 処理順序: 認証 → Zod 検証 → rate limit → 閲覧権限再確認 → Redis dedupe → record*View。
 * Why render から分離するか:
 *   - render が write を含むと prefetch / RSC retry / crawler でも view が増える
 *   - 閲覧可否判定 (block / non-public) より前に書き込みが走るリスクをなくす
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  recordPostViewService,
  recordProfileViewService,
} from '@/lib/services/analytics-recording'
import { rateLimit } from '@/lib/rate-limit'
import { redis } from '@/lib/redis'
import {
  MAX_NOTIFICATION_ID_LENGTH,
  ONE_MINUTE_MS,
  VIEW_BEACON_DEDUPE_SECONDS,
  VIEW_BEACON_RATE_LIMIT_PER_MINUTE,
} from '@/lib/constants/limits'
import { ERR_AUTH_REQUIRED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import logger from '@/lib/logger'

export const dynamic = 'force-dynamic'

const idSchema = z.string().min(1).max(MAX_NOTIFICATION_ID_LENGTH)

const beaconSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('post'),
    postId: idSchema,
    targetUserId: idSchema,
  }),
  z.object({
    type: z.literal('profile'),
    targetUserId: idSchema,
  }),
])

export async function POST(request: NextRequest) {
  // 1. 認証
  const session = await auth()
  const viewerId = session?.user?.id
  if (!viewerId) {
    return NextResponse.json({ error: ERR_AUTH_REQUIRED }, { status: 401 })
  }

  // 2. 入力検証 (sendBeacon は失敗を観測できないため status 4xx は client に届かないが、
  //    DoS / 不正入力での書き込みを止めるため必ず検証する)
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: ERR_INVALID_INPUT }, { status: 400 })
  }
  const parsed = beaconSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: ERR_INVALID_INPUT }, { status: 400 })
  }
  const data = parsed.data

  // 3. 同一閲覧者の連射的記録を抑制 (failOpen で beacon 自体は通すが集計は防ぐ)
  const rateLimitResult = await rateLimit(`analytics-view:${viewerId}`, {
    windowMs: ONE_MINUTE_MS,
    maxRequests: VIEW_BEACON_RATE_LIMIT_PER_MINUTE,
    failOpen: true,
  })
  if (!rateLimitResult.success) {
    return new NextResponse(null, { status: 204 })
  }

  // 4. 閲覧権限の再確認 (ブロック / 非公開 / 削除済みは集計対象外)
  const allowed = await canRecord(data, viewerId)
  if (!allowed) {
    return new NextResponse(null, { status: 204 })
  }

  // 5. Dedupe (短時間の重複 view を 1 件に集約)
  const dedupeKey = buildDedupeKey(data, viewerId)
  const seen = await redis.client.get(dedupeKey)
  if (seen) {
    return new NextResponse(null, { status: 204 })
  }
  await redis.client.set(dedupeKey, '1', { ex: VIEW_BEACON_DEDUPE_SECONDS })

  // 6. 集計記録 (失敗は監視ログのみ。beacon 失敗を 5xx で返さない)
  try {
    if (data.type === 'post') {
      await recordPostViewService(data.targetUserId)
    } else {
      await recordProfileViewService(data.targetUserId)
    }
  } catch (error) {
    logger.error('analytics view beacon record failed', {
      type: data.type,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return new NextResponse(null, { status: 204 })
}

type BeaconData = z.infer<typeof beaconSchema>

/**
 * 投稿 / プロフィールの閲覧可否を確認する。
 *   - 自分自身の閲覧は計上しない
 *   - 投稿: 非表示 / 投稿者の userId が body と不一致なら拒否
 *   - プロフィール: 停止中 / 非公開なら拒否
 *   - 双方向: 相手にブロックされていれば拒否
 */
async function canRecord(data: BeaconData, viewerId: string): Promise<boolean> {
  if (data.targetUserId === viewerId) return false

  const blockedBy = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: data.targetUserId, blockedId: viewerId } },
    select: { blockerId: true },
  })
  if (blockedBy) return false

  if (data.type === 'post') {
    const post = await prisma.post.findUnique({
      where: { id: data.postId },
      select: { isHidden: true, userId: true },
    })
    if (!post || post.isHidden) return false
    if (post.userId !== data.targetUserId) return false
    return true
  }

  const user = await prisma.user.findUnique({
    where: { id: data.targetUserId },
    select: { isPublic: true, isSuspended: true },
  })
  if (!user || user.isSuspended) return false
  if (!user.isPublic) return false
  return true
}

function buildDedupeKey(data: BeaconData, viewerId: string): string {
  if (data.type === 'post') return `view:post:${viewerId}:${data.postId}`
  return `view:profile:${viewerId}:${data.targetUserId}`
}
