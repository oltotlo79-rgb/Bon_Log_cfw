import Link from 'next/link'
import { getTerms } from '@/lib/actions/dictionary'
import type { BonsaiTermSummary } from '@/lib/actions/dictionary'
import { KANA_ROWS } from '@/lib/constants/dictionary'
import { buildDictionaryPath } from '@/lib/constants/path-builders'

const CATEGORY_COLORS: Record<string, string> = {
  '樹形': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  '技術・作業': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  '管理・育成': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  '道具・用品': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  '盆器・鉢': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  '用土・肥料': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  '展示・鑑賞': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

function TermCard({ term }: { term: BonsaiTermSummary }) {
  const colorClass =
    CATEGORY_COLORS[term.category] ??
    'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'

  return (
    <Link
      href={buildDictionaryPath(term.slug)}
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

type TermListProps = {
  search?: string
  category?: string
  row?: string
}

export async function TermList({ search, category, row }: TermListProps) {
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
