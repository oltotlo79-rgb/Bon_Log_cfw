import { safeJsonLdStringify } from './utils'

/**
 * OrganizationJsonLdコンポーネントのプロパティ定義
 */
interface OrganizationJsonLdProps {
  /** 組織名 */
  name: string
  /** 組織のウェブサイトURL */
  url: string
  /** ロゴ画像のURL（オプション） */
  logo?: string
  /** 組織の説明（オプション） */
  description?: string
}

/**
 * Organization構造化データコンポーネント
 *
 * 組織（会社、団体）の情報を構造化データとして出力。
 * 検索結果でのナレッジパネル表示に使用される可能性がある。
 *
 * @param props - 組織情報のプロパティ
 * @returns JSON-LDスクリプト要素
 *
 * @example
 * ```tsx
 * <OrganizationJsonLd
 *   name="BON-LOG"
 *   url="https://bon-log.com"
 *   logo="https://bon-log.com/logo.png"
 *   description="盆栽愛好家のためのSNS"
 * />
 * ```
 */
export function OrganizationJsonLd({ name, url, logo, description }: OrganizationJsonLdProps) {
  // JSON-LDオブジェクトを構築
  const jsonLd = {
    '@context': 'https://schema.org', // Schema.orgの語彙を使用
    '@type': 'Organization',          // エンティティタイプ: 組織
    name,                              // 組織名
    url,                               // ウェブサイトURL
    ...(logo && { logo }),             // ロゴ（指定時のみ）
    ...(description && { description }), // 説明（指定時のみ）
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  )
}
