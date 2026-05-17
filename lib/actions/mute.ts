/**
 * ミュート機能のServer Actions
 *
 * @module lib/actions/mute
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
 * ミュート後にページを更新するために使用
 */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { ERR_SELF_MUTE, ERR_MUTE_FAILED, ERR_UNMUTE_FAILED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_FEED, ROUTE_SETTINGS_MUTED } from '@/lib/constants/routes'
import { buildUserPath } from '@/lib/constants/path-builders'

/**
 * ユーザーIDバリデーションスキーマ
 * cuid ベースで最大 30 文字。block.ts と同じ定義にして境界検証を統一。
 */
const userIdSchema = z.string().min(1, ERR_INVALID_INPUT).max(30)

/**
 * ロガー
 * エラーログの記録に使用
 */
import logger from '@/lib/logger'

/**
 * ユーザーをミュート
 *
 * ## 機能概要
 * 指定されたユーザーをミュートします。
 *
 * ## 処理フロー
 * 1. 認証チェック
 * 2. 自分自身へのミュート防止
 * 3. ミュートレコードを作成
 * 4. キャッシュを再検証
 *
 * ## ブロックとの違い
 * - フォロー関係は解除されない
 * - 相手からは自分が見える（相手への影響なし）
 *
 * @param targetUserId - ミュート対象のユーザーID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await muteUser('user-123')
 * if (result.success) {
 *   toast.success('ユーザーをミュートしました')
 * }
 * ```
 */
export async function muteUser(targetUserId: string): Promise<ActionResult> {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const idParsed = userIdSchema.safeParse(targetUserId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)

  if (userId === targetUserId) {
    return actionError(ERR_SELF_MUTE)
  }

  const rl = await enforceUserRateLimit(userId, 'mute_user')
  if (rl) return actionError(rl.error)

  try {
    await prisma.mute.create({
      data: {
        muterId: userId,
        mutedId: targetUserId,
      },
    })

    await invalidateUserRelationsCache(userId)
    revalidatePath(ROUTE_FEED)
    revalidatePath(buildUserPath(targetUserId))

    return actionSuccess()
  } catch (error) {
    logger.error('Mute user error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_MUTE_FAILED)
  }
}

/**
 * ミュートを解除
 *
 * ## 機能概要
 * 指定されたユーザーのミュートを解除します。
 *
 * ## 複合ユニークキー
 * muterId_mutedId は Prisma スキーマで定義された
 * 複合ユニークキー
 *
 * @param targetUserId - ミュート解除対象のユーザーID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await unmuteUser('user-123')
 * if (result.success) {
 *   toast.success('ミュートを解除しました')
 * }
 * ```
 */
export async function unmuteUser(targetUserId: string): Promise<ActionResult> {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const idParsed = userIdSchema.safeParse(targetUserId)
  if (!idParsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'unmute_user')
  if (rl) return actionError(rl.error)

  try {
    await prisma.mute.delete({
      where: {
        muterId_mutedId: {
          muterId: userId,
          mutedId: targetUserId,
        },
      },
    })

    await invalidateUserRelationsCache(userId)
    revalidatePath(ROUTE_FEED)
    revalidatePath(buildUserPath(targetUserId))
    revalidatePath(ROUTE_SETTINGS_MUTED)

    return actionSuccess()
  } catch (error) {
    logger.error('Unmute user error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_UNMUTE_FAILED)
  }
}

/**
 * ミュートしたユーザー一覧を取得
 *
 * ## 機能概要
 * 現在のユーザーがミュートしているユーザーの一覧を取得します。
 *
 * ## 用途
 * - 設定画面の「ミュートしたユーザー」ページ
 * - ミュート解除のためのUI
 *
 * ## ページネーション
 * カーソルベースのページネーションを採用
 * カーソルは mutedId を使用
 *
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（デフォルト: 20）
 * @returns ミュートしたユーザー一覧と次のカーソル
 *
 * @example
 * ```typescript
 * const { users, nextCursor } = await getMutedUsers()
 * ```
 */
export async function getMutedUsers(cursor?: string, limit = DEFAULT_PAGE_LIMIT) {
  const auth = await requireAuth()
  if ('error' in auth) return { users: [], nextCursor: undefined }
  const guestCheck = await requireNotGuest()
  if (guestCheck) return { users: [], nextCursor: undefined }
  const userId = auth.userId

  try {
    const mutes = await prisma.mute.findMany({
      where: { muterId: userId },
      include: {
        muted: {
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
      ...(cursor && {
        cursor: { muterId_mutedId: { muterId: userId, mutedId: cursor } },
        skip: 1,
      }),
    })

    return {
      users: mutes.map((m: typeof mutes[number]) => m.muted),
      nextCursor: mutes.length === limit ? mutes[mutes.length - 1]?.mutedId : undefined,
    }
  } catch (error) {
    logger.error('Get muted users error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { users: [], nextCursor: undefined }
  }
}

/**
 * ミュート状態を確認
 *
 * ## 機能概要
 * 自分が相手をミュートしているかを確認します。
 *
 * ## ブロックとの違い
 * - ミュートは片方向のみ確認
 * - 相手から自分がミュートされているかは確認しない
 *   （ミュートは非公開機能のため）
 *
 * ## 用途
 * - ユーザープロフィール画面でミュートボタンの状態を決定
 *
 * @param targetUserId - 確認対象のユーザーID
 * @returns { muted: boolean }
 *
 * @example
 * ```typescript
 * const { muted } = await isMuted('user-123')
 *
 * if (muted) {
 *   // 「ミュート解除」ボタンを表示
 * } else {
 *   // 「ミュート」ボタンを表示
 * }
 * ```
 */
export async function isMuted(targetUserId: string) {
  const auth = await requireAuth()
  if ('error' in auth) return { muted: false }
  const userId = auth.userId

  try {
    const mute = await prisma.mute.findUnique({
      where: {
        muterId_mutedId: {
          muterId: userId,
          mutedId: targetUserId,
        },
      },
    })

    return { muted: !!mute }
  } catch (error) {
    logger.error('Check mute status error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { muted: false }
  }
}
