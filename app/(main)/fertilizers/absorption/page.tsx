import type { Metadata } from 'next'
import Link from 'next/link'
import { NutrientAbsorptionDiagram } from '@/components/fertilizer/NutrientAbsorptionDiagram'
import { FertilizerDisclaimer } from '@/components/fertilizer/FertilizerDisclaimer'
import { ROUTE_FERTILIZERS_ABSORPTION } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '栄養素の吸収と転流 | 肥料ガイド',
  alternates: { canonical: pageCanonical(ROUTE_FERTILIZERS_ABSORPTION) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

export default function AbsorptionPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/fertilizers"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← 肥料ガイドに戻る
      </Link>
      <h1 className="text-2xl font-bold">栄養素の吸収と転流</h1>
      <p className="text-muted-foreground">
        根から吸収された栄養素が植物体内をどのように移動するかを、インタラクティブな図解で確認できます。
      </p>
      <NutrientAbsorptionDiagram />
      <FertilizerDisclaimer />
    </div>
  )
}
