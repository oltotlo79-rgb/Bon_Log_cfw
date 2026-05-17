import Link from 'next/link'
import type { TreeCategory } from '@prisma/client'
import { TREE_CATEGORY_BADGE } from '@/lib/utils/fertilizer'

type Props = {
  species: {
    name: string
    category: TreeCategory
    examples: string | null
    fertilizingPolicy: string | null
    slug: string
  }
}

export function TreeSpeciesCard({ species }: Props) {
  const badge = TREE_CATEGORY_BADGE[species.category]
  return (
    <Link
      href={`/fertilizers/schedules/${species.slug}`}
      className="block rounded-lg border p-4 hover:border-primary/40 transition-all"
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{species.name}</span>
        <span className={badge.className + ' px-2 py-0.5 text-xs rounded-full font-medium'}>
          {badge.label}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
        {species.examples}
      </p>
      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
        {species.fertilizingPolicy}
      </p>
    </Link>
  )
}
