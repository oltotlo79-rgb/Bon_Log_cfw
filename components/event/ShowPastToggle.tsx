/**
 * @module components/event/ShowPastToggle
 */

'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface ShowPastToggleProps {
  showPast: boolean
}

export function ShowPastToggle({ showPast }: ShowPastToggleProps) {
  const searchParams = useSearchParams()

  // 既存のクエリは維持し、showPast だけを切り替える
  const newParams = new URLSearchParams(searchParams.toString())
  if (showPast) {
    newParams.delete('showPast')
  } else {
    newParams.set('showPast', 'true')
  }

  return (
    <Link
      href={`/events?${newParams.toString()}`}
      className="flex items-center gap-2 text-sm cursor-pointer"
    >
      <input
        type="checkbox"
        checked={showPast}
        readOnly // 状態変更は Link 遷移で行うため読み取り専用
        className="w-4 h-4 rounded cursor-pointer"
      />
      <span className="text-muted-foreground hover:text-foreground whitespace-nowrap">
        終了イベントも表示
      </span>
    </Link>
  )
}
