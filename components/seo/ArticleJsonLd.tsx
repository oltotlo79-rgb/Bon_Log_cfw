import { getAppUrl } from '@/lib/env'
import { safeJsonLdStringify } from './utils'

interface ArticleJsonLdProps {
  headline: string
  datePublished: string
  dateModified?: string
  author: {
    name: string
    url?: string
  }
  url: string
  image?: string
  description?: string
}

export function ArticleJsonLd({
  headline,
  datePublished,
  dateModified,
  author,
  url,
  image,
  description,
}: ArticleJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    datePublished,
    ...(dateModified && { dateModified }),
    author: {
      '@type': 'Person',
      name: author.name,
      ...(author.url && { url: author.url }),
    },
    url,
    ...(image && { image }),
    ...(description && { description }),
    publisher: {
      '@type': 'Organization',
      name: 'BON-LOG',
      url: getAppUrl(),
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  )
}
