/**
 * @module lib/services/block-service
 * v1 用。Web の lib/actions/block と同等のドメインロジックを Bearer 認証経路向けに提供する。
 *
 * 呼び出し元（route handler）が認証・Zod・レート制限を済ませた前提で動作する。
 * Web の lib/actions/block.ts は変更しない。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { invalidateUserRelationsCache } from '@/lib/actions/utils'
import logger from '@/lib/logger'

export type BlockServiceResult = { ok: true } | { ok: false; reason: 'self' | 'not_found' | 'error' }

/**
 * ブロック処理（冪等）。
 * 相互フォローを $transaction 内で解除してからブロックレコードを作成する。
 * 既ブロック時はトランザクションを再実行せず ok:true で返す。
 */
export async function blockUserService(
  userId: string,
  targetUserId: string,
): Promise<BlockServiceResult> {
  if (userId === targetUserId) return { ok: false, reason: 'self' }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId, isSuspended: false },
    select: { id: true },
  })
  if (!target) return { ok: false, reason: 'not_found' }

  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
    select: { blockerId: true },
  })
  if (existing) return { ok: true }

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
        data: { blockerId: userId, blockedId: targetUserId },
      }),
    ])

    await invalidateUserRelationsCache(userId)
    return { ok: true }
  } catch (error) {
    logger.error('blockUserService error:', error)
    return { ok: false, reason: 'error' }
  }
}

/**
 * ブロック解除処理（冪等）。
 * 既にブロックが存在しない場合も ok:true で返す。
 * ブロック解除後にフォロー関係は復活しない。
 */
export async function unblockUserService(
  userId: string,
  targetUserId: string,
): Promise<BlockServiceResult> {
  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
    select: { blockerId: true },
  })
  if (!existing) return { ok: true }

  try {
    await prisma.block.delete({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
    })

    await invalidateUserRelationsCache(userId)
    return { ok: true }
  } catch (error) {
    logger.error('unblockUserService error:', error)
    return { ok: false, reason: 'error' }
  }
}

export type BlockedUser = {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
}

export type BlockListResult = {
  items: BlockedUser[]
  nextCursor: string | null
}

/**
 * ブロック一覧取得（カーソルベースページネーション）。
 * カーソルは blockedId ベース。Web の getBlockedUsers と同一クエリ・ソート順。
 */
export async function getBlockedUsersService(
  userId: string,
  limit: number,
  cursor?: string,
): Promise<BlockListResult> {
  const blocks = await prisma.block.findMany({
    where: { blockerId: userId },
    include: {
      blocked: { select: USER_MINIMAL_WITH_BIO_SELECT },
    },
    orderBy: [{ createdAt: 'desc' }, { blockedId: 'desc' }],
    take: limit,
    ...(cursor && {
      cursor: { blockerId_blockedId: { blockerId: userId, blockedId: cursor } },
      skip: 1,
    }),
  })

  return {
    items: blocks.map((b) => b.blocked),
    nextCursor: blocks.length === limit ? (blocks[blocks.length - 1]?.blockedId ?? null) : null,
  }
}
