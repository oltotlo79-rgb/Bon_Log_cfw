/**
 * 検索結果コンポーネント群
 *
 * @module components/search/SearchResults
 */

import Link from 'next/link'

// Re-export extracted components
export { PostSearchResults } from '@/components/search/PostSearchResults'
export { UserSearchResults } from '@/components/search/UserSearchResults'
export { TagSearchResults } from '@/components/search/TagSearchResults'
export { SearchResultsSkeleton } from '@/components/search/SearchResultsSkeleton'

/**
 * PopularTagsコンポーネントのprops型
 *
 * @property tags - タグと投稿数のオブジェクト配列
 */
type PopularTagsProps = {
  /** タグ情報の配列 */
  tags: {
    /** タグ名（#なし） */
    tag: string
    /** そのタグを使用している投稿数 */
    count: number
  }[]
}

/**
 * 人気タグ一覧コンポーネント
 *
 * よく使われているタグを一覧表示し、クリックでタグ検索に遷移。
 *
 * ## 機能
 * - 人気タグのバッジ表示
 * - 投稿数の表示
 * - タグ検索へのリンク
 *
 * @param tags - タグ情報の配列
 *
 * @example
 * ```tsx
 * <PopularTags tags={[
 *   { tag: '松柏類', count: 100 },
 *   { tag: '雑木類', count: 50 }
 * ]} />
 * ```
 */
export function PopularTags({ tags }: PopularTagsProps) {
  /**
   * タグが空の場合は何も表示しない
   */
  if (tags.length === 0) {
    return null
  }

  return (
    <div className="bg-card rounded-lg border p-4">
      {/* ヘッダー */}
      <h3 className="font-semibold mb-3">人気のタグ</h3>

      {/* タグバッジ一覧 */}
      <div className="flex flex-wrap gap-2">
        {tags.map(({ tag, count }) => (
          <Link
            key={tag}
            href={`/search?tab=tags&q=${encodeURIComponent(tag)}`}
            className="px-3 py-1.5 bg-muted rounded-full text-sm hover:bg-muted/80 transition-colors"
          >
            {/* タグ名 */}
            #{tag}

            {/* 投稿数 */}
            <span className="ml-1 text-muted-foreground text-xs">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
