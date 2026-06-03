/**
 * @module components/feed/Timeline
 */

'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { Fragment } from 'react'
import { PostCard } from '@/components/post/PostCard'
import { InFeedAdSlot } from '@/components/ads'
import { getTimeline } from '@/lib/actions/feed'
import { TimelineSkeleton } from './TimelineSkeleton'
import Link from 'next/link'
import { EmptyTimeline } from './EmptyTimeline'
import { DEFAULT_PAGE_LIMIT, TIMELINE_AD_INTERVAL, STALE_TIME_REALTIME_MS } from '@/lib/constants/limits'
import { ROUTE_REGISTER } from '@/lib/constants/routes'

import type { Post } from '@/types/post'

type TimelineProps = {
  initialPosts: Post[]
  currentUserId?: string
  isGuest?: boolean
  nextCursor?: string
}

export function Timeline({
  initialPosts,
  currentUserId,
  isGuest = false,
  nextCursor: initialNextCursor,
}: TimelineProps) {

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['timeline'],

    queryFn: async ({ pageParam }) => {
      const result = await getTimeline(pageParam)
      if (!result.success) throw new Error(result.error)
      return result.data ?? { posts: [], nextCursor: undefined, isGuest: false }
    },

    initialPageParam: undefined as string | undefined,

    // getTimeline と initialPosts は同じ Post 型を共有するためキャストなしで渡せる
    initialData: {
      pages: [{
        posts: initialPosts,
        nextCursor: isGuest ? undefined : (initialNextCursor ?? (initialPosts.length >= DEFAULT_PAGE_LIMIT ? initialPosts[initialPosts.length - 1]?.id : undefined)),
        isGuest: isGuest ?? false,
      }],
      pageParams: [undefined],
    },

    getNextPageParam: (lastPage) => lastPage.nextCursor,

    maxPages: 10,
    staleTime: STALE_TIME_REALTIME_MS,
  })

  // データがあるエラー状態 = 追加ページ読み込みのページネーションエラー
  const hasPaginationError = isError && !isFetchingNextPage && (data?.pages?.length ?? 0) > 0

  const { ref } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    enabled: !isGuest,
  })

  if (isLoading) {
    return <TimelineSkeleton />
  }

  if (isError && (!data || data.pages.length === 0)) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">タイムラインの読み込みに失敗しました</p>
        {error instanceof Error && (
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
        )}
        <button
          onClick={() => refetch()}
          className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          再試行
        </button>
      </div>
    )
  }

  const allPosts = data?.pages.flatMap((page) => page.posts) || []

  if (allPosts.length === 0) {
    return <EmptyTimeline />
  }

  return (
    <div className="space-y-8" data-testid="timeline">
      {allPosts.map((post, index) => {
        // 偶数・奇数で左右マージンを交互に付与し段違いレイアウトにする
        const staggerClass = index % 2 === 0 ? 'ml-0 md:mr-12' : 'md:ml-12 mr-0'
        // 3パターンの微回転で視覚的な変化を出す
        const rotateClass = index % 3 === 0 ? '-rotate-1' : index % 3 === 1 ? 'rotate-1' : 'rotate-2'

        return (
          <Fragment key={post.id}>
            <div className={`${staggerClass} transform ${rotateClass} transition-all duration-500 hover:rotate-0 hover:z-10 relative`}>
              <PostCard post={post} currentUserId={currentUserId} />
            </div>
            <InFeedAdSlot
              index={index}
              total={allPosts.length}
              interval={TIMELINE_AD_INTERVAL}
            />
          </Fragment>
        )
      })}

      {isGuest && (
        <div className="py-8 text-center border-t border-border/50 bg-muted/30 rounded-lg">
          <p className="text-base font-medium text-muted-foreground">
            続きは新規登録をお願いします。
          </p>
          <Link
            href={ROUTE_REGISTER}
            className="mt-2 inline-block text-sm text-primary hover:underline"
          >
            無料で新規登録 →
          </Link>
        </div>
      )}

      {!isGuest && (
        <div
          ref={ref}
          className="py-4 flex flex-col items-center gap-2"
          role="status"
          aria-live="polite"
        >
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div
                className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"
                aria-hidden="true"
              />
              <span className="text-sm">投稿を読み込んでいます...</span>
            </div>
          )}
          {hasPaginationError && (
            <div className="text-center py-4">
              <p className="text-sm text-destructive mb-2">追加の読み込みに失敗しました</p>
              <button
                onClick={() => fetchNextPage()}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                再試行
              </button>
            </div>
          )}
          {!isFetchingNextPage && !hasPaginationError && hasNextPage && (
            <p className="text-xs text-muted-foreground">
              {allPosts.length}件の投稿を表示中
            </p>
          )}
          {!hasNextPage && allPosts.length > 0 && (
            <p className="text-sm text-muted-foreground">
              すべての投稿を表示しました（{allPosts.length}件）
            </p>
          )}
        </div>
      )}
    </div>
  )
}
