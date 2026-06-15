/**
 * @module lib/services/mute-service
 * v1 用。Web の lib/actions/mute と同等のドメインロジックを Bearer 認証経路向けに提供する。
 *
 * 呼び出し元（route handler）が認証・Zod・レート制限を済ませた前提で動作する。
 * Web の lib/actions/mute.ts は変更しない。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { invalidateUserRelationsCache } from '@/lib/actions/utils'
import logger from '@/lib/logger'

export type MuteServiceResult = { ok: true } | { ok: false; reason: 'self' | 'not_found' | 'error' }

/**
 * ミュート処理（冪等）。
 * フォロー関係は解除しない（Web と同じ挙動）。
 * 既ミュート時は ok:true で返す。
 */
export async function muteUserService(
  userId: string,
  targetUserId: string,
): Promise<MuteServiceResult> {
  if (userId === targetUserId) return { ok: false, reason: 'self' }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId, isSuspended: false },
    select: { id: true },
  })
  if (!target) return { ok: false, reason: 'not_found' }

  const existing = await prisma.mute.findUnique({
    where: { muterId_mutedId: { muterId: userId, mutedId: targetUserId } },
    select: { muterId: true },
  })
  if (existing) return { ok: true }

  try {
    await prisma.mute.create({
      data: { muterId: userId, mutedId: targetUserId },
    })

    await invalidateUserRelationsCache(userId)
    return { ok: true }
  } catch (error) {
    logger.error('muteUserService error:', error)
    return { ok: false, reason: 'error' }
  }
}

/**
 * ミュート解除処理（冪等）。
 * 既にミュートが存在しない場合も ok:true で返す。
 */
export async function unmuteUserService(
  userId: string,
  targetUserId: string,
): Promise<MuteServiceResult> {
  const existing = await prisma.mute.findUnique({
    where: { muterId_mutedId: { muterId: userId, mutedId: targetUserId } },
    select: { muterId: true },
  })
  if (!existing) return { ok: true }

  try {
    await prisma.mute.delete({
      where: { muterId_mutedId: { muterId: userId, mutedId: targetUserId } },
    })

    await invalidateUserRelationsCache(userId)
    return { ok: true }
  } catch (error) {
    logger.error('unmuteUserService error:', error)
    return { ok: false, reason: 'error' }
  }
}

export type MutedUser = {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
}

export type MuteListResult = {
  items: MutedUser[]
  nextCursor: string | null
}

/**
 * ミュート一覧取得（カーソルベースページネーション）。
 * カーソルは mutedId ベース。Web の getMutedUsers と同一クエリ・ソート順。
 */
export async function getMutedUsersService(
  userId: string,
  limit: number,
  cursor?: string,
): Promise<MuteListResult> {
  const mutes = await prisma.mute.findMany({
    where: { muterId: userId },
    include: {
      muted: { select: USER_MINIMAL_WITH_BIO_SELECT },
    },
    orderBy: [{ createdAt: 'desc' }, { mutedId: 'desc' }],
    take: limit,
    ...(cursor && {
      cursor: { muterId_mutedId: { muterId: userId, mutedId: cursor } },
      skip: 1,
    }),
  })

  return {
    items: mutes.map((m) => m.muted),
    nextCursor: mutes.length === limit ? (mutes[mutes.length - 1]?.mutedId ?? null) : null,
  }
}
