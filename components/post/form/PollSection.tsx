'use client'

import { PollForm } from '../PollForm'

type PollSectionProps = {
  isActive: boolean
  options: string[]
  duration: number
  onToggle: () => void
  onOptionsChange: (opts: string[]) => void
  onDurationChange: (d: number) => void
}

/**
 * アンケートUIセクション（PollFormコンポーネントのラッパー）
 *
 * stateなし（純粋な表示コンポーネント）
 */
export function PollSection({
  isActive,
  options,
  duration,
  onToggle,
  onOptionsChange,
  onDurationChange,
}: PollSectionProps) {
  return (
    <PollForm
      isActive={isActive}
      onToggle={onToggle}
      options={options}
      onOptionsChange={onOptionsChange}
      duration={duration}
      onDurationChange={onDurationChange}
    />
  )
}
