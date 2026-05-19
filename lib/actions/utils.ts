/**
 * @module lib/actions/utils
 *
 * Server Actions の共通 helper を集約する通常モジュール。
 *
 * Why no `'use server'`: `'use server'` を付けると全 export が Action ID を持ち、
 * クライアントから任意 userId で `getUserRelationSets` / `invalidateUserRelationsCache`
 * 等を呼び出せる攻撃面になるため、helper はディレクティブを持たない通常モジュールとする。
 */

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { headers } from 'next/headers'
import { auth as rawAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkUserRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getRedisClient } from '@/lib/redis'
import { ERR_AUTH_REQUIRED, ERR_ADMIN_REQUIRED, ERR_ACCOUNT_SUSPENDED, ERR_RATE_LIMIT_OPERATION, ERR_GUEST_CANNOT_CREATE, ERR_MEDIA_DATA_INVALID, ERR_DAILY_POST_LIMIT, ERR_IMAGE_LIMIT, ERR_VIDEO_LIMIT } from '@/lib/constants/errors'
import { getMembershipLimits } from '@/lib/premium'
import { getStartOfToday } from '@/lib/utils'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { actionSuccess as actionSuccessHelper, actionError as actionErrorHelper, type ActionResult as ActionResultType } from '@/types/action-result'
import logger from '@/lib/logger'
import { REDIS_RELATIONS_TTL_SECONDS, ONE_SECOND_MS, MIDNIGHT_BUFFER_SECONDS, GUEST_USER_CACHE_REVALIDATE_SECONDS, MAX_RELATION_FETCH, RELATION_FETCH_WARN_THRESHOLD } from '@/lib/constants/limits'
import { z } from 'zod'
import { parseCachedWithSchema } from '@/lib/utils/json'
import { extractClientIp } from '@/lib/utils/client-ip'

export type ActionResult<T = void> = ActionResultType<T>
export const actionSuccess = actionSuccessHelper
export const actionError = actionErrorHelper

// React cache() で同一リクエスト内の auth() 呼び出しを 1 回に集約する。
const auth = cache(rawAuth)

/**
 * 画像・動画の枚数バリデーション。
 * 問題なければ null、エラーがあれば `ActionResult`（error）を返す。
 */
export async function validateMediaCounts(
  mediaUrls: string[],
  mediaTypes: string[],
  limits: { maxImages: number; maxVideos: number }
): Promise<ActionResult<never> | null> {
  if (mediaUrls.length !== mediaTypes.length) {
    return actionError(ERR_MEDIA_DATA_INVALID)
  }
  const imageCount = mediaTypes.filter((t: string) => t === 'image').length
  const videoCount = mediaTypes.filter((t: string) => t === 'video').length
  if (imageCount > limits.maxImages) {
    return actionError(ERR_IMAGE_LIMIT(limits.maxImages))
  }
  if (videoCount > limits.maxVideos) {
    return actionError(ERR_VIDEO_LIMIT(limits.maxVideos))
  }
  return null
}

/** 認証を要求する。未認証なら `{ error }` を返す。 */
export async function requireAuth(): Promise<
  { userId: string } | { error: string }
> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: ERR_AUTH_REQUIRED }
  }
  return { userId: session.user.id }
}

/**
 * ゲストはデータ作成不可。投稿・コメント・いいね・フォロー等の作成系で使用する。
 */
export async function requireNotGuest(): Promise<{ error: string } | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  const email = session.user.email
  if (email === GUEST_EMAIL) return { error: ERR_GUEST_CANNOT_CREATE }
  return null
}

/**
 * 認証 + アカウント停止チェック を一括で行う内部ヘルパー。
 * `requireActiveUser` / `requireActiveNonGuestUser` の共通土台で、レート制限が
 * 不要な経路（書き込みでない or 動的キー）にも使い回せるようにしてある。
 */
async function authenticatedActiveUser(): Promise<{ userId: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: ERR_AUTH_REQUIRED }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuspended: true },
  })
  if (user?.isSuspended) {
    return { error: ERR_ACCOUNT_SUSPENDED }
  }

  return { userId: session.user.id }
}

