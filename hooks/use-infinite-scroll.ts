'use client'

import { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'

type UseInfiniteScrollOptions = {
  /** React Query の `hasNextPage`。 */
  hasNextPage: boolean | undefined
  /** React Query の `isFetchingNextPage`。 */
  isFetchingNextPage: boolean
  /** 末尾到達時に呼ばれる次ページ取得関数。 */
  fetchNextPage: () => unknown
  /**
   * 監視を無効化したい場合に false。
   * ゲストビュー等で追加読み込みを止めたい時に使用。
   * 省略時は常に監視。
   */
  enabled?: boolean
}

/**
 * React Query の無限クエリとビューポート監視を組み合わせた無限スクロール用フック。
 *
 * 返された `ref` を監視対象の要素（リスト末尾のセンチネル）に設定すると、
 * 要素がビューポートに入り、かつ次ページがあり、取得中でないときに
 * 自動的に `fetchNextPage()` を呼ぶ。
 *
 * @example
 * ```tsx
 * const { ref } = useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage })
 * return <div ref={ref} />
 * ```
 */
export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  enabled = true,
}: UseInfiniteScrollOptions) {
  const { ref, inView } = useInView()

  useEffect(() => {
    if (enabled && inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [enabled, inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  return { ref, inView }
}
