import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getFertilizerCategories } from '@/lib/actions/fertilizer'
import { CategoryComparisonTable } from '@/components/fertilizer/CategoryComparisonTable'
import { FertilizerDisclaimer } from '@/components/fertilizer/FertilizerDisclaimer'
import { ROUTE_FERTILIZERS_CATEGORIES } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '肥料カテゴリ比較 - 施肥ガイド',
  alternates: { canonical: pageCanonical(ROUTE_FERTILIZERS_CATEGORIES) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

export default async function CategoriesPage() {
  const { categories } = await getFertilizerCategories()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">肥料カテゴリ比較</h1>
          <p className="text-sm text-muted-foreground mt-1">有機肥料・化成肥料など各種肥料の特徴を比較</p>
        </div>
        <Link
          href="/fertilizers"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0 whitespace-nowrap"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 施肥ガイドトップ
        </Link>
      </div>

      <FertilizerDisclaimer />

      <CategoryComparisonTable categories={categories} />
    </div>
  )
}
