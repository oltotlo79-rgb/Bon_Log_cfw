import type { EffectRating } from '@prisma/client'

const RATING_MAP: Record<EffectRating, { label: string; className: string }> = {
  excellent: { label: '◎', className: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700' },
  good:      { label: '○', className: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700' },
  fair:      { label: '△', className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700' },
  poor:      { label: '×', className: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700' },
  none:      { label: '—', className: 'bg-muted/40 text-muted-foreground border-muted-foreground/20' },
}

type Props = {
  rating: EffectRating | null | undefined
  label?: string
}

export function EffectRatingBadge({ rating, label }: Props) {
  if (!rating) return <span className="text-muted-foreground text-xs">—</span>
  const config = RATING_MAP[rating]
  return (
    <span className="inline-flex items-center gap-1">
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <span className={`inline-flex items-center justify-center w-6 h-6 rounded border text-sm font-bold ${config.className}`}>
        {config.label}
      </span>
    </span>
  )
}
