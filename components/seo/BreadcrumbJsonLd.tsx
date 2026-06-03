import { safeJsonLdStringify } from './utils'

interface BreadcrumbJsonLdProps {
  items: Array<{
    name: string
    /** 現在ページの末尾要素は undefined を渡し、JSON-LD の `item` プロパティを省略する */
    url?: string
  }>
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    // BreadcrumbList の末尾（現在ページ）は item を省略する Schema.org 仕様に準拠し Google の警告を回避
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  )
}
