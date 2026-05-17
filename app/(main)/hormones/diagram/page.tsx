import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getHormones, getHormoneInteractions } from '@/lib/actions/hormone'
import { HormoneInteractionDiagram } from '@/components/hormone/HormoneInteractionDiagram'
import { HormoneDisclaimer } from '@/components/hormone/HormoneDisclaimer'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { BASE_URL, ROUTE_HORMONES, ROUTE_HORMONE_DIAGRAM, ROUTE_HORMONE_INTERACTIONS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '相互作用ダイアグラム - 植物ホルモン - BON-LOG',
  description: '植物ホルモン間の相乗・拮抗・調節関係をネットワーク図で可視化します。',
  alternates: { canonical: pageCanonical(ROUTE_HORMONE_DIAGRAM) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

export default async function HormoneInteractionDiagramPage() {
  const [{ hormones }, { interactions }] = await Promise.all([
    getHormones(),
    getHormoneInteractions(),
  ])

  return (
    <div className="space-y-6">
      <BreadcrumbJsonLd
        items={[
          { name: '植物ホルモン', url: `${BASE_URL}${ROUTE_HORMONES}` },
          { name: '相互作用ダイアグラム', url: `${BASE_URL}${ROUTE_HORMONE_DIAGRAM}` },
        ]}
      />

      <Link href={ROUTE_HORMONES} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 植物ホルモン一覧
      </Link>

      <div>
        <h1 className="text-2xl font-bold">相互作用ダイアグラム</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ホルモン間の関係をネットワーク図で可視化します。ノードをクリックすると関連する相互作用がハイライトされます。
        </p>
      </div>

      <HormoneDisclaimer />

      <HormoneInteractionDiagram
        hormones={hormones.map((h) => ({
          id: h.id,
          name: h.name,
          slug: h.slug,
          category: h.category,
        }))}
        interactions={interactions.map((i) => ({
          hormoneAId: i.hormoneA.id,
          hormoneBId: i.hormoneB.id,
          type: i.type,
          description: i.description,
        }))}
      />

      <div className="text-sm text-muted-foreground">
        <Link href={ROUTE_HORMONE_INTERACTIONS} className="text-primary hover:underline">
          相互作用一覧（テキスト版）を見る →
        </Link>
      </div>
    </div>
  )
}
