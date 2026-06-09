import { safeJsonLdStringify } from './utils'

interface DefinedTermJsonLdProps {
  name: string
  description: string
  category?: string
  url?: string
  alternateName?: string
}

/**
 * 盆栽用語辞典のJSON-LD構造化データ
 * Google検索の「定義」リッチリザルトに対応
 */
export function DefinedTermJsonLd({ name, description, category, url, alternateName }: DefinedTermJsonLdProps) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name,
    description,
    ...(alternateName && { alternateName }),
    ...(url && { url }),
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: '盆栽用語辞典',
      ...(category && { description: `${category}に関する盆栽用語` }),
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  )
}