/**
 * 認証 + アカウント停止チェックを行う。
 *
 * Why: Server Action は「認証 → Zod → レート制限」の順 (CLAUDE.md ルール3) を
 * 守る必要があるため、この helper はレート制限を含めない。呼び出し側で
 * Zod 検証後に `checkUserRateLimit(userId, 'action')` を明示的に呼ぶこと。
 */
export async function requireActiveUser(): Promise<
  { userId: string } | { error: string }
> {
  return authenticatedActiveUser()
}

/**
 * 認証 + アカウント停止 + 非ゲストの 3 条件を確認する。
 *
 * Why: `requireActiveUser` と同じく、レート制限は呼び出し側で行う設計。
 * Zod 検証で弾かれる入力に対してレート制限を消費しないようにする。
 */
export async function requireActiveNonGuestUser(): Promise<
  { userId: string } | { error: string }
> {
  const authResult = await authenticatedActiveUser()
  if ('error' in authResult) return authResult

  const guestCheck = await requireNotGuest()
  if (guestCheck) return guestCheck

  return authResult
}

/** レート制限を `lib/constants/errors` 経由のメッセージで返却するヘルパー。 */
export async function enforceUserRateLimit(
  userId: string,
  action: keyof typeof RATE_LIMITS,
): Promise<{ error: string } | null> {
  const result = await checkUserRateLimit(userId, action)
  return result.success ? null : { error: ERR_RATE_LIMIT_OPERATION }
}

/**
 * 管理者権限を要求し、ユーザーIDとロールを返す。
 * 未認証 / 停止済み / 管理者でない / 権限不足のいずれかなら `{ error }` を返す。
 *
 * Why fresh DB check: proxy.ts の admin gate は JWT の `isAdmin` flag に依存しており、
 * トークン発行後に DB 上で管理者解除 / アカウント停止された変更を反映できない。
 * そのため Server Action / API 側では `authenticatedActiveUser()` で DB の suspension
 * を確認した上で `adminUser` テーブルを引き直す。これにより admin 停止 / 権限剥奪が
 * 既存セッションに対しても即時有効になる。
 *
 * @param requiredAction - 必要な権限アクション（省略時はロール存在のみチェック）
 */
export async function requireAdmin(requiredAction?: import('@/lib/admin-permissions').AdminAction): Promise<
  { userId: string; role: import('@prisma/client').AdminRole } | { error: string }
> {
  const activeUser = await authenticatedActiveUser()
  if ('error' in activeUser) return { error: activeUser.error }
  const userId = activeUser.userId

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId },
    select: { role: true },
  })
  if (!adminUser) {
    return { error: ERR_ADMIN_REQUIRED }
  }

  if (requiredAction) {
    const { hasPermission } = await import('@/lib/admin-permissions')
    if (!hasPermission(adminUser.role, requiredAction)) {
      return { error: ERR_ADMIN_REQUIRED }
    }
  }

  return { userId, role: adminUser.role }
}

/**
 * Server Action のリクエストヘッダーからクライアント IP を取得する。
 *
 * 実体は `lib/utils/client-ip.ts` の `extractClientIp` に委譲し、
 * rate-limit / seed-auth と同じ信頼モデル (X-Forwarded-For は偽装耐性のある末尾優先)
 * を共有する。先頭採用はクライアントによる偽装を許してしまうため使用しない。
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers()
  return extractClientIp((name) => headersList.get(name))
}

/**
 * 1 日の投稿上限チェック。Redis INCR + EXPIRE でアトミックにカウントし、
 * TOCTOU race を防ぐ。Redis 障害時は DB カウントへフォールバック。
 * 上限内なら null、超過時は `ActionResult`（error）を返す。
 */
