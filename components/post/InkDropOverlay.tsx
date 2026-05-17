'use client'

import { useEffect, useRef, useState } from 'react'
import { INK_DROP_DURATION, INK_CLEAR_DURATION } from '@/lib/constants/limits/ui'

/**
 * 墨の滴る投稿送信エフェクト
 *
 * active=trueで墨が上から円形に広がって画面を覆い、
 * 0.8秒後に下に引いて消える。投稿送信の儀式感を演出。
 */
export function InkDropOverlay({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<'idle' | 'dropping' | 'clearing'>('idle')
  const prevActive = useRef(false)

  useEffect(() => {
    if (active && !prevActive.current) {
      const dropTimer = setTimeout(() => setPhase('dropping'), 0)
      const clearTimer = setTimeout(() => setPhase('clearing'), INK_DROP_DURATION)
      const idleTimer = setTimeout(() => setPhase('idle'), INK_CLEAR_DURATION)
      prevActive.current = true
      return () => {
        clearTimeout(dropTimer)
        clearTimeout(clearTimer)
        clearTimeout(idleTimer)
      }
    }
    if (!active) {
      prevActive.current = false
    }
  }, [active])

  if (phase === 'idle') return null

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      <div
        className={`absolute inset-0 bg-foreground transition-all duration-700 ease-in-out ${
          phase === 'dropping'
            ? 'opacity-80 [clip-path:circle(150%_at_50%_0%)]'
            : 'opacity-0 [clip-path:circle(0%_at_50%_100%)]'
        }`}
      />
    </div>
  )
}
