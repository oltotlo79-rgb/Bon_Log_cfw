/**
 * @module components/message/MessageBadge
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { getUnreadMessageCount } from '@/lib/actions/message'
import {
  BADGE_OVERFLOW_THRESHOLD,
  BADGES_CONVERSATIONS_LIMIT,
  REFETCH_INTERVAL_MS,
} from '@/lib/constants/limits'

type MessageBadgeProps = {
  className?: string
}

export function MessageBadge({ className }: MessageBadgeProps) {
  const { data } = useQuery({
    queryKey: ['unreadMessageCount'],
    queryFn: async () => {
      const result = await getUnreadMessageCount()
      return result.success ? result.data : undefined
    },
    refetchInterval: REFETCH_INTERVAL_MS,
  })

  // 直近200会話で概算しており、上限到達時は capReached が true
  const count = data?.count ?? 0
  const capReached = data?.capReached === true

  if (count === 0) {
    return null
  }

  // 200会話上限到達かつ未読200以上は「200+」、それ以外は99+または実数
  const label =
    capReached && count >= BADGES_CONVERSATIONS_LIMIT
      ? `${BADGES_CONVERSATIONS_LIMIT}+`
      : count > BADGE_OVERFLOW_THRESHOLD
        ? `${BADGE_OVERFLOW_THRESHOLD}+`
        : count

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium bg-foreground text-background rounded-full ${className}`}
      aria-label={`未読メッセージ${count}件`}
    >
      {label}
    </span>
  )
}