export async function checkDailyPostLimit(userId: string): Promise<ActionResult<void> | null> {
  const limits = await getMembershipLimits(userId)
  const today = getStartOfToday()

  // Redis INCR でアトミックカウント（TOCTOU対策）
  try {
    const redis = getRedisClient()
    const dateStr = today.toISOString().split('T')[0]
    const redisKey = `daily_posts:${userId}:${dateStr}`

    const count = await redis.incr(redisKey)
    if (count === 1) {
      // 新規キー: 翌日0時 + バッファで期限設定
      const tomorrow = new Date()
      tomorrow.setHours(24, 0, 0, 0)
      const msUntilMidnight = tomorrow.getTime() - Date.now()
      const secondsUntilMidnight = Math.ceil(msUntilMidnight / ONE_SECOND_MS) + MIDNIGHT_BUFFER_SECONDS
      await redis.expire(redisKey, secondsUntilMidnight)
    }
    if (count > limits.maxDailyPosts) {
      // INCR で上限を超えたが、デクリメントは行わない（TTL切れで自然にリセットされる）
      return actionError(ERR_DAILY_POST_LIMIT(limits.maxDailyPosts))
    }
    return null
  } catch (err) {
    logger.error('checkDailyPostLimit: Redis error, fallback to DB', { userId, err })
    // Redis 障害時はDBカウントにフォールバック
    const count = await prisma.post.count({
      where: { userId, createdAt: { gte: today } },
    })
    if (count >= limits.maxDailyPosts) {
      return actionError(ERR_DAILY_POST_LIMIT(limits.maxDailyPosts))
    }
    return null
  }
}

const userRelationSetsSchema = z.object({
  followingUserIds: z.array(z.string()),
  blockedUserIds: z.array(z.string()),
  mutedUserIds: z.array(z.string()),
  hiddenPostIds: z.array(z.string()),
})

type UserRelationSets = z.infer<typeof userRelationSetsSchema>


/**
 * リレーション取得が上限警告閾値を超えた場合に通知する。
 * silent truncation を可視化し、長期改善（Prisma relational filter 移行）の判断材料とする。
 *
 * - dev では `logger.warn` でコンソール出力。
 * - 本番では Sentry に `warning` level で送信し、運用上の閾値超過を可視化する。
 *   `logger` は error level のみ Sentry へ送るため、ここでは `Sentry.captureMessage` を直接呼ぶ。
 */
function warnIfRelationLimitApproaching(userId: string, kind: string, count: number): void {
  if (count < RELATION_FETCH_WARN_THRESHOLD) return

  logger.warn('Relation fetch approaching MAX_RELATION_FETCH', {
    userId,
    kind,
    count,
    limit: MAX_RELATION_FETCH,
  })

  // 本番環境のみ Sentry に通知。dev では logger.warn のみで十分（ノイズ抑制）。
  if (process.env.NODE_ENV !== 'production') return

  // 動的 import で Edge Runtime ビルドに混入させない（lib/actions/utils.ts は Node 限定）。
  // 失敗しても本処理を阻害しないよう catch して握りつぶす。
  void import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.captureMessage('Relation fetch approaching MAX_RELATION_FETCH', {
        level: 'warning',
        tags: { kind, area: 'relation-fetch' },
        extra: { userId, kind, count, limit: MAX_RELATION_FETCH, threshold: RELATION_FETCH_WARN_THRESHOLD },
      })
    })
    .catch(() => {
      // Sentry SDK 不在時は logger.warn だけで終了
    })
}

async function fetchUserRelationSetsFromDb(userId: string): Promise<UserRelationSets> {
  const [following, blocks, mutes, hiddenPosts] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true }, take: MAX_RELATION_FETCH }),
    prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true }, take: MAX_RELATION_FETCH }),
    prisma.mute.findMany({ where: { muterId: userId }, select: { mutedId: true }, take: MAX_RELATION_FETCH }),
    prisma.userHiddenPost.findMany({ where: { userId }, select: { postId: true }, take: MAX_RELATION_FETCH }),
  ])
  warnIfRelationLimitApproaching(userId, 'follow', following.length)
  warnIfRelationLimitApproaching(userId, 'block', blocks.length)
  warnIfRelationLimitApproaching(userId, 'mute', mutes.length)
  warnIfRelationLimitApproaching(userId, 'hiddenPost', hiddenPosts.length)
  return {
    followingUserIds: following.map(f => f.followingId),
    blockedUserIds: blocks.map(b => b.blockedId),
    mutedUserIds: mutes.map(m => m.mutedId),
    hiddenPostIds: hiddenPosts.map(h => h.postId),
  }
}

