/**
 * @module lib/services/bonsai-ownership
 * 投稿に盆栽 (Bonsai) を紐付ける際の所有権検証。
 * Web (`lib/actions/post-validation.ts`) と v1 (`lib/services/post-write-service.ts`)
 * の両方の投稿作成/編集フローから共有される。
 */

import 'server-only'

import { prisma } from '@/lib/db'

/**
 * bonsaiId が指定ユーザー本人の所有かを検証する。
 * 存在しない・他人所有のいずれも false（IDOR 対策として存在有無を区別せず秘匿する）。
 */
export async function isOwnedBonsai(bonsaiId: string, userId: string): Promise<boolean> {
  const bonsai = await prisma.bonsai.findUnique({
    where: { id: bonsaiId },
    select: { userId: true },
  })
  return bonsai?.userId === userId
}
