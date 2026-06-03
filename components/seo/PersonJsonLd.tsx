import { safeJsonLdStringify } from './utils'

interface PersonJsonLdProps {
  name: string
  url: string
  image?: string
  description?: string
  worksFor?: string
  location?: string
}

export function PersonJsonLd({
  name,
  url,
  image,
  description,
  worksFor,
  location,
}: PersonJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': url,
    name,
    url,
    ...(image && { image }),
    ...(description && { description }),
    ...(worksFor && {
      worksFor: {
        '@type': 'Organization',
        name: worksFor,
      },
    }),
    ...(location && {
      homeLocation: {
        '@type': 'Place',
        name: location,
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