/**
 * フォロー/ブロック/ミュート情報をリクエスト単位でメモ化して返す。
 * 同一リクエスト内で複数回呼ばれても1回のDBアクセスで済む。
 * Redisキャッシュ（5分TTL）でリクエスト間のDB負荷も軽減する。
 */
export const getUserRelationSets = cache(async (userId: string): Promise<UserRelationSets> => {
  const cacheKey = `relations:${userId}`
  try {
    const redis = getRedisClient()
    const cached = await redis.get(cacheKey)
    const parsed = parseCachedWithSchema(cached, userRelationSetsSchema)
    if (parsed) return parsed
  } catch (err) {
    logger.error('getUserRelationSets: Redis get error:', err)
  }

  const result = await fetchUserRelationSetsFromDb(userId)

  try {
    const redis = getRedisClient()
    await redis.set(cacheKey, JSON.stringify(result), { ex: REDIS_RELATIONS_TTL_SECONDS })
  } catch (err) {
    logger.error('getUserRelationSets: Redis set error:', err)
  }

  return result
})

/**
 * Redisのユーザーリレーションキャッシュを無効化する。
 * フォロー/ブロック/ミュートが変更された際に呼び出す。
 */
export async function invalidateUserRelationsCache(userId: string): Promise<void> {
  try {
    const redis = getRedisClient()
    await redis.del(`relations:${userId}`)
  } catch (err) {
    logger.error('invalidateUserRelationsCache: Redis del error:', err)
  }
}

/**
 * ゲストユーザーのIDを取得する。
 * unstable_cache で1時間キャッシュするため、毎リクエストごとのDBアクセスを防ぐ。
 * ゲストユーザーIDは変わらないため長いTTLを設定している。
 */
export const getGuestUserId = unstable_cache(
  async (): Promise<string | null> => {
    const guest = await prisma.user.findUnique({
      where: { email: GUEST_EMAIL },
      select: { id: true },
    })
    return guest?.id ?? null
  },
  ['guest-user-id'],
  { revalidate: GUEST_USER_CACHE_REVALIDATE_SECONDS },
)

export async function getPostInteractionSets(userId: string, postIds: string[]) {
  if (postIds.length === 0) {
    return { likedSet: new Set<string>(), bookmarkedSet: new Set<string>() }
  }
  const [likedPosts, bookmarkedPosts] = await Promise.all([
    prisma.like.findMany({
      where: { userId, postId: { in: postIds }, commentId: null },
      select: { postId: true },
    }),
    prisma.bookmark.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true },
    }),
  ])
  return {
    likedSet: new Set(likedPosts.map((like: { postId: string | null }) => like.postId).filter((id: string | null): id is string => id !== null)),
    bookmarkedSet: new Set(bookmarkedPosts.map((b: { postId: string }) => b.postId)),
  }
}

/**
 * Server Action の try/catch ボイラープレートを 1 箇所に集約するヘルパー。
 * ログ形式統一のために段階採用する（既存の try/catch を強制移行しない）。
 *
 * @example
 * ```typescript
 * return withActionErrorHandler(
 *   { name: 'createPost', fallbackError: ERR_POST_CREATE_FAILED, context: { userId } },
 *   async () => {
 *     const post = await prisma.post.create({ data: {...} })
 *     return actionSuccess({ postId: post.id })
 *   },
 * )
 * ```
 */
export async function withActionErrorHandler<T>(
  options: {
    name: string
    fallbackError: string
    context?: Record<string, unknown>
  },
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn()
  } catch (error) {
    logger.error(`${options.name} failed`, {
      ...options.context,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(options.fallbackError)
  }
}
