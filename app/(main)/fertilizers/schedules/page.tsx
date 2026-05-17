import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getTreeSpecies } from '@/lib/actions/fertilizer'
import { TreeSpeciesCard } from '@/components/fertilizer/TreeSpeciesCard'
import { TREE_CATEGORY_BADGE } from '@/lib/utils/fertilizer'
import type { TreeCategory } from '@prisma/client'
import { ROUTE_FERTILIZERS_SCHEDULES } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '樹種別施肥スケジュール - 施肥ガイド - BON-LOG',
  alternates: { canonical: pageCanonical(ROUTE_FERTILIZERS_SCHEDULES) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

const CATEGORY_ORDER: TreeCategory[] = [
  'conifer',
  'deciduous',
  'flowering',
  'fruiting',
  'grass',
  'evergreen',
]

export default async function SchedulesPage() {
  const { treeSpecies } = await getTreeSpecies()

  const grouped = CATEGORY_ORDER.map((key) => ({
    key,
    label: TREE_CATEGORY_BADGE[key].label,
    items: treeSpecies.filter((s) => s.category === key),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">樹種別施肥スケジュール</h1>
          <p className="text-sm text-muted-foreground mt-1">樹種を選んで月別の施肥カレンダーを確認</p>
        </div>
        <Link
          href="/fertilizers"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0 whitespace-nowrap"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 施肥ガイドトップ
        </Link>
      </div>

      {grouped.map(({ key, label, items }) => {
        const hasImage = key === 'conifer' || key === 'deciduous';
        return items.length > 0 ? (
          <section key={key} className="space-y-3 mt-4">
            {hasImage && (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-4">
                <Image
                  src={`/images/generated/fertilizers/schedule-${key}.webp`}
                  alt={label}
                  fill
                  className="object-cover object-center dark:hidden"
                  sizes="(max-width: 768px) 100vw, 800px"
                />
                <Image
                  src={`/images/generated/fertilizers/schedule-${key}-dark.webp`}
                  alt={label}
                  fill
                  className="object-cover object-center hidden dark:block"
                  sizes="(max-width: 768px) 100vw, 800px"
                />
              </div>
            )}
            <h2 className="text-lg font-semibold">{label}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((species) => (
                <TreeSpeciesCard key={species.id} species={species} />
              ))}
            </div>
          </section>
        ) : null;
      })}
    </div>
  )
}
