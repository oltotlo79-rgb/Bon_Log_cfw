/**
 * 文字数カウント円形プログレスリングコンポーネント
 *
 * テキスト入力の残り文字数を視覚的に表示する円形プログレスバー。
 * 通常時は小さなリング、警告域に入ると大きくなり残り文字数を表示。
 *
 * @module components/post/CharacterCountRing
 */

import { cn } from '@/lib/utils'
import { REMAINING_CHARS_WARNING_THRESHOLD } from '@/lib/constants/limits'

type CharacterCountRingProps = {
  /** 現在の文字数 */
  current: number
  /** 最大文字数 */
  max: number
}

export function CharacterCountRing({ current, max }: CharacterCountRingProps) {
  const remaining = max - current
  const ratio = Math.min(current / max, 1)
  const isWarning = remaining <= REMAINING_CHARS_WARNING_THRESHOLD
  const isOver = remaining < 0

  const size = isWarning ? 28 : 20
  const radius = (size - 4) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - Math.min(ratio, 1))

  if (current === 0) return null

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted/30"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={isOver ? 0 : strokeDashoffset}
          strokeLinecap="round"
          className={cn(
            'transition-all duration-200',
            isOver ? 'text-destructive' : isWarning ? 'text-amber-500' : 'text-primary'
          )}
          stroke="currentColor"
        />
      </svg>
      {isWarning && (
        <span className={cn(
          'absolute text-[9px] font-medium tabular-nums',
          isOver ? 'text-destructive' : 'text-amber-500'
        )}>
          {remaining}
        </span>
      )}
    </div>
  )
}
