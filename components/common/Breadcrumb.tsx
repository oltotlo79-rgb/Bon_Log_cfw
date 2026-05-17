/**
 * @file パンくずリストUIコンポーネント
 * @description ナビゲーションのパンくずリストを表示するコンポーネント
 *
 * アクセシビリティ対応:
 * - nav要素にaria-label="パンくずリスト"を設定
 * - 現在のページにaria-current="page"を設定
 * - セマンティックなol/li構造を使用
 *
 * @usage
 * ```tsx
 * <Breadcrumb
 *   items={[
 *     { name: 'ホーム', href: '/' },
 *     { name: '盆栽園マップ', href: '/shops' },
 *     { name: '〇〇盆栽園' },  // 最後の項目はhrefなし（現在のページ）
 *   ]}
 * />
 * ```
 */

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { getAppUrl } from '@/lib/env'
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd'

/**
 * パンくずアイテムの型定義
 */
export interface BreadcrumbItem {
  /** 表示名 */
  name: string
  /** リンク先URL（最後の項目は省略可能） */
  href?: string
}

/**
 * Breadcrumbコンポーネントのプロパティ
 */
interface BreadcrumbProps {
  /** パンくずアイテムの配列（階層順） */
  items: BreadcrumbItem[]
  /** JSON-LDも出力するかどうか（デフォルト: true） */
  includeJsonLd?: boolean
}

/**
 * パンくずリストUIコンポーネント
 *
 * ナビゲーション階層を視覚的に表示し、ユーザーが現在の位置を
 * 把握できるようにします。SEO用のJSON-LD構造化データも同時に出力します。
 *
 * @param props - コンポーネントのプロパティ
 * @returns パンくずリストのJSX要素
 */
export function Breadcrumb({ items, includeJsonLd = true }: BreadcrumbProps) {
  // 項目がない場合は何も表示しない
  if (items.length === 0) return null

  // JSON-LD用のベースURL
  const baseUrl = getAppUrl()

  // JSON-LD用のアイテム配列を生成（URLが必要）
  const jsonLdItems = items.map((item) => ({
    name: item.name,
    url: item.href
      ? item.href.startsWith('http')
        ? item.href
        : `${baseUrl}${item.href}`
      : `${baseUrl}${typeof window !== 'undefined' ? window.location.pathname : ''}`,
  }))

  return (
    <>
      {/* JSON-LD構造化データ（SEO用） */}
      {includeJsonLd && <BreadcrumbJsonLd items={jsonLdItems} />}

      {/* パンくずリストUI */}
      <nav aria-label="パンくずリスト" className="mb-4">
        <ol className="flex items-center flex-wrap gap-1 text-sm text-muted-foreground">
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            const isFirst = index === 0

            return (
              <li key={index} className="flex items-center gap-1">
                {/* 区切り文字（最初の項目以外） */}
                {!isFirst && (
                  <ChevronRight className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                )}

                {/* パンくずアイテム */}
                {isLast || !item.href ? (
                  // 最後の項目またはリンクなしの場合はspan
                  <span
                    className="text-foreground font-medium truncate max-w-[200px]"
                    aria-current="page"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                ) : (
                  // リンクありの場合はLink
                  <Link
                    href={item.href}
                    className="hover:text-foreground hover:underline transition-colors flex items-center gap-1 truncate max-w-[200px]"
                    title={item.name}
                  >
                    {/* 最初の項目にホームアイコンを表示 */}
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
