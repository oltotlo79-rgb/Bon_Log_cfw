import { safeJsonLdStringify } from './utils'

/**
 * BreadcrumbJsonLdコンポーネントのプロパティ定義
 */
interface BreadcrumbJsonLdProps {
  /** パンくずアイテムの配列（階層順） */
  items: Array<{
    /** 項目名 */
    name: string
    /** 項目のURL */
    url: string
  }>
}

/**
 * Breadcrumb構造化データコンポーネント
 *
 * パンくずリストを構造化データとして出力。
 * 検索結果でのパンくず表示に使用される。
 *
 * @param props - パンくずリスト情報のプロパティ
 * @returns JSON-LDスクリプト要素
 *
 * @example
 * ```tsx
 * <BreadcrumbJsonLd
 *   items={[
 *     { name: "ホーム", url: "https://bon-log.com" },
 *     { name: "盆栽園", url: "https://bon-log.com/shops" },
 *     { name: "〇〇盆栽園", url: "https://bon-log.com/shops/xxx" },
 *   ]}
 * />
 * ```
 */
export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  // JSON-LDオブジェクトを構築
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',       // エンティティタイプ: パンくずリスト
    // 各項目をListItem形式に変換（positionは1始まり）
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,           // 位置（1から開始）
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  )
}
