import Link from 'next/link'
import Image from 'next/image'
import type { HormoneCategory } from '@prisma/client'
import { HormoneCategoryBadge } from '@/components/hormone/HormoneCategoryBadge'

type Props = {
  hormone: {
    name: string
    nameEn: string | null
    slug: string
    category: HormoneCategory
    description: string | null
    _count?: { effects: number }
  }
}

export function HormoneCard({ hormone }: Props) {
  const imgSlug = hormone.slug;
  const hasImage = ['auxin', 'gibberellin', 'cytokinin', 'abscisic-acid', 'ethylene'].includes(imgSlug);
  const prefix = hasImage ? (imgSlug === 'abscisic-acid' ? 'hormone-abscisic' : `hormone-${imgSlug}`) : null;

  return (
    <Link
      href={`/hormones/${hormone.slug}`}
      className="block rounded-lg border p-4 hover:border-primary/40 transition-all group"
    >
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        {prefix && (
          <div className="relative w-full sm:w-24 shrink-0 aspect-square rounded-md overflow-hidden bg-muted group-hover:opacity-90 transition-opacity">
            <Image
              src={`/images/generated/hormones/${prefix}.webp`}
              alt={hormone.name}
              fill
              className="object-cover object-center dark:hidden"
              sizes="96px"
            />
            <Image
              src={`/images/generated/hormones/${prefix}-dark.webp`}
              alt={hormone.name}
              fill
              className="object-cover object-center hidden dark:block"
              sizes="96px"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{hormone.name}</span>
            <HormoneCategoryBadge category={hormone.category} />
          </div>
          {hormone.nameEn && (
            <span className="text-xs text-muted-foreground">{hormone.nameEn}</span>
          )}
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {hormone.description}
          </p>
        </div>
        {hormone._count?.effects !== undefined && (
          <span className="shrink-0 text-xs text-muted-foreground">
            効果 {hormone._count.effects}件
          </span>
        )}
      </div>
    </Link>
  )
}
