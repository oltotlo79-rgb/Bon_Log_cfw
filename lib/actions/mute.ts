/**
 * ミュート機能のServer Actions
 *
 * @module lib/actions/mute
 */

'use server'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { requireActiveNonGuestUser, requireAuth, requireNotGuest, actionSuccess, actionError, type ActionResult, invalidateUserRelationsCache, enforceUserRateLimit } from '@/lib/actions/utils'
import { revalidatePath } from 'next/cache'
import { cuidSchema } from '@/lib/actions/schemas/common'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { clampLimit } from '@/lib/actions/pagination'
import { ERR_SELF_MUTE, ERR_MUTE_FAILED, ERR_UNMUTE_FAILED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_FEED, ROUTE_SETTINGS_MUTED } from '@/lib/constants/routes'
import { buildUserPath } from '@/lib/constants/path-builders'

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
 */
export async function muteUser(targetUserId: string): Promise<ActionResult> {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const idParsed = cuidSchema.safeParse(targetUserId)
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
 */
export async function unmuteUser(targetUserId: string): Promise<ActionResult> {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const idParsed = cuidSchema.safeParse(targetUserId)
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
 */
export async function getMutedUsers(cursor?: string, limit = DEFAULT_PAGE_LIMIT) {
  const auth = await requireAuth()
  if ('error' in auth) return { users: [], nextCursor: undefined }
  const guestCheck = await requireNotGuest()
  if (guestCheck) return { users: [], nextCursor: undefined }
  const userId = auth.userId

  try {
    const safeLimit = clampLimit(limit)
    const mutes = await prisma.mute.findMany({
      where: { muterId: userId },
      include: {
        muted: {
          select: USER_MINIMAL_WITH_BIO_SELECT,
        },
      },
      // 同時刻のページ境界を安定させるため複合キー(mutedId)を第2ソートキーにする
      orderBy: [{ createdAt: 'desc' }, { mutedId: 'desc' }],
      take: safeLimit,
      ...(cursor && {
        cursor: { muterId_mutedId: { muterId: userId, mutedId: cursor } },
        skip: 1,
      }),
    })

    return {
      users: mutes.map((m: typeof mutes[number]) => m.muted),
      nextCursor: mutes.length === safeLimit ? mutes[mutes.length - 1]?.mutedId : undefined,
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
