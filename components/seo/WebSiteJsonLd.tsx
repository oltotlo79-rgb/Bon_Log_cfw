import { safeJsonLdStringify } from './utils'

/**
 * WebSiteJsonLdコンポーネントのプロパティ定義
 */
interface WebSiteJsonLdProps {
  /** サイト名 */
  name: string
  /** サイトURL */
  url: string
  /** サイトの説明（オプション） */
  description?: string
  /** サイト内検索のURL（オプション） */
  searchUrl?: string
}

/**
 * WebSite構造化データコンポーネント
 *
 * ウェブサイト全体の情報を構造化データとして出力。
 * サイト内検索ボックスの表示に対応。
 *
 * @param props - ウェブサイト情報のプロパティ
 * @returns JSON-LDスクリプト要素
 *
 * @example
 * ```tsx
 * <WebSiteJsonLd
 *   name="BON-LOG"
 *   url="https://bon-log.com"
 *   description="盆栽愛好家のためのSNS"
 *   searchUrl="https://bon-log.com/search"
 * />
 * ```
 */
export function WebSiteJsonLd({ name, url, description, searchUrl }: WebSiteJsonLdProps) {
  // JSON-LDオブジェクトを構築
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',              // エンティティタイプ: ウェブサイト
    name,
    url,
    ...(description && { description }),
    // サイト内検索（指定時のみ）- Sitelinkサーチボックス機能
    ...(searchUrl && {
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          // {search_term_string}はGoogleが検索クエリで置換するプレースホルダー
          urlTemplate: `${searchUrl}?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    }),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  )
}
