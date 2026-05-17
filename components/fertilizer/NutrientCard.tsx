import Link from 'next/link'
import type { NutrientCategory } from '@prisma/client'
import { NutrientCategoryBadge } from '@/components/fertilizer/NutrientCategoryBadge'

type Props = {
  nutrient: {
    symbol: string
    name: string
    category: NutrientCategory
    bonsaiRole: string | null
    slug: string
  }
}

export function NutrientCard({ nutrient }: Props) {
  return (
    <Link
      href={`/fertilizers/nutrients/${nutrient.slug}`}
      className="block rounded-lg border p-4 hover:border-primary/40 transition-all"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl font-bold text-primary">{nutrient.symbol}</span>
        <div className="min-w-0 flex-1">
          {/* 狭幅カード（sm:grid-cols-3）で「マグネシウム」のような長い栄養素名が
              バッジと同列に並ぶと文字単位で改行されるため、flex-wrap で badge を
              次行に逃がし、name 側は whitespace-nowrap で単語内改行を抑止する */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-sm whitespace-nowrap">{nutrient.name}</span>
            <NutrientCategoryBadge category={nutrient.category} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {nutrient.bonsaiRole}
          </p>
        </div>
      </div>
    </Link>
  )
}
