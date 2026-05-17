/**
 * SEO ユーティリティ
 *
 * @module lib/utils/seo
 */

import { BASE_URL } from '@/lib/constants/routes'

/**
 * ページパスから絶対 URL の canonical を組み立てる。
 *
 * @param path - サイトルート相対パス（例: `'/about'`, `'/dictionary/sample'`）。
 *   `/` のみのときはサイトルート（`BASE_URL`）をそのまま返す。
 * @returns canonical 用の絶対 URL（末尾スラッシュ無し）
 *
 * @example
 *   pageCanonical('/')          // → 'https://bon-log.example'
 *   pageCanonical('/about')     // → 'https://bon-log.example/about'
 */
export function pageCanonical(path: string): string {
  if (!path || path === '/') return BASE_URL
  // 先頭スラッシュの有無で BASE_URL 連結時のスラッシュ重複を防ぐ
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${BASE_URL}${normalized}`
}
