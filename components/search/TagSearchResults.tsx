'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { PostCard } from '@/components/post/PostCard'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { searchByTag } from '@/lib/actions/search'
import { DEFAULT_PAGE_LIMIT, STALE_TIME_SEARCH_MS } from '@/lib/constants/limits'
import { SearchResultsSkeleton } from '@/components/search/SearchResultsSkeleton'

import type { Post } from '@/components/post/PostCard.types'

type TagSearchResultsProps = {
  /** 検索するハッシュタグ（#記号なし） */
  tag: string
  /** 初期表示用の投稿データ */
  initialPosts?: Post[]
  /** 現在のユーザーID */
  currentUserId?: string
}

/**
 * `useInfiniteQuery` の 1 ページ分のレスポンス。
 * 戻り値の型を明示することで queryFn 側の `as` キャストを排除する。
 */
type TagSearchPage = {
  posts: Post[]
  nextCursor: string | undefined
  error: string | undefined
}

/**
 * タグ検索結果コンポーネント
 *
 * 特定のハッシュタグを含む投稿を検索し、一覧表示。
 * タグ名と投稿数をヘッダーに表示する。
 */
export function TagSearchResults({ tag, initialPosts, currentUserId }: TagSearchResultsProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['search-tag', tag],

    queryFn: async ({ pageParam }): Promise<TagSearchPage> => {
      const result = await searchByTag(tag, pageParam)
      if (!result.success) {
        return { posts: [], nextCursor: undefined, error: result.error }
      }
      return {
        posts: result.data?.posts ?? [],
        nextCursor: result.data?.nextCursor,
        error: undefined,
      }
    },

    // ページネーションカーソル型は `string | undefined`。
    // リテラル型に narrow されないよう型注釈で明示する。
    initialPageParam: undefined as string | undefined,

    // initialPosts が配列ならサーバー fetched 済みと判断し initialData を渡して即時描画。
    // undefined はクライアント fetch 待ち（unit test 等）。空配列で省略すると再フェッチで二重描画になる。
    initialData: initialPosts !== undefined ? {
      pages: [{
        posts: initialPosts,
        nextCursor: initialPosts.length >= DEFAULT_PAGE_LIMIT ? initialPosts[initialPosts.length - 1]?.id : undefined,
        error: undefined,
      } satisfies TagSearchPage],
      pageParams: [undefined],
    } : undefined,

    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: STALE_TIME_SEARCH_MS,
    enabled: !!tag,
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
        {tag ? `#${tag} を含む投稿はありません` : 'タグを入力してください'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-4">
        <h2 className="text-lg font-semibold">#{tag}</h2>
        <p className="text-sm text-muted-foreground">{allPosts.length}件の投稿</p>
      </div>

      {allPosts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} />
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
