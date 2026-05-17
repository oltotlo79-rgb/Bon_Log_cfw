/**
 * 管理画面のカーソルベースページネーション用URLパラメータヘルパー
 *
 * 管理画面では「前へ/次へ」ナビゲーションを維持するため、cursor と trail の
 * 2 パラメータで状態を表現する:
 * - `cursor`: 現在ページの起点となる ID（先頭ページでは undefined）
 * - `trail`: 過去に経由した cursor のカンマ区切りリスト（「戻る」操作用）
 *
 * 例: 1ページ目 → 2ページ目 → 3ページ目と進んだ場合
 *   1ページ目: `?`
 *   2ページ目: `?cursor=X` (trail は空)
 *   3ページ目: `?cursor=Y&trail=X`
 *
 * @module lib/utils/admin-cursor
 */

export type AdminCursorParams = {
  cursor?: string
  trail?: string
}

export type ParsedAdminCursor = {
  cursor: string | undefined
  trail: string[]
}

/**
 * URL の cursor / trail パラメータを解釈する。
 */
export function parseAdminCursor(params: AdminCursorParams): ParsedAdminCursor {
  const cursor = params.cursor && params.cursor.length > 0 ? params.cursor : undefined
  const trail = params.trail ? params.trail.split(',').filter(Boolean) : []
  return { cursor, trail }
}

/**
 * 追加のフィルタパラメータも含めて URL クエリ文字列を組み立てる。
 * 値が空文字の項目は出力しない。
 */
export function buildAdminQueryString(params: Record<string, string | undefined | null>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  }
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}
