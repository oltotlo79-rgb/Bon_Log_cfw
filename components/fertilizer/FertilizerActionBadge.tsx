import type { FertilizerAction } from '@prisma/client'
import { FERTILIZER_ACTION_BADGE } from '@/lib/utils/fertilizer'

type Props = {
  action: FertilizerAction
}

export function FertilizerActionBadge({ action }: Props) {
  const badge = FERTILIZER_ACTION_BADGE[action]
  return (
    <span className={badge.className + ' inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium'}>
      <span>{badge.icon}</span>
      <span>{badge.label}</span>
    </span>
  )
}
