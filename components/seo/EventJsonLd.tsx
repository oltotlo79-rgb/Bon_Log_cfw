import { safeJsonLdStringify } from './utils'

interface EventJsonLdProps {
  name: string
  startDate: string
  endDate?: string
  location?: {
    name?: string
    address?: string
  }
  description?: string
  url: string
  organizer?: string
  offers?: {
    price?: string
    priceCurrency?: string
  }
}

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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    startDate,
    ...(endDate && { endDate }),
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
    ...(organizer && {
      organizer: {
        '@type': 'Organization',
        name: organizer,
      },
    }),
    ...(offers && {
      offers: {
        '@type': 'Offer',
        price: offers.price || '0',
        priceCurrency: offers.priceCurrency || 'JPY',
        availability: 'https://schema.org/InStock',
      },
    }),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  )
}
