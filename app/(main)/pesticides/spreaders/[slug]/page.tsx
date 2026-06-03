import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { getPesticideBySlug, getSpreaderTypeBySlug } from '@/lib/actions/pesticide'
import { prisma } from '@/lib/db'
import { loadStaticParams } from '@/lib/build/static-params'
import { PesticideDisclaimer } from '@/components/pesticide/PesticideDisclaimer'
import { ROUTE_PESTICIDES_SPREADERS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const canonical = pageCanonical(`${ROUTE_PESTICIDES_SPREADERS}/${slug}`)
  const product = await getPesticideBySlug(slug)
  if (product) {
    return {
      title: `${product.name} - 展着剤`,
      alternates: { canonical },
    }
  }
  const typeItem = await getSpreaderTypeBySlug(slug)
  if (typeItem) {
    return {
      title: `${typeItem.name}の展着剤`,
      alternates: { canonical },
    }
  }
  return { title: '展着剤が見つかりません' }
}

export async function generateStaticParams() {
  return loadStaticParams(async () => {
    const items = await prisma.spreaderType.findMany({ select: { slug: true } })
    return items.map((i) => ({ slug: i.slug }))
  }, '/pesticides/spreaders')
}

export default async function SpreaderDetailPage({ params }: Props) {
  const { slug } = await params

  // 製品の場合は製品詳細ページへリダイレクト（旧URL・ブックマーク対策）
  const product = await getPesticideBySlug(slug)
  if (product) {
    redirect(`/pesticides/products/${slug}`)
  }

  // 2. 次に型（分類）としての詳細を試行（互換性のため）
  const typeItem = await getSpreaderTypeBySlug(slug)
  if (!typeItem) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <Link href="/pesticides/spreaders" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 展着剤一覧
      </Link>

      <h1 className="text-2xl font-bold">{typeItem.name}</h1>
      <PesticideDisclaimer />

      {typeItem.description && (
        <section className="rounded-lg border border-border/40 p-4">
          <h2 className="text-sm font-semibold mb-2">概要</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{typeItem.description}</p>
        </section>
      )}

      {typeItem.effect && (
        <section className="rounded-lg border border-border/40 p-4">
          <h2 className="text-sm font-semibold mb-2">効果</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{typeItem.effect}</p>
        </section>
      )}

      {typeItem.usageNote && (
        <section className="rounded-lg border border-border/40 p-4">
          <h2 className="text-sm font-semibold mb-2">利用時の注意</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{typeItem.usageNote}</p>
        </section>
      )}
    </div>
  )
}
