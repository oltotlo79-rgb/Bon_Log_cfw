import type { HormoneCategory } from '@prisma/client'

const BADGE_CONFIG: Record<HormoneCategory, { label: string; className: string }> = {
  major: {
    label: '五大ホルモン',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  secondary: {
    label: '二次ホルモン',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
}

type Props = {
  category: HormoneCategory
}

export function HormoneCategoryBadge({ category }: Props) {
  const badge = BADGE_CONFIG[category]
  return (
    <span className={badge.className + ' px-2 py-0.5 text-xs rounded-full font-medium'}>
      {badge.label}
    </span>
  )
}
