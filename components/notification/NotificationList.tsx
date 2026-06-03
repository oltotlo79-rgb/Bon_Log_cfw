/**
 * 通知一覧コンポーネント
 *
 * @module components/notification/NotificationList
 */

'use client'

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import Image from 'next/image'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { NotificationItem } from './NotificationItem'
import { getNotifications, markAllAsRead } from '@/lib/actions/notification'
import { DEFAULT_PAGE_LIMIT, SKELETON_COUNT, STALE_TIME_REALTIME_MS } from '@/lib/constants/limits'

import type { Notification } from './NotificationItem'

type NotificationListProps = {
  initialNotifications: Notification[]
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function CheckCheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </svg>
  )
}

export function NotificationList({ initialNotifications }: NotificationListProps) {
  const queryClient = useQueryClient()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: async ({ pageParam }) => {
      return await getNotifications(pageParam)
    },
    initialPageParam: undefined as string | undefined,
    // SSR 取得分を初期データに渡し、ハイドレーション時のちらつきを防ぐ
    initialData: {
      pages: [{
        notifications: initialNotifications as Awaited<ReturnType<typeof getNotifications>>['notifications'],
        nextCursor: initialNotifications.length >= DEFAULT_PAGE_LIMIT ? initialNotifications[initialNotifications.length - 1]?.id : undefined,
      }],
      pageParams: [undefined],
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: STALE_TIME_REALTIME_MS,
  })

  const { ref } = useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage })

  // 通知ページを開いた時点で「確認済み」とみなし全件既読化する（UX 上の仕様）。
  useEffect(() => {
    const autoMarkAsRead = async () => {
      await markAllAsRead()
      refetch()
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
    }
    autoMarkAsRead()
  }, [refetch, queryClient])

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
    refetch()
    queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
  }

  if (isLoading) {
    return <NotificationListSkeleton />
  }

  const allNotifications = data?.pages.flatMap((page) => page.notifications) || []
  const hasUnread = allNotifications.some((n) => !n.isRead)

  if (allNotifications.length === 0) {
    return (
      <div className="text-center py-12">
        <Image src="/images/generated/placeholders/empty-notification.webp" alt="" width={192} height={144} className="mx-auto mb-4 opacity-60 empty-state-illustration" />
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <BellIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">通知はありません</h3>
        <p className="text-muted-foreground">
          いいね、コメント、フォローなどの通知がここに表示されます
        </p>
      </div>
    )
  }

  return (
    <div>
      {hasUnread && (
        <div className="flex justify-end p-2 border-b">
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <CheckCheckIcon className="w-4 h-4" />
            すべて既読にする
          </button>
        </div>
      )}

      <div>
        {allNotifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}
      </div>

      <div ref={ref} className="py-4 flex justify-center">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}
        {!hasNextPage && allNotifications.length > 0 && (
          <p className="text-sm text-muted-foreground">これ以上通知はありません</p>
        )}
      </div>
    </div>
  )
}

function NotificationListSkeleton() {
  return (
    <div>
      {[...Array(SKELETON_COUNT)].map((_, i) => (
        <div key={i} className="flex gap-3 p-4 border-b animate-pulse">
          <div className="w-10 h-10 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-muted rounded" />
            <div className="h-3 w-1/2 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
