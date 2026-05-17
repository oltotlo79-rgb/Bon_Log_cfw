/**
 * このファイルは、投稿のタイムライン表示と無限スクロール機能を提供します。
 *
 * @module components/feed/Timeline
 */

'use client'

/**
 * React Query の無限スクロール用Hook
 * ページネーション付きのデータフェッチを管理
 */
import { useInfiniteQuery } from '@tanstack/react-query'

/**
 * 無限スクロール用の共通フック（末尾到達で fetchNextPage を呼ぶ）
 */
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'

import { Fragment } from 'react'

/**
 * 投稿カードコンポーネント
 * 個別の投稿を表示
 */
import { PostCard } from '@/components/post/PostCard'

/**
 * フィード内広告スロット（間隔・末尾除外・上限本数を内包）
 */
import { InFeedAdSlot } from '@/components/ads'

/**
 * タイムライン取得用Server Action
 */
import { getTimeline } from '@/lib/actions/feed'

/**
 * ローディング中のスケルトン表示
 */
import { TimelineSkeleton } from './TimelineSkeleton'

/**
 * 投稿がない場合の空状態表示
 */
import Link from 'next/link'
import { EmptyTimeline } from './EmptyTimeline'
import { DEFAULT_PAGE_LIMIT, TIMELINE_AD_INTERVAL, STALE_TIME_REALTIME_MS } from '@/lib/constants/limits'
import { ROUTE_REGISTER } from '@/lib/constants/routes'

import type { Post } from '@/types/post'

/**
 * Timelineコンポーネントのprops型
 *
 * @property initialPosts - SSRで取得した初期投稿データ
 * @property currentUserId - 現在のユーザーID（いいね状態の判定に使用）
 */
type TimelineProps = {
  initialPosts: Post[]
  currentUserId?: string
  /** ゲストの場合は true。続きは新規登録を促すメッセージを表示し、追加読み込みなし */
  isGuest?: boolean
  /** ゲストでない場合の次のカーソル（初回） */
  nextCursor?: string
}

/**
 * タイムラインコンポーネント
 *
 * ## 機能
 * - 投稿一覧の無限スクロール表示
 * - SSRデータとクライアントデータの統合
 * - ローディングと空状態の処理
 *
 * ## 無限スクロールの仕組み
 * 1. 画面下部の監視要素（ref）がビューポートに入る
 * 2. inViewがtrueになる
 * 3. useEffectが発火してfetchNextPage()を呼び出し
 * 4. 次のページのデータが取得されてUIに追加
 *
 * @param initialPosts - 初期投稿データ
 * @param currentUserId - 現在のユーザーID
 *
 * @example
 * ```tsx
 * const posts = await getTimeline()
 *
 * <Timeline
 *   initialPosts={posts}
 *   currentUserId={session?.user?.id}
 * />
 * ```
 */
export function Timeline({
  initialPosts,
  currentUserId,
  isGuest = false,
  nextCursor: initialNextCursor,
}: TimelineProps) {

  /**
   * React Query の無限クエリ
   *
   * - data: ページ分割されたデータ
   * - fetchNextPage: 次のページを取得する関数
   * - hasNextPage: 次のページがあるかどうか
   * - isFetchingNextPage: 次ページ取得中かどうか
   * - isLoading: 初回ローディング中かどうか
   */
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
    /**
     * クエリキー
     * このキーでキャッシュを識別・無効化
     */
    queryKey: ['timeline'],

    /**
     * データ取得関数
     * pageParamにはカーソル（投稿ID）が渡される
     */
    queryFn: async ({ pageParam }) => {
      const result = await getTimeline(pageParam)
      if (!result.success) throw new Error(result.error)
      return result.data ?? { posts: [], nextCursor: undefined, isGuest: false }
    },

    /**
     * 初期ページパラメータ
     * 最初のページはundefined（最新から取得）
     */
    initialPageParam: undefined as string | undefined,

    /**
     * SSRで取得した初期データ
     * ハイドレーション時に使用。ゲストの場合は nextCursor なし。
     * `getTimeline` と `initialPosts` は同じ {@link Post} 型を共有するため
     * キャストなしで渡せる。
     */
    initialData: {
      pages: [{
        posts: initialPosts,
        nextCursor: isGuest ? undefined : (initialNextCursor ?? (initialPosts.length >= DEFAULT_PAGE_LIMIT ? initialPosts[initialPosts.length - 1]?.id : undefined)),
        isGuest: isGuest ?? false,
      }],
      pageParams: [undefined],
    },

    /**
     * 次のページのパラメータを取得
     * nextCursorがあれば次ページあり、なければ終端
     */
    getNextPageParam: (lastPage) => lastPage.nextCursor,

    maxPages: 10,
    staleTime: STALE_TIME_REALTIME_MS,
  })

  // 追加ページ読み込みエラーの検出（データがあるエラー状態 = ページネーションエラー）
  const hasPaginationError = isError && !isFetchingNextPage && (data?.pages?.length ?? 0) > 0

  /**
   * 末尾センチネルへの ref。ゲスト時は enabled=false で追加読み込みを止める。
   */
  const { ref } = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    enabled: !isGuest,
  })

  /**
   * 初回ローディング中はスケルトンを表示
   */
  if (isLoading) {
    return <TimelineSkeleton />
  }

  /**
   * エラー発生時はエラーUIを表示（ただしデータがある場合はページネーションエラーとして扱う）
   */
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

  /**
   * 全ページの投稿を1次元配列にフラット化
   */
  const allPosts = data?.pages.flatMap((page) => page.posts) || []

  /**
   * 投稿がない場合は空状態を表示
   */
  if (allPosts.length === 0) {
    return <EmptyTimeline />
  }

  return (
    <div className="space-y-8" data-testid="timeline">
      {allPosts.map((post, index) => {
        // 偶数・奇数インデックスで左右マージンを交互に付与し、段違いレイアウトにする
        const staggerClass = index % 2 === 0 ? 'ml-0 md:mr-12' : 'md:ml-12 mr-0'
        // 3パターンの微回転を付与して視覚的な変化を出す
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

      {/* ゲスト時: 続きは新規登録を促す */}
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

      {/* 無限スクロール検知（ゲストでない場合のみ） */}
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
