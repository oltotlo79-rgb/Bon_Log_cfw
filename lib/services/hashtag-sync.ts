/**
 * ハッシュタグ同期ロジック（内部 API）
 *
 * 投稿作成・削除時に、本文から抽出したハッシュタグを `Hashtag` / `PostHashtag`
 * テーブルに反映するためのロジック層。
 *
 * ## レイヤ上の位置づけ
 * - `lib/actions/post.ts` などの Server Action から内部ヘルパーとして呼ばれる。
 * - クライアントから直接呼ばれない（`'use server'` は付けない）。
 * - 認証・認可は呼び出し元で完了している前提。
 *
 * @module lib/services/hashtag-sync
 */

import 'server-only'

import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import { extractHashtags } from '@/lib/utils/hashtag-extract'

// lib/utils/hashtag-extract に移動した純粋関数を re-export して既存の import パスを維持する
export { extractHashtags }

/**
 * 投稿本文から抽出したハッシュタグを `Hashtag` / `PostHashtag` に反映する。
 *
 * ハッシュタグの処理失敗は投稿作成自体をブロックしないよう、例外は握りつぶしてログのみ出力する。
 *
 * @param postId - 投稿ID
 * @param content - 投稿本文
 */
export async function attachHashtagsToPost(postId: string, content: string | null): Promise<void> {
  if (!content) return

  const hashtagNames = extractHashtags(content)
  if (hashtagNames.length === 0) return

  try {
    // 全ハッシュタグを upsert（count を +1）。N+1 回避のため $transaction でまとめる。
    const hashtags = await prisma.$transaction(
      hashtagNames.map((name) =>
        prisma.hashtag.upsert({
          where: { name },
          update: { count: { increment: 1 } },
          create: { name, count: 1 },
        }),
      ),
    )

    // 関連付けを一括 upsert。既に関連付け済みのタグは no-op。
    await prisma.$transaction(
      hashtags.map((hashtag: { id: string }) =>
        prisma.postHashtag.upsert({
          where: { postId_hashtagId: { postId, hashtagId: hashtag.id } },
          update: {},
          create: { postId, hashtagId: hashtag.id },
        }),
      ),
    )
  } catch (error) {
    logger.error('Attach hashtags error:', error)
  }
}

/**
 * 投稿削除時にハッシュタグ関連付けを解除し、カウントを減算する。
 *
 * カウントが 0 以下になったマスタ行は一括削除する。
 */
export async function detachHashtagsFromPost(postId: string): Promise<void> {
  try {
    const postHashtags = await prisma.postHashtag.findMany({
      where: { postId },
      include: { hashtag: true },
    })

    await prisma.postHashtag.deleteMany({ where: { postId } })

    const hashtagIds = postHashtags.map((ph: { hashtagId: string }) => ph.hashtagId)

    if (hashtagIds.length > 0) {
      await prisma.$transaction([
        ...hashtagIds.map((id: string) =>
          prisma.hashtag.update({
            where: { id },
            data: { count: { decrement: 1 } },
          }),
        ),
        prisma.hashtag.deleteMany({
          where: { count: { lte: 0 } },
        }),
      ])
    }
  } catch (error) {
    logger.error('Detach hashtags error:', error)
  }
}
