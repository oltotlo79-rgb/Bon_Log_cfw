import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getHormoneColumnBySlug } from '@/lib/actions/hormone'
import { HormoneDisclaimer } from '@/components/hormone/HormoneDisclaimer'
import { ArticleJsonLd } from '@/components/seo/ArticleJsonLd'
import { COLUMN_OG_DESCRIPTION_LENGTH } from '@/lib/constants/limits'
import { BASE_URL, ROUTE_HORMONE_COLUMNS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const dynamic = 'force-dynamic' // (main) レイアウト/PremiumProvider が auth() を呼ぶため静的生成不可。SSR で配信しデータは unstable_cache でキャッシュ。

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const col = await getHormoneColumnBySlug(slug)
  if (!col) return { title: 'コラムが見つかりません' }
  return {
    title: `${col.title} - コラム`,
    alternates: { canonical: pageCanonical(`${ROUTE_HORMONE_COLUMNS}/${slug}`) },
  }
}

export default async function HormoneColumnDetailPage({ params }: Props) {
  const { slug } = await params
  const col = await getHormoneColumnBySlug(slug)

  if (!col) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <ArticleJsonLd
        headline={col.title}
        datePublished={col.publishedAt?.toISOString() || col.createdAt.toISOString()}
        dateModified={col.updatedAt.toISOString()}
        author={{ name: 'BON-LOG', url: BASE_URL }}
        url={`${BASE_URL}${ROUTE_HORMONE_COLUMNS}/${slug}`}
        description={col.content?.slice(0, COLUMN_OG_DESCRIPTION_LENGTH) || col.title}
      />

      <Link href={ROUTE_HORMONE_COLUMNS} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> コラム一覧
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{col.title}</h1>
        {col.publishedAt && (
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(col.publishedAt).toLocaleDateString('ja-JP')}
          </p>
        )}
      </div>

      <HormoneDisclaimer />

      <article className="prose prose-sm dark:prose-invert max-w-none">
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{col.content}</div>
      </article>
    </div>
  )
}
