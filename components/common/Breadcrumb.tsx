/**
 * @module components/common/Breadcrumb
 */

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { getAppUrl } from '@/lib/env'
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd'

export interface BreadcrumbItem {
  name: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  includeJsonLd?: boolean
}

export function Breadcrumb({ items, includeJsonLd = true }: BreadcrumbProps) {
  if (items.length === 0) return null

  const baseUrl = getAppUrl()

  // Schema.org BreadcrumbList は末尾要素の `item` を省略してよい。SSR 時に
  // `window.location.pathname` を参照すると空文字になり baseUrl が item URL として
  // 誤って出力されるため、href が無い項目は url を undefined として渡し JSON-LD で省く。
  const jsonLdItems = items.map((item) => ({
    name: item.name,
    url: item.href
      ? item.href.startsWith('http')
        ? item.href
        : `${baseUrl}${item.href}`
      : undefined,
  }))

  return (
    <>
      {includeJsonLd && <BreadcrumbJsonLd items={jsonLdItems} />}

      <nav aria-label="パンくずリスト" className="mb-4">
        <ol className="flex items-center flex-wrap gap-1 text-sm text-muted-foreground">
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            const isFirst = index === 0

            return (
              <li key={index} className="flex items-center gap-1">
                {!isFirst && (
                  <ChevronRight className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                )}

                {isLast || !item.href ? (
                  <span
                    className="text-foreground font-medium truncate max-w-[200px]"
                    aria-current="page"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="hover:text-foreground hover:underline transition-colors flex items-center gap-1 truncate max-w-[200px]"
                    title={item.name}
                  >
                    {isFirst && item.name === 'ホーム' && (
                      <Home className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    )}
                    <span className={isFirst && item.name === 'ホーム' ? 'sr-only sm:not-sr-only' : ''}>
                      {item.name}
                    </span>
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}
