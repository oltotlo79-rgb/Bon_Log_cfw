import type { EventFieldViolation } from '@/lib/validation/event-import'
import { Badge } from '@/components/ui/badge'
import { getEventFieldLabel, formatEventFieldViolation } from './event-field-labels'

type EventViolationBadgesProps = {
  violations: EventFieldViolation[]
}

/**
 * インポート行ごとの文字数超過を警告するバッジ群。
 * rejected は取込不可（初期選択から除外）、clipped は切り詰めて取込まれる旨を示す。
 */
export function EventViolationBadges({ violations }: EventViolationBadgesProps) {
  if (violations.length === 0) return null

  const rejected = violations.filter((v) => v.kind === 'rejected')
  const clipped = violations.filter((v) => v.kind === 'clipped')

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {rejected.length > 0 && (
        <Badge
          variant="destructive"
          title={rejected.map(formatEventFieldViolation).join('、')}
        >
          取込不可: {rejected.map((v) => getEventFieldLabel(v.field)).join('・')}が長すぎます
        </Badge>
      )}
      {clipped.map((v) => (
        <Badge
          key={v.field}
          variant="outline"
          className="border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        >
          {formatEventFieldViolation(v)} — 切り詰めて取込
        </Badge>
      ))}
    </div>
  )
}
