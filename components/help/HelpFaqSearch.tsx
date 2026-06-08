'use client'

/**
 * @module components/help/HelpFaqSearch
 * ヘルプ FAQ のクライアント側キーワード絞り込み。
 *
 * Why client-side filter: FAQ 全文は Server Component 側で静的 HTML + FaqPageJsonLd に
 * 全件出力し（クローラ向け）、本コンポーネントは表示の絞り込みだけを担う。
 * クエリパラメータ + SSR 方式だと全件が静的出力から外れ SEO に不利なため採用しない。
 */

import { useMemo, useState } from 'react'
import { ChevronRightIcon, SearchIcon } from './HelpIcons'

export type HelpFaqItem = { question: string; answer: string }
export type HelpSection = { title: string; items: HelpFaqItem[] }

/** クイックリンク（#premium / #notifications）に対応するセクションの id を返す。 */
function sectionAnchorId(title: string): string | undefined {
  if (title === 'プレミアム会員') return 'premium'
  if (title === '通知について') return 'notifications'
  return undefined
}

type Props = { sections: HelpSection[] }

export function HelpFaqSearch({ sections }: Props) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return sections
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.question.toLowerCase().includes(normalizedQuery) ||
            item.answer.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((section) => section.items.length > 0)
  }, [sections, normalizedQuery])

  const matchCount = filteredSections.reduce((sum, section) => sum + section.items.length, 0)

  return (
    <div className="space-y-8">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="キーワードで検索..."
          aria-label="ヘルプ内をキーワードで検索"
          className="w-full pl-10 pr-4 py-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {normalizedQuery && (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          「{query.trim()}」の検索結果: {matchCount}件
        </p>
      )}

      {matchCount === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          該当する質問が見つかりませんでした。別のキーワードでお試しください。
        </p>
      ) : (
        <div className="space-y-8">
          {filteredSections.map((section) => (
            <section key={section.title} id={sectionAnchorId(section.title)} className="scroll-mt-8">
              <h2 className="text-xl font-bold mb-4 pb-2 border-b">{section.title}</h2>
              <div className="space-y-4">
                {section.items.map((item) => (
                  <details key={item.question} className="group bg-card border rounded-lg">
                    <summary className="flex items-center justify-between p-4 cursor-pointer list-none hover:bg-muted/50 rounded-lg">
                      <span className="font-medium pr-4">{item.question}</span>
                      <ChevronRightIcon className="w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="px-4 pb-4 text-muted-foreground whitespace-pre-line">
                      {item.answer}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
