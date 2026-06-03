/**
 * SEO ユーティリティ
 *
 * @module lib/utils/seo
 */

import { BASE_URL, SITE_NAME } from '@/lib/constants/routes'

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

/**
 * ページ固有タイトルにサイト（ブランド）名を付与した `<title>` 用文字列を返す。
 *
 * ルートレイアウトの title.template は意図的に no-op（'%s'）で、子ページ側が
 * ブランド込みの完全タイトルを供給する設計（app/layout.tsx 参照）。その付与を一元化する。
 *
 * @example pageTitle('山田さんの投稿') // → '山田さんの投稿 | BON-LOG'
 */
export function pageTitle(title: string): string {
  return `${title} | ${SITE_NAME}`
}
