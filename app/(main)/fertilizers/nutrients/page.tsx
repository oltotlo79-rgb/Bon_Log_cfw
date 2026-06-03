import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getNutrients } from '@/lib/actions/fertilizer'
import { NutrientCard } from '@/components/fertilizer/NutrientCard'
import type { NutrientCategory } from '@prisma/client'
import { ROUTE_FERTILIZERS_NUTRIENTS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '栄養素一覧 - 施肥ガイド',
  alternates: { canonical: pageCanonical(ROUTE_FERTILIZERS_NUTRIENTS) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

const CATEGORY_ORDER: { key: NutrientCategory; label: string }[] = [
  { key: 'primary', label: '三大要素' },
  { key: 'secondary', label: '二次要素' },
  { key: 'trace', label: '微量要素' },
]

export default async function NutrientsPage() {
  const { nutrients } = await getNutrients()

  const grouped = CATEGORY_ORDER.map(({ key, label }) => ({
    key,
    label,
    items: nutrients.filter((n) => n.category === key),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">栄養素一覧</h1>
          <p className="text-sm text-muted-foreground mt-1">{nutrients.length}件</p>
        </div>
        <Link
          href="/fertilizers"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0 whitespace-nowrap"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 施肥ガイドトップ
        </Link>
      </div>

      {grouped.map(({ key, label, items }) =>
        items.length > 0 ? (
          <section key={key} className="space-y-3">
            <h2 className="text-lg font-semibold">{label}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((nutrient) => (
                <NutrientCard key={nutrient.id} nutrient={nutrient} />
              ))}
            </div>
          </section>
        ) : null,
      )}
    </div>
  )
}
