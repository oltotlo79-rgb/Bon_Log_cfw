/**
 * ブロック機能のServer Actions
 *
 * @module lib/actions/block
 */

'use server'

/**
 * Prismaクライアント
 * データベース操作に使用
 */
import { prisma } from '@/lib/db'

/**
 * 認証ヘルパー
 * 共通の認証チェックパターンを提供
 */
import { requireActiveNonGuestUser, requireAuth, requireNotGuest, actionSuccess, actionError, type ActionResult, invalidateUserRelationsCache, enforceUserRateLimit } from '@/lib/actions/utils'

/**
 * Next.jsのキャッシュ再検証関数
 * ブロック後にページを更新するために使用
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { ERR_SELF_BLOCK, ERR_USER_NOT_FOUND, ERR_BLOCK_FAILED, ERR_UNBLOCK_FAILED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_FEED, ROUTE_SETTINGS_BLOCKED } from '@/lib/constants/routes'
import { buildUserPath } from '@/lib/constants/path-builders'

/**
 * ユーザーIDバリデーションスキーマ
 */
const userIdSchema = z.string().min(1, ERR_INVALID_INPUT).max(30)

/**
 * ロガー
 * エラーログの記録に使用
 */
import logger from '@/lib/logger'

/**
 * ユーザーをブロック
 *
 * ## 機能概要
 * 指定されたユーザーをブロックします。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. 自分自身へのブロック防止
 * 3. トランザクションで以下を実行:
 *    - 相互フォローを解除
 *    - ブロックレコードを作成
 * 4. キャッシュを再検証
 *
 * ## トランザクションの使用
 * フォロー解除とブロック作成を原子的に実行
 * どちらかが失敗した場合、両方ロールバック
 *
 * ## 相互フォロー解除
 * - 自分 → 相手 のフォロー
 * - 相手 → 自分 のフォロー
 * 両方を削除
 *
 * @param targetUserId - ブロック対象のユーザーID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await blockUser('user-123')
 * if (result.success) {
 *   toast.success('ユーザーをブロックしました')
 * }
 * ```
 */
export async function blockUser(targetUserId: string): Promise<ActionResult> {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const idParsed = userIdSchema.safeParse(targetUserId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)

  if (userId === targetUserId) {
    return actionError(ERR_SELF_BLOCK)
  }

  const rl = await enforceUserRateLimit(userId, 'block_user')
  if (rl) return actionError(rl.error)

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  })
  if (!targetUser) return actionError(ERR_USER_NOT_FOUND)

  try {
    await prisma.$transaction([
      prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: userId, followingId: targetUserId },
            { followerId: targetUserId, followingId: userId },
          ],
        },
      }),
      prisma.block.create({
        data: {
          blockerId: userId,
          blockedId: targetUserId,
        },
      }),
    ])

    await invalidateUserRelationsCache(userId)
    revalidatePath(ROUTE_FEED)
    revalidatePath(buildUserPath(targetUserId))

    return actionSuccess()
  } catch (error) {
    logger.error('Block user error:', error)
    return actionError(ERR_BLOCK_FAILED)
  }
}

/**
 * ブロックを解除
 *
 * ## 機能概要
 * 指定されたユーザーのブロックを解除します。
 *
 * ## 注意点
 * - ブロック解除してもフォロー関係は復活しない
 * - ブロック解除後、相手を再度フォローすることは可能
 *
 * ## 複合ユニークキー
 * blockerId_blockedId は Prisma スキーマで定義された
 * 複合ユニークキー（2つのフィールドの組み合わせでユニーク）
 *
 * @param targetUserId - ブロック解除対象のユーザーID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await unblockUser('user-123')
 * if (result.success) {
 *   toast.success('ブロックを解除しました')
 * }
 * ```
 */
