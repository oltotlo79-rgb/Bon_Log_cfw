/**
 * @module lib/services/media-cleanup
 *
 * アップロード済みメディアをストレージ(R2/local)から削除する共有ヘルパー。
 *
 * Why: 投稿・コメント・下書き・予約投稿・レビュー・盆栽記録の削除は DB 側を
 * カスケード削除するが、ストレージ実体は残り続けオーファン化する(課金増・PII 残存)。
 * 各削除アクションが本ヘルパーを呼んで実体も回収する。ストレージ削除の失敗で
 * ユーザー操作(本体の削除)を巻き戻すべきではないため best-effort(失敗はログのみ)。
 */

import { deleteFile } from '@/lib/storage'
import logger from '@/lib/logger'

/**
 * 与えられた URL 群をストレージから削除する。null/空は無視し、各削除は独立に行う。
 * 失敗しても throw せず logger.error に記録する(呼び出し元の本処理は継続)。
 */
export async function deleteMediaFiles(
  urls: ReadonlyArray<string | null | undefined>
): Promise<void> {
  const targets = urls.filter((u): u is string => typeof u === 'string' && u.length > 0)
  if (targets.length === 0) return

  await Promise.all(
    targets.map(async (url) => {
      try {
        await deleteFile(url)
      } catch (error) {
        logger.error('Failed to delete media file from storage', {
          url,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })
  )
}
