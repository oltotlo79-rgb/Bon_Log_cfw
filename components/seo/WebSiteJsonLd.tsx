import { safeJsonLdStringify } from './utils'

interface WebSiteJsonLdProps {
  name: string
  url: string
  description?: string
  searchUrl?: string
}

export function WebSiteJsonLd({ name, url, description, searchUrl }: WebSiteJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    ...(description && { description }),
    ...(searchUrl && {
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          // {search_term_string} は Google が検索クエリで置換するプレースホルダー
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
