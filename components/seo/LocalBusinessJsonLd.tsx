import { safeJsonLdStringify } from './utils'

/**
 * LocalBusinessJsonLdコンポーネントのプロパティ定義
 */
interface LocalBusinessJsonLdProps {
  /** 店舗・施設名 */
  name: string
  /** 住所 */
  address: string
  /** 店舗ページのURL */
  url: string
  /** 電話番号（オプション） */
  telephone?: string
  /** 営業時間（オプション） */
  openingHours?: string
  /** 総合評価（オプション） */
  aggregateRating?: {
    /** 平均評価値（1-5） */
    ratingValue: number
    /** レビュー件数 */
    reviewCount: number
  }
  /** 位置情報（オプション） */
  geo?: {
    /** 緯度 */
    latitude: number
    /** 経度 */
    longitude: number
  }
}

/**
 * LocalBusiness構造化データコンポーネント
 *
 * ローカルビジネス（盆栽園など）の情報を構造化データとして出力。
 * Googleマップやローカル検索結果での表示に影響する。
 *
 * @param props - ローカルビジネス情報のプロパティ
 * @returns JSON-LDスクリプト要素
 *
 * @example
 * ```tsx
 * <LocalBusinessJsonLd
 *   name="〇〇盆栽園"
 *   address="東京都〇〇区..."
 *   url="https://bon-log.com/shops/xxx"
 *   telephone="03-xxxx-xxxx"
 *   aggregateRating={{ ratingValue: 4.5, reviewCount: 10 }}
 *   geo={{ latitude: 35.6762, longitude: 139.6503 }}
 * />
 * ```
 */
export function LocalBusinessJsonLd({
  name,
  address,
  url,
  telephone,
  openingHours,
  aggregateRating,
  geo,
}: LocalBusinessJsonLdProps) {
  // JSON-LDオブジェクトを構築
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',        // エンティティタイプ: ローカルビジネス
    '@id': url,                       // 一意識別子としてURLを使用
    name,
    // 住所を構造化（PostalAddress型）
    address: {
      '@type': 'PostalAddress',
      streetAddress: address,
      addressCountry: 'JP',          // 日本固定
    },
    url,
    ...(telephone && { telephone }), // 電話番号（指定時のみ）
    ...(openingHours && { openingHours }), // 営業時間（指定時のみ）
    // 総合評価（指定時のみ）
    ...(aggregateRating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: aggregateRating.ratingValue,
        reviewCount: aggregateRating.reviewCount,
        bestRating: 5,               // 最高評価: 5
        worstRating: 1,              // 最低評価: 1
      },
    }),
    // 位置情報（指定時のみ）
    ...(geo && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: geo.latitude,
        longitude: geo.longitude,
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
