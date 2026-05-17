/**
 * ブロック/ミュートフィルタリングヘルパー（サーバー内部 helper）。
 *
 * @module lib/actions/filter-helper
 */

import 'server-only'
import { cache } from 'react'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import { getRedisClient } from '@/lib/redis'
import { MUTED_IDS_CACHE_TTL_SECONDS, MAX_RELATION_FETCH } from '@/lib/constants/limits'
import { parseCachedWithSchema } from '@/lib/utils/json'

const cachedIdListSchema = z.array(z.string())

/**
 * どのユーザー群を除外リストに含めるか選択するフラグ群。
 * - `blocked`: 自分がブロックしたユーザー
 * - `blockedBy`: 自分をブロックしたユーザー
 * - `muted`: 自分がミュートしたユーザー
 */
export type FilterOptions = {
  blocked?: boolean
  blockedBy?: boolean
  muted?: boolean
}

/**
 * 除外すべきユーザー ID の配列を返す。
 *
 * React `cache()` でリクエスト単位にメモ化しており、同一リクエスト内で
 * 複数回呼ばれても DB アクセスは 1 回。`cache()` は引数の参照等価性で
 * キャッシュヒットを判定するため、options を JSON 文字列に正規化して渡す。
 */
const getExcludedUserIdsInternal = cache(async (
  userId: string,
  optionsKey: string,
): Promise<string[]> => {
  const options: FilterOptions = JSON.parse(optionsKey)
  return getExcludedUserIdsCore(userId, options)
})

export async function getExcludedUserIds(
  userId: string,
  options: FilterOptions = {}
): Promise<string[]> {
  return getExcludedUserIdsInternal(userId, JSON.stringify(options))
}

async function getExcludedUserIdsCore(
  userId: string,
  options: FilterOptions = {}
): Promise<string[]> {
  const { blocked = false, blockedBy = false, muted = false } = options

  if (!blocked && !blockedBy && !muted) {
    return []
  }

  // ブロック/ミュートを型安全に並列取得する。
  // Promise.all がタプル型で推論されるため、各要素に Prisma の静的型が付く。
  const blockOrConditions: { blockerId?: string; blockedId?: string }[] = []
  if (blocked) blockOrConditions.push({ blockerId: userId })
  if (blockedBy) blockOrConditions.push({ blockedId: userId })

  const [blockRows, muteRows] = await Promise.all([
    blockOrConditions.length > 0
      ? prisma.block.findMany({
          where: { OR: blockOrConditions },
          select: { blockerId: true, blockedId: true },
          take: MAX_RELATION_FETCH,
        })
      : [],
    muted
      ? prisma.mute.findMany({
          where: { muterId: userId },
          select: { mutedId: true },
          take: MAX_RELATION_FETCH,
        })
      : [],
  ])

  const excludedIds = new Set<string>()
  for (const row of blockRows) {
    if (blocked) excludedIds.add(row.blockedId)
    if (blockedBy) excludedIds.add(row.blockerId)
  }
  for (const row of muteRows) {
    excludedIds.add(row.mutedId)
  }

  // blockedBy で自分のIDが `blockedId` として返るケースを除外
  excludedIds.delete(userId)

  return Array.from(excludedIds)
}

/** 自分がブロックしたユーザー ID のみを取得する軽量版。 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  try {
    const blocks = await prisma.block.findMany({
      where: { blockerId: userId },
      select: { blockedId: true },
      take: MAX_RELATION_FETCH,
    })
    return blocks.map((b: { blockedId: string }) => b.blockedId)
  } catch (error) {
    logger.error('getBlockedUserIds failed', { userId, error })
    return []
  }
}

/**
 * 自分がミュートしたユーザー ID を取得する軽量版。
 * Redis に 60 秒キャッシュし、Redis 障害時は DB フォールバックする。
 */
export async function getMutedUserIds(userId: string): Promise<string[]> {
  const cacheKey = `muted_ids:${userId}`

  try {
    const redis = getRedisClient()
    const cached = await redis.get(cacheKey)
    if (cached !== null && cached !== undefined) {
      const parsed = parseCachedWithSchema(cached, cachedIdListSchema)
      if (parsed) return parsed
    }
  } catch {
    // Redis 障害はフェイルオープン（DB フォールバック）
  }

  try {
    const mutes = await prisma.mute.findMany({
      where: { muterId: userId },
      select: { mutedId: true },
      take: MAX_RELATION_FETCH,
    })
    const mutedIds = mutes.map((m: { mutedId: string }) => m.mutedId)

    try {
      const redis = getRedisClient()
      await redis.set(cacheKey, JSON.stringify(mutedIds), { ex: MUTED_IDS_CACHE_TTL_SECONDS })
    } catch {
      // キャッシュ書き込み失敗は無視
    }

    return mutedIds
  } catch (error) {
    logger.error('getMutedUserIds failed', { userId, error })
    return []
  }
}
