/**
 * @module lib/services/user-eligibility
 *
 * 関係性アクション（follow / follow request / DM）の対象ユーザー適格性を判定する共通ロジック。
 *
 * Why: actor 側の認証/レート制限だけでなく、target 側も「存在する・停止されていない・
 * ゲストでない・双方向 block がない」ことを満たす必要がある。これを各 Action に散在させると
 * 仕様が割れる（停止ユーザーをフォローできる／DM 作成後に block を見る等）ため 1 箇所に集約する。
 * 公開/非公開ポリシー（direct follow か request か）は呼び出し側が `target.isPublic` で判断する。
 */

import 'server-only'

import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'
import { GUEST_EMAIL } from '@/lib/constants/guest'

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

export type InteractionEligibility =
  | { ok: true; target: { id: string; isPublic: boolean } }
  | { ok: false; reason: 'not_found' | 'blocked' }

/**
 * actor が target に対して関係性アクションを開始してよいかの共通前提を判定する。
 *
 * - target が存在し、停止されておらず、ゲストでない（満たさなければ `not_found` として秘匿）
 * - actor と target が双方向いずれの block 関係にもない（あれば `blocked`）
 *
 * トランザクション内から呼ぶ場合は `db` に tx クライアントを渡す（read の一貫性確保のため）。
 */
export async function checkInteractionEligibility(
  actorId: string,
  targetId: string,
  db: PrismaClientOrTx = prisma,
): Promise<InteractionEligibility> {
  const [target, block] = await Promise.all([
    db.user.findUnique({
      where: { id: targetId },
      select: { id: true, isPublic: true, isSuspended: true, email: true },
    }),
    db.block.findFirst({
      where: {
        OR: [
          { blockerId: actorId, blockedId: targetId },
          { blockerId: targetId, blockedId: actorId },
        ],
      },
      select: { blockerId: true },
    }),
  ])

  // 停止・ゲスト・非存在は存在自体を秘匿する（block より優先して情報を漏らさない）
  if (!target || target.isSuspended || target.email === GUEST_EMAIL) {
    return { ok: false, reason: 'not_found' }
  }
  if (block) return { ok: false, reason: 'blocked' }

  return { ok: true, target: { id: target.id, isPublic: target.isPublic } }
}
