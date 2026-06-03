import { safeJsonLdStringify, isSchemaOrgOpeningHours } from './utils'

interface LocalBusinessJsonLdProps {
  name: string
  address: string
  url: string
  telephone?: string
  openingHours?: string
  aggregateRating?: {
    ratingValue: number
    reviewCount: number
  }
  geo?: {
    latitude: number
    longitude: number
  }
}

export function LocalBusinessJsonLd({
  name,
  address,
  url,
  telephone,
  openingHours,
  aggregateRating,
  geo,
}: LocalBusinessJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': url,
    name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address,
      addressCountry: 'JP',
    },
    url,
    ...(telephone && { telephone }),
    // schema.org のトークン形式（例: "Mo-Fr 09:00-17:00"）に厳密一致する時のみ出力。
    // 自由記述（"平日9:00〜18:00" 等）は無効な構造化データになるため省略する。
    ...(openingHours && isSchemaOrgOpeningHours(openingHours) && { openingHours }),
    ...(aggregateRating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: aggregateRating.ratingValue,
        reviewCount: aggregateRating.reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
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
