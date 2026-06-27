/**
 * ハッシュタグ抽出ユーティリティ（純粋関数）。
 *
 * lib/services/hashtag-sync.ts は `server-only` を付けているため CLI スクリプトから
 * import できない。抽出ロジックをここに分離し、サーバー／スクリプト双方から参照できるようにする。
 *
 * @module lib/utils/hashtag-extract
 */

/** ひらがな・カタカナ・CJK 統合漢字を含むハッシュタグ抽出正規表現。 */
const HASHTAG_REGEX = /#([a-zA-Z0-9_぀-ゟ゠-ヿ一-鿿]+)/g

/**
 * テキストからハッシュタグを抽出する。
 *
 * `#` 除去 + 小文字化 + 重複除去を行う。
 *
 * @example
 * extractHashtags('今日の #盆栽 #Bonsai') // → ['盆栽', 'bonsai']
 */
export function extractHashtags(text: string): string[] {
  if (!text) return []
  const matches = text.match(HASHTAG_REGEX)
  if (!matches) return []
  const hashtags = matches.map((tag: string) => tag.slice(1).toLowerCase())
  return [...new Set(hashtags)]
}
