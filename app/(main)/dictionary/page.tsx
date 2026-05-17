import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { getTerms } from '@/lib/actions/dictionary'
import {
  KANA_ROWS,
  isDictionaryCategory,
  isKanaRowLabel,
} from '@/lib/constants/dictionary'
import { DictionarySearch } from '@/components/dictionary/DictionarySearch'
import { PostDetailAdUnit } from '@/components/ads'
import type { BonsaiTermSummary } from '@/lib/actions/dictionary'
import { ROUTE_DICTIONARY } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '盆栽用語辞典 - BON-LOG',
  description: '盆栽の樹形・技術・管理・道具・用土など、盆栽に関する用語をまとめた辞典です。',
  alternates: { canonical: pageCanonical(ROUTE_DICTIONARY) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

const CATEGORY_COLORS: Record<string, string> = {
  '樹形': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  '技術・作業': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  '管理・育成': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  '道具・用品': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  '盆器・鉢': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  '用土・肥料': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  '展示・鑑賞': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

type Props = {
  searchParams: Promise<{
    search?: string
    category?: string
    row?: string
  }>
}

function TermCard({ term }: { term: BonsaiTermSummary }) {
  const colorClass =
    CATEGORY_COLORS[term.category] ??
    'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'

  return (
    <Link
      href={`/dictionary/${term.slug}`}
      className="block rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground leading-none mb-1">{term.reading}</p>
          <h2 className="text-base font-semibold leading-snug">{term.term}</h2>
        </div>
        <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
          {term.category}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
        {term.description}
      </p>
    </Link>
  )
}

function EmptyState({ search, category, row }: { search?: string; category?: string; row?: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <p className="text-sm">
        {search || category || row
          ? `「${[row, category, search].filter(Boolean).join(' / ')}」に一致する用語が見つかりませんでした。`
          : '用語が登録されていません。'}
      </p>
    </div>
  )
}

async function TermList({
  search,
  category,
  row,
}: {
  search?: string
  category?: string
  row?: string
}) {
  const { terms } = await getTerms({ search, category })

  // 行フィルターを適用
  const filteredTerms = row
    ? terms.filter((term) => {
        const kanaRow = KANA_ROWS.find((r) => r.pattern.test(term.reading))
        return kanaRow?.label === row
      })
    : terms

  if (filteredTerms.length === 0) {
    return <EmptyState search={search} category={category} row={row} />
  }

  // あいうえお行でグルーピング
  const groups = groupByRow(filteredTerms)

  return (
    <div className="space-y-8">
      <p className="text-xs text-muted-foreground">{filteredTerms.length}件</p>
      {Object.entries(groups).map(([row, items]) => (
        <section key={row}>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 pb-1 border-b border-border">
            {row}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((term) => (
              <TermCard key={term.id} term={term} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default async function DictionaryPage({ searchParams }: Props) {
  const params = await searchParams
  const search = params.search?.trim()
  const category = isDictionaryCategory(params.category) ? params.category : undefined
  const row = isKanaRowLabel(params.row) ? params.row : undefined

  return (
    <div className="space-y-6">
      <div className="relative w-full h-24 md:h-32 rounded-lg overflow-hidden mb-4">
        <Image src="/images/generated/ui/dictionary-header-mobile.webp" alt="" fill className="object-cover opacity-80 md:hidden dark:hidden" />
        <Image src="/images/generated/ui/dictionary-header.webp" alt="" fill className="object-cover opacity-80 hidden md:block dark:hidden" />
        <Image src="/images/generated/ui/dictionary-header-dark.webp" alt="" fill className="object-cover opacity-80 hidden dark:block" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">盆栽用語辞典</h1>
        <p className="text-sm text-muted-foreground mt-1">
          樹形・技術・管理・道具・用土など盆栽に関する用語を収録しています
        </p>
      </div>

      <DictionarySearch defaultSearch={search} defaultCategory={category} defaultRow={row} />

      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        }
      >
        <TermList search={search} category={category} row={row} />
      </Suspense>

      <aside aria-label="広告">
        <PostDetailAdUnit />
      </aside>
    </div>
  )
}

function groupByRow(terms: BonsaiTermSummary[]): Record<string, BonsaiTermSummary[]> {
  const result: Record<string, BonsaiTermSummary[]> = {}

  for (const term of terms) {
    const row = KANA_ROWS.find((r) => r.pattern.test(term.reading))
    const label = row?.label ?? 'その他'
    if (!result[label]) result[label] = []
    result[label].push(term)
  }

  // あいうえお順に並べ替え
  const orderedKeys = [...KANA_ROWS.map((r) => r.label), 'その他'].filter((k) => k in result)
  const ordered: Record<string, BonsaiTermSummary[]> = {}
  for (const k of orderedKeys) {
    const v = result[k]
    if (v) ordered[k] = v
  }
  return ordered
}
