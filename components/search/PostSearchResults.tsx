'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { Fragment } from 'react'
import { PostCard } from '@/components/post/PostCard'
import { InFeedAdSlot } from '@/components/ads'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { searchPosts } from '@/lib/actions/search'
import { DEFAULT_PAGE_LIMIT, SEARCH_AD_INTERVAL, STALE_TIME_SEARCH_MS } from '@/lib/constants/limits'
import { SearchResultsSkeleton } from '@/components/search/SearchResultsSkeleton'
import Image from 'next/image'

import type { Post } from '@/components/post/PostCard.types'

type PostSearchResultsProps = {
  query: string
  genreIds?: string[]
  initialPosts?: Post[]
  currentUserId?: string
  filters?: {
    dateFrom?: string
    dateTo?: string
    minLikes?: number
    mediaType?: 'images' | 'videos' | 'text'
  }
}

/**
 * `useInfiniteQuery` の 1 ページ分のレスポンス。
 * 戻り値の型を明示することで queryFn 側の `as` キャストを排除し、
 * 空配列・undefined のリテラル narrowing を抑える。
 */
type PostSearchPage = {
  posts: Post[]
  nextCursor: string | undefined
  error: string | undefined
}

/**
 * 投稿検索結果コンポーネント
 *
 * テキスト検索とジャンルフィルタによる投稿の検索結果を表示。
 * 無限スクロールに対応し、スクロールに応じて自動的に次のページを読み込む。
 */
export function PostSearchResults({
  query,
  genreIds,
  initialPosts,
  currentUserId,
  filters,
}: PostSearchResultsProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['search-posts', query, genreIds, filters],

    queryFn: async ({ pageParam }): Promise<PostSearchPage> => {
      const result = await searchPosts(query, genreIds, pageParam, DEFAULT_PAGE_LIMIT, filters)
      if (!result.success) {
        return { posts: [], nextCursor: undefined, error: result.error }
      }
      return {
        posts: result.data?.posts ?? [],
        nextCursor: result.data?.nextCursor,
        error: undefined,
      }
    },

    // ページネーションカーソル型は `string | undefined`（最初は undefined）。
    // リテラル型に narrow されないよう型注釈で明示する。
    initialPageParam: undefined as string | undefined,

    // initialPosts が配列なら（空配列も含む）サーバーで既にフェッチ済みと判断し initialData を渡す。
    // undefined の場合はクライアント側でフェッチする（unit test 等、SC 経由しないケース）。
    // 空配列で initialData を省略するとスケルトン → 再フェッチの二重描画で E2E の 10s タイムアウトを踏む。
    initialData: initialPosts !== undefined ? {
      pages: [{
        posts: initialPosts,
        nextCursor: initialPosts.length >= DEFAULT_PAGE_LIMIT ? initialPosts[initialPosts.length - 1]?.id : undefined,
        error: undefined,
      } satisfies PostSearchPage],
      pageParams: [undefined],
    } : undefined,

    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: STALE_TIME_SEARCH_MS,
  })

  const { ref } = useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage })

  if (isLoading) {
    return <SearchResultsSkeleton />
  }

  // 検索側が返す error 文字列（長すぎる query、レート制限 等）を「該当なし」と区別する
  const latestError = data?.pages.length
    ? data.pages[data.pages.length - 1]?.error
    : undefined
  const allPosts = data?.pages.flatMap((page) => page.posts) || []

  if (latestError) {
    return (
      <div className="text-center py-8 text-destructive">
        {latestError}
      </div>
    )
  }

  if (allPosts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {query && (
          <Image src="/images/generated/placeholders/empty-search.webp" alt="" width={192} height={144} className="mx-auto mb-4 opacity-60 empty-state-illustration" />
        )}
        {query ? `「${query}」に一致する投稿はありません` : '投稿が見つかりません'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {allPosts.map((post, index) => (
        <Fragment key={post.id}>
          <PostCard post={post} currentUserId={currentUserId} />
          <InFeedAdSlot
            index={index}
            total={allPosts.length}
            interval={SEARCH_AD_INTERVAL}
          />
        </Fragment>
      ))}

      <div ref={ref} className="py-4 flex justify-center">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {!hasNextPage && allPosts.length > 0 && (
          <p className="text-sm text-muted-foreground">これ以上投稿はありません</p>
        )}
      </div>
    </div>
  )
}
