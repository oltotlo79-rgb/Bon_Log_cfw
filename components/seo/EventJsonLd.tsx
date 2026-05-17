import { safeJsonLdStringify } from './utils'

/**
 * EventJsonLdコンポーネントのプロパティ定義
 */
interface EventJsonLdProps {
  /** イベント名 */
  name: string
  /** 開始日時（ISO 8601形式） */
  startDate: string
  /** 終了日時（ISO 8601形式、オプション） */
  endDate?: string
  /** 開催場所（オプション） */
  location?: {
    /** 場所名 */
    name?: string
    /** 住所 */
    address?: string
  }
  /** イベントの説明（オプション） */
  description?: string
  /** イベントページのURL */
  url: string
  /** 主催者名（オプション） */
  organizer?: string
  /** チケット情報（オプション） */
  offers?: {
    /** 価格 */
    price?: string
    /** 通貨（デフォルト: JPY） */
    priceCurrency?: string
  }
}

/**
 * Event構造化データコンポーネント
 *
 * イベント情報を構造化データとして出力。
 * Googleの検索結果やGoogleカレンダーでの表示に使用される。
 *
 * @param props - イベント情報のプロパティ
 * @returns JSON-LDスクリプト要素
 *
 * @example
 * ```tsx
 * <EventJsonLd
 *   name="盆栽展示会2026"
 *   startDate="2026-04-01T10:00:00+09:00"
 *   endDate="2026-04-03T17:00:00+09:00"
 *   location={{ name: "東京ドーム", address: "東京都文京区..." }}
 *   url="https://bon-log.com/events/xxx"
 *   organizer="日本盆栽協会"
 * />
 * ```
 */
export function EventJsonLd({
  name,
  startDate,
  endDate,
  location,
  description,
  url,
  organizer,
  offers,
}: EventJsonLdProps) {
  // JSON-LDオブジェクトを構築
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',                // エンティティタイプ: イベント
    name,
    startDate,
    ...(endDate && { endDate }),     // 終了日時（指定時のみ）
    // 開催場所（指定時のみ）
    ...(location && {
      location: {
        '@type': 'Place',
        name: location.name || location.address,
        ...(location.address && {
          address: {
            '@type': 'PostalAddress',
            streetAddress: location.address,
            addressCountry: 'JP',
          },
        }),
      },
    }),
    ...(description && { description }),
    url,
    // 主催者（指定時のみ）
    ...(organizer && {
      organizer: {
        '@type': 'Organization',
        name: organizer,
      },
    }),
    // チケット情報（指定時のみ）
    ...(offers && {
      offers: {
        '@type': 'Offer',
        price: offers.price || '0',           // 無料の場合は0
        priceCurrency: offers.priceCurrency || 'JPY',
        availability: 'https://schema.org/InStock', // 在庫あり
      },
    }),
    eventStatus: 'https://schema.org/EventScheduled', // イベント状態: 予定通り
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', // 参加形式: オフライン
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  )
}
