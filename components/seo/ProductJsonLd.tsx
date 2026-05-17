import { safeJsonLdStringify } from './utils'

interface ProductJsonLdProps {
  /** 製品名 */
  name: string
  /** 製品の説明（メタ用に切り詰めず、可能であれば原文） */
  description?: string
  /** 製品ページの絶対 URL */
  url: string
  /** 製品画像の絶対 URL（指定時のみ） */
  image?: string
  /** カテゴリ（例: 殺虫剤 / 殺菌剤 / 展着剤） */
  category?: string
  /** 製品 ID（例: 農薬登録番号） */
  productID?: string
  /** ブランド / 製造者名（任意） */
  brand?: string
  /** 追加の機械的プロパティ (PropertyValue として書き出す)。FRAC/IRAC、剤型、有効成分など */
  additionalProperties?: Array<{ name: string; value: string }>
}

/**
 * 製品 (農薬・肥料・関連用品など) の構造化データを出力する。
 *
 * Why Product: 盆栽 SNS が扱う「農薬登録番号付きの市販品」は
 * Google が `Product` リッチリザルトとして拾える唯一の最適なエンティティ型。
 * `Drug` は医薬品向けで意味的に過剰、`ChemicalSubstance` は成分 (有効成分) に
 * 留めるのが妥当なため、製品ページには Product を使う。
 *
 * 価格 / 在庫情報は扱わないため `offers` は出力しない (Google の Product Snippet
 * は offers なしでも name / image / description / brand / sku で拾われる)。
 */
export function ProductJsonLd({
  name,
  description,
  url,
  image,
  category,
  productID,
  brand,
  additionalProperties,
}: ProductJsonLdProps) {
  const additionalProperty = additionalProperties?.filter((p) => p.value).map((p) => ({
    '@type': 'PropertyValue',
    name: p.name,
    value: p.value,
  }))

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    url,
    ...(description && { description }),
    ...(image && { image }),
    ...(category && { category }),
    ...(productID && { productID }),
    ...(brand && {
      brand: {
        '@type': 'Brand',
        name: brand,
      },
    }),
    ...(additionalProperty && additionalProperty.length > 0 && { additionalProperty }),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  )
}
