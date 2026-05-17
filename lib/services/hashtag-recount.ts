/**
 * 全ハッシュタグのカウントを実際の `post_hashtags` 行数に基づいて再計算する。
 *
 * 認可は呼び出し側 (Server Action / admin Action) が済ませる前提のため
 * このモジュールは認証チェックを持たない。`server-only` で公開面を絞る。
 *
 * @module lib/services/hashtag-recount
 */

import 'server-only'

import { prisma } from '@/lib/db'

export async function recalculateHashtagCountsCore(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE hashtags h SET count = (
      SELECT COUNT(*) FROM post_hashtags ph WHERE ph.hashtag_id = h.id
    )
  `
}
