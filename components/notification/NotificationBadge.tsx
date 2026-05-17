'use client'

/**
 * @module components/notification/NotificationBadge
 *
 * 未読通知数のバッジ。クライアント版 (React Query で polling) と Server 版
 * (SSR で 1 回だけ取得) を用意し、ヘッダー / サイドバーから用途に応じて使い分ける。
 */

import { useQuery } from '@tanstack/react-query'
import { getUnreadCount } from '@/lib/actions/notification'
import { BADGE_OVERFLOW_THRESHOLD, REFETCH_INTERVAL_MS } from '@/lib/constants/limits'

type NotificationBadgeProps = {
  className?: string
}

export function NotificationBadge({ className }: NotificationBadgeProps) {
  const { data } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: async () => {
      return await getUnreadCount()
    },
    refetchInterval: REFETCH_INTERVAL_MS,
  })

  const count = data?.count || 0
  if (count === 0) return null

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium bg-foreground text-background rounded-full ${className}`}
      aria-label={`未読通知${count}件`}
    >
      {count > BADGE_OVERFLOW_THRESHOLD ? `${BADGE_OVERFLOW_THRESHOLD}+` : count}
    </span>
  )
}

/**
 * SSR 版: Server Component から呼んで初期描画する。
 * リアルタイム更新は行わないため、polling が必要な箇所では `NotificationBadge` を使う。
 */
export async function NotificationBadgeServer() {
  const { count } = await getUnreadCount()
  if (count === 0) return null
  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium bg-foreground text-background rounded-full">
      {count > BADGE_OVERFLOW_THRESHOLD ? `${BADGE_OVERFLOW_THRESHOLD}+` : count}
    </span>
  )
}
