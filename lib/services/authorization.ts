/**
 * 認可ヘルパーサービス
 *
 * 操作権限チェックのロジックを提供する。
 * 複数のアクションで使い回せる汎用的な権限チェック関数を集約する。
 *
 * @module lib/services/authorization
 */

import 'server-only'

import { prisma } from '@/lib/db'

/**
 * 指定したユーザーが盆栽園を編集できるか確認する。
 *
 * - 管理者は常に許可される
 * - 盆栽園の作成者は許可される
 * - それ以外は拒否される
 *
 * @param userId - 操作するユーザーID
 * @param shopId - 編集対象の盆栽園ID
 * @returns { allowed, reason?, isAdmin? }
 *
 * @example
 * ```typescript
 * const authz = await canUserEditShop(userId, shopId)
 * if (!authz.allowed) {
 *   return actionError(ERR_EDIT_PERMISSION_DENIED)
 * }
 * ```
 */
export async function canUserEditShop(
  userId: string,
  shopId: string,
): Promise<{ allowed: boolean; reason?: string; isAdmin?: boolean }> {
  const [shop, adminUser] = await Promise.all([
    prisma.bonsaiShop.findUnique({
      where: { id: shopId },
      select: { createdBy: true },
    }),
    prisma.adminUser.findUnique({
      where: { userId },
      select: { userId: true },
    }),
  ])

  if (!shop) {
    return { allowed: false, reason: 'Shop not found' }
  }

  if (adminUser) {
    return { allowed: true, isAdmin: true }
  }

  if (shop.createdBy !== userId) {
    return { allowed: false, reason: 'Not the shop owner' }
  }

  return { allowed: true }
}