export async function unblockUser(targetUserId: string): Promise<ActionResult> {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const idParsed = userIdSchema.safeParse(targetUserId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'unblock_user')
  if (rl) return actionError(rl.error)

  try {
    await prisma.block.delete({
      where: {
        blockerId_blockedId: {
          blockerId: userId,
          blockedId: targetUserId,
        },
      },
    })

    await invalidateUserRelationsCache(userId)
    revalidatePath(ROUTE_FEED)
    revalidatePath(buildUserPath(targetUserId))
    revalidatePath(ROUTE_SETTINGS_BLOCKED)

    return actionSuccess()
  } catch (error) {
    logger.error('Unblock user error:', error)
    return actionError(ERR_UNBLOCK_FAILED)
  }
}

/**
 * ブロックしたユーザー一覧を取得
 *
 * ## 機能概要
 * 現在のユーザーがブロックしているユーザーの一覧を取得します。
 *
 * ## 用途
 * - 設定画面の「ブロックしたユーザー」ページ
 * - ブロック解除のためのUI
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 * カーソルは blockedId を使用
 *
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @returns ブロックしたユーザー一覧と次のカーソル
 *
 * @example
 * ```typescript
 * const { users, nextCursor } = await getBlockedUsers()
 * ```
 */
export async function getBlockedUsers(cursor?: string, limit = DEFAULT_PAGE_LIMIT) {
  const auth = await requireAuth()
  if ('error' in auth) return { users: [] }
  const guestCheck = await requireNotGuest()
  if (guestCheck) return { users: [] }
  const userId = auth.userId

  try {

    /**
     * ブロックレコードを取得
     *
     * blocked を include してブロックされたユーザーの情報を取得
     */
    const blocks = await prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        /**
         * ブロックされたユーザーの情報
         */
        blocked: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      /**
       * カーソルベースページネーション
       *
       * 複合ユニークキーをカーソルとして使用
       */
      ...(cursor && {
        cursor: { blockerId_blockedId: { blockerId: userId, blockedId: cursor } },
        skip: 1,
      }),
    })

    return {
      /**
       * ブロックされたユーザーの配列を抽出
       */
      users: blocks.map((b: typeof blocks[number]) => b.blocked),
      /**
       * 次のカーソル（blockedId）
       */
      nextCursor: blocks.length === limit ? blocks[blocks.length - 1]?.blockedId : undefined,
    }
  } catch (error) {
    logger.error('Get blocked users error:', error)
    return { users: [] }
  }
}

/**
 * ブロック状態を確認
 *
 * ## 機能概要
 * 自分と相手の間のブロック関係を確認します。
 *
 * ## 確認内容
 * - blocked: 自分が相手をブロックしているか
 * - blockedBy: 相手から自分がブロックされているか
 *
 * ## 用途
 * - ユーザープロフィール画面でブロックボタンの状態を決定
 * - ブロックされている場合のアクセス制限
 *
 * @param targetUserId - 確認対象のユーザーID
 * @returns { blocked: boolean, blockedBy: boolean }
 *
 * @example
 * ```typescript
 * const { blocked, blockedBy } = await isBlocked('user-123')
 *
 * if (blockedBy) {
 *   // このユーザーのプロフィールにアクセスできない
 *   return <BlockedMessage />
 * }
 *
 * if (blocked) {
 *   // 「ブロック解除」ボタンを表示
 * } else {
 *   // 「ブロック」ボタンを表示
 * }
 * ```
 */
export async function isBlocked(targetUserId: string) {
  const auth = await requireAuth()
  if ('error' in auth) return { blocked: false, blockedBy: false }
  const userId = auth.userId

  try {
    const [block, blockedBy] = await Promise.all([
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: userId,
            blockedId: targetUserId,
          },
        },
      }),
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: targetUserId,
            blockedId: userId,
          },
        },
      }),
    ])

    return {
      blocked: !!block,      // 自分が相手をブロック
      blockedBy: !!blockedBy, // 相手から自分がブロックされている
    }
  } catch (error) {
    logger.error('Check block status error:', error)
    return { blocked: false, blockedBy: false }
  }
}
