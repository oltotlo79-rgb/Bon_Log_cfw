import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getActiveIngredients } from '@/lib/actions/pesticide'
import { PesticideDisclaimer } from '@/components/pesticide/PesticideDisclaimer'
import { IngredientSearchForm } from './IngredientSearchForm'
import { ROUTE_PESTICIDES_INGREDIENTS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '原体一覧 - 農薬・病害虫',
  alternates: { canonical: pageCanonical(ROUTE_PESTICIDES_INGREDIENTS) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

type Props = {
  searchParams: Promise<{ search?: string }>
}

export default async function IngredientsPage({ searchParams }: Props) {
  const params = await searchParams
  const { ingredients } = await getActiveIngredients({ search: params.search })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">原体一覧</h1>
          <p className="text-sm text-muted-foreground mt-1">FRAC/IRACコード・原体グループで検索可能</p>
        </div>
        <Link
          href="/pesticides"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0 whitespace-nowrap"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 農薬・病害虫トップ
        </Link>
      </div>

      <PesticideDisclaimer />

      <IngredientSearchForm defaultSearch={params.search} />

      {ingredients.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">原体データが見つかりませんでした</p>
      ) : (
        <div className="space-y-2">
          {ingredients.map((ing: { id: string; slug: string; name: string; nameEn: string | null; fracCode: string | null; iracCode: string | null; ingredientGroup: string | null; _count: { pesticides: number } }) => (
            <Link
              key={ing.id}
              href={`/pesticides/ingredients/${ing.slug}`}
              className="flex items-center gap-3 rounded-lg border border-border/40 p-3 hover:border-primary/40 hover:bg-muted/20 transition-all"
            >
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium break-words block">{ing.name}</span>
                {ing.nameEn && <span className="text-xs text-muted-foreground ml-2">{ing.nameEn}</span>}
                <div className="flex flex-wrap gap-2 mt-1">
                  {ing.fracCode && (
                    <span className="rounded bg-muted text-muted-foreground px-1.5 py-0.5 text-[10px]">
                      FRAC: {ing.fracCode}
                    </span>
                  )}
                  {ing.iracCode && (
                    <span className="rounded bg-muted text-muted-foreground px-1.5 py-0.5 text-[10px]">
                      IRAC: {ing.iracCode}
                    </span>
                  )}
                  {ing.ingredientGroup && (
                    <span className="text-[10px] text-muted-foreground">{ing.ingredientGroup}</span>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 flex-shrink-0 whitespace-nowrap">
                {ing._count.pesticides > 0 && `${ing._count.pesticides}製品`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
