import type { Metadata } from 'next'
import Link from 'next/link'
import { NutrientSymptomSearch } from '@/components/fertilizer/NutrientSymptomSearch'
import { FertilizerDisclaimer } from '@/components/fertilizer/FertilizerDisclaimer'
import { ROUTE_FERTILIZERS_SYMPTOMS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '症状から探す栄養素 | 肥料ガイド',
  alternates: { canonical: pageCanonical(ROUTE_FERTILIZERS_SYMPTOMS) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

export default function SymptomsPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/fertilizers"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← 肥料ガイドに戻る
      </Link>
      <h1 className="text-2xl font-bold">症状から探す栄養素</h1>
      <p className="text-muted-foreground">
        盆栽に現れた症状から、不足している可能性のある栄養素を逆引き検索できます。
      </p>
      <NutrientSymptomSearch />
      <FertilizerDisclaimer />
    </div>
  )
}
