import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getColumnBySlug } from '@/lib/actions/pesticide'
import { prisma } from '@/lib/db'
import { loadStaticParams } from '@/lib/build/static-params'
import { PesticideDisclaimer } from '@/components/pesticide/PesticideDisclaimer'
import { ArticleJsonLd } from '@/components/seo/ArticleJsonLd'
import { COLUMN_OG_DESCRIPTION_LENGTH } from '@/lib/constants/limits'
import { BASE_URL, ROUTE_PESTICIDES_COLUMNS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const col = await getColumnBySlug(slug)
  if (!col) return { title: 'コラムが見つかりません - BON-LOG' }
  return {
    title: `${col.title} - コラム - BON-LOG`,
    alternates: { canonical: pageCanonical(`${ROUTE_PESTICIDES_COLUMNS}/${slug}`) },
  }
}

export async function generateStaticParams() {
  return loadStaticParams(async () => {
    const items = await prisma.pesticideColumn.findMany({ select: { slug: true } })
    return items.map((i) => ({ slug: i.slug }))
  }, '/pesticides/columns')
}

export default async function ColumnDetailPage({ params }: Props) {
  const { slug } = await params
  const col = await getColumnBySlug(slug)

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
        url={`${BASE_URL}${ROUTE_PESTICIDES_COLUMNS}/${slug}`}
        description={col.content?.slice(0, COLUMN_OG_DESCRIPTION_LENGTH) || col.title}
      />

      <Link href={ROUTE_PESTICIDES_COLUMNS} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
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

      <PesticideDisclaimer />

      <article className="prose prose-sm dark:prose-invert max-w-none">
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{col.content}</div>
      </article>
    </div>
  )
}
