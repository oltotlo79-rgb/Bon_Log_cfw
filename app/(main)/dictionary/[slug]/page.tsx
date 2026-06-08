import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getTermBySlug, getAdjacentTerms, getRelatedTerms } from '@/lib/actions/dictionary'
import { DefinedTermJsonLd } from '@/components/seo/JsonLd'
import { BASE_URL, ROUTE_DICTIONARY } from '@/lib/constants/routes'
import { buildDictionaryPath } from '@/lib/constants/path-builders'
import { pageCanonical, pageTitle } from '@/lib/utils/seo'
import { META_DESCRIPTION_PREVIEW_LENGTH, DESCRIPTION_UI_PREVIEW_LENGTH } from '@/lib/constants/limits'

export const dynamic = 'force-dynamic' // (main) レイアウト/PremiumProvider が auth() を呼ぶため静的生成不可。SSR で配信しデータは unstable_cache でキャッシュ。

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const { term } = await getTermBySlug(slug)
  if (!term) return { title: '用語が見つかりません' }
  const title = `${term.term}（${term.reading}） - 盆栽用語辞典`
  const description = term.description.slice(0, META_DESCRIPTION_PREVIEW_LENGTH)
  const canonical = pageCanonical(`${ROUTE_DICTIONARY}/${slug}`)
  const ogImageUrl = `/api/og?title=${encodeURIComponent(term.term)}`
  return {
    title: pageTitle(title),
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: term.term }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  '樹形': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  '技術・作業': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  '管理・育成': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  '道具・用品': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  '盆器・鉢': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  '用土・肥料': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  '展示・鑑賞': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

export default async function DictionaryTermPage({ params }: Props) {
  const { slug } = await params
  const { term } = await getTermBySlug(slug)

  if (!term) notFound()

  const [{ prev, next }, { terms: relatedTerms }] = await Promise.all([
    getAdjacentTerms(slug, term.category),
    getRelatedTerms(slug, term.category),
  ])

  const colorClass =
    CATEGORY_COLORS[term.category] ??
    'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'

  return (
    <div className="space-y-6">
      <DefinedTermJsonLd
        name={term.term}
        description={term.description.slice(0, DESCRIPTION_UI_PREVIEW_LENGTH)}
        category={term.category}
        url={`${BASE_URL}/dictionary/${slug}`}
      />
      <Link
        href="/dictionary"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        盆栽用語辞典
      </Link>

      <article className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{term.reading}</p>
            <h1 className="text-2xl font-bold">{term.term}</h1>
          </div>
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${colorClass}`}>
            {term.category}
          </span>
        </div>

        <hr className="border-border" />

        <p className="text-sm leading-relaxed whitespace-pre-wrap">{term.description}</p>
      </article>

      {relatedTerms.length > 0 && (
        <section aria-labelledby="related-terms-heading" className="space-y-3">
          <h2 id="related-terms-heading" className="text-lg font-semibold">
            関連用語
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {relatedTerms.map((related) => (
              <li key={related.id}>
                <Link
                  href={buildDictionaryPath(related.slug)}
                  className="group flex items-center gap-2 rounded-lg border border-border p-3 hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                      {related.term}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{related.reading}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground ml-auto" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="flex items-center justify-between gap-4 pt-2" aria-label="用語ナビゲーション">
        {prev ? (
          <Link
            href={buildDictionaryPath(prev.slug)}
            className="flex-1 flex items-center gap-2 rounded-lg border border-border p-3 hover:border-primary/50 hover:bg-muted/50 transition-colors min-w-0"
          >
            <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">前の用語</p>
              <p className="text-sm font-medium truncate">{prev.term}</p>
            </div>
          </Link>
        ) : (
          <div className="flex-1" />
        )}

        {next ? (
          <Link
            href={buildDictionaryPath(next.slug)}
            className="flex-1 flex items-center justify-end gap-2 rounded-lg border border-border p-3 hover:border-primary/50 hover:bg-muted/50 transition-colors min-w-0 text-right"
          >
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">次の用語</p>
              <p className="text-sm font-medium truncate">{next.term}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </nav>

      <div className="text-center">
        <Link
          href={`/dictionary?category=${encodeURIComponent(term.category)}`}
          className="text-sm text-primary hover:underline"
        >
          「{term.category}」の用語一覧を見る
        </Link>
      </div>
    </div>
  )
}
