/**
 * @file 検索ページコンポーネント
 * @description 投稿、ユーザー、タグを検索するための統合検索ページ
 *              - URLパラメータに基づいて検索クエリ、タブ、ジャンルフィルターを処理
 *              - Server Componentとして実装し、初期データをサーバーサイドで取得
 *              - Suspenseを使用した段階的なコンテンツ表示をサポート
 */

// React の Suspense コンポーネント - 非同期コンテンツのローディング状態を管理
import { Suspense } from 'react'

// NextAuth.js の認証関数 - 現在のセッション情報を取得
import { auth } from '@/lib/auth'

// 検索バーコンポーネント - ユーザーが検索クエリを入力するUI
import { SearchBar } from '@/components/search/SearchBar'

// 検索タブコンポーネント - 投稿/ユーザー/タグの切り替えタブ
import { SearchTabs } from '@/components/search/SearchTabs'

// ジャンルフィルターコンポーネント - 投稿をジャンルで絞り込む機能
import { GenreFilter } from '@/components/search/GenreFilter'

// 検索結果表示コンポーネント群
// - PostSearchResults: 投稿検索結果の表示
// - UserSearchResults: ユーザー検索結果の表示
// - TagSearchResults: タグ検索結果の表示
// - PopularTags: 人気タグの一覧表示
import {
  PostSearchResults,
  UserSearchResults,
  TagSearchResults,
  PopularTags,
} from '@/components/search/SearchResults'

// 検索関連のServer Actions
// - searchPosts: 投稿を検索
// - searchUsers: ユーザーを検索
// - searchByTag: タグで投稿を検索
// - getPopularTags: 人気タグを取得
// - getAllGenres: 全ジャンルを取得
import {
  searchPosts,
  searchUsers,
  searchByTag,
  getPopularTags,
  getAllGenres,
} from '@/lib/actions/search'

import { AdvancedSearchFilters } from '@/components/search/AdvancedSearchFilters'
import { isSearchMediaType } from '@/lib/constants/search-media'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'

/**
 * ページのメタデータ定義
 * ブラウザのタブに表示されるタイトルを設定
 */
export const metadata = {
  title: '検索 - BON-LOG',
}

/**
 * 検索ページのプロパティ型定義
 * Next.js 15以降ではsearchParamsはPromiseとして渡される
 */
type SearchPageProps = {
  searchParams: Promise<{
    q?: string
    tab?: string
    genre?: string | string[]
    dateFrom?: string
    dateTo?: string
    minLikes?: string
    mediaType?: string
  }>
}

/**
 * 検索ページのメインコンポーネント
 *
 * @description
 * - URLクエリパラメータから検索条件を取得
 * - ジャンル一覧と人気タグを並列で取得
 * - タブに応じた検索結果コンポーネントを表示
 *
 * @param searchParams - URLの検索パラメータ（Promise形式）
 * @returns 検索ページのJSX
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  // URLパラメータを非同期で取得（Next.js 15以降の仕様）
  const params = await searchParams

  // 現在のセッション情報を取得（ログイン状態の確認に使用）
  const session = await auth()

  // 検索クエリの取得（未指定の場合は空文字）
  const query = params.q || ''

  // アクティブなタブの取得（未指定の場合は「投稿」タブ）
  const tab = params.tab || 'posts'

  const genreParam = params.genre
  const genreIds = Array.isArray(genreParam) ? genreParam : genreParam ? [genreParam] : []

  const dateFrom = params.dateFrom || undefined
  const dateTo = params.dateTo || undefined
  const minLikes = params.minLikes || undefined
  const mediaTypeRaw = params.mediaType || undefined
  const mediaType = isSearchMediaType(mediaTypeRaw) ? mediaTypeRaw : undefined
  const filters = (dateFrom || dateTo || minLikes || mediaType)
    ? { dateFrom, dateTo, minLikes: minLikes ? parseInt(minLikes) : undefined, mediaType }
    : undefined

  // 並列でデータ取得（パフォーマンス最適化）
  // Promise.allで同時実行し、ページ表示を高速化
  const [genresResult, popularTagsResult] = await Promise.all([
    getAllGenres(),      // 全ジャンルの取得（フィルター用）
    getPopularTags(10),  // 人気タグ上位10件の取得
  ])

  // 取得結果からデータを抽出（エラー時は空オブジェクト/配列）
  const genres = genresResult.genres || {}
  const popularTags = popularTagsResult.tags || []

  return (
    <div className="space-y-4">
      {/* 検索バー - ユーザーが検索キーワードを入力 */}
      <div className="bg-card rounded-lg border p-4">
        <SearchBar defaultValue={query} placeholder="投稿やユーザーを検索..." />
      </div>

      {/* タブと検索結果エリア */}
      <div className="bg-card rounded-lg border overflow-hidden">
        {/* 検索種別の切り替えタブ（投稿/ユーザー/タグ） */}
        <SearchTabs activeTab={tab} />

        {tab === 'posts' && (
          <div className="p-3 border-b flex items-center gap-2">
            <GenreFilter genres={genres} selectedGenreIds={genreIds} />
          </div>
        )}
        {tab === 'posts' && (
          <AdvancedSearchFilters
            dateFrom={dateFrom}
            dateTo={dateTo}
            minLikes={minLikes}
            mediaType={mediaType}
          />
        )}

        {/* 検索結果表示エリア - Suspenseでローディング状態を管理 */}
        <div className="p-4">
          <Suspense fallback={<SearchResultsLoading />}>
            <SearchResultsContent
              tab={tab}
              query={query}
              genreIds={genreIds}
              currentUserId={session?.user?.id}
              filters={filters}
            />
          </Suspense>
        </div>
      </div>

      {/* 人気タグ - クエリ未入力かつタグタブの場合のみ表示 */}
      {!query && tab === 'tags' && <PopularTags tags={popularTags} />}
    </div>
  )
}

/**
 * 検索結果コンテンツコンポーネント
 *
 * @description
 * タブの種類に応じて適切な検索を実行し、結果を表示する
 * Server Componentとして動作し、データ取得はサーバーサイドで実行
 *
 * @param tab - アクティブなタブ（posts/users/tags）
 * @param query - 検索クエリ文字列
 * @param genreIds - 選択されたジャンルIDの配列
 * @param currentUserId - 現在ログイン中のユーザーID（いいね状態表示等に使用）
 * @returns タブに応じた検索結果コンポーネント
 */
async function SearchResultsContent({
  tab,
  query,
  genreIds,
  currentUserId,
  filters,
}: {
  tab: string
  query: string
  genreIds: string[]
  currentUserId?: string
  filters?: {
    dateFrom?: string
    dateTo?: string
    minLikes?: number
    mediaType?: 'images' | 'videos' | 'text'
  }
}) {
  if (tab === 'posts') {
    const result = await searchPosts(query, genreIds.length > 0 ? genreIds : undefined, undefined, DEFAULT_PAGE_LIMIT, filters)
    const posts = result.success ? result.data?.posts ?? [] : []
    return (
      <PostSearchResults
        query={query}
        genreIds={genreIds.length > 0 ? genreIds : undefined}
        initialPosts={posts}
        currentUserId={currentUserId}
        filters={filters}
      />
    )
  }

  // ユーザータブの場合：ユーザーを検索して結果を表示
  if (tab === 'users') {
    const result = await searchUsers(query)
    const users = result.success ? result.data?.users ?? [] : []
    return <UserSearchResults query={query} initialUsers={users} />
  }

  // タグタブの場合：タグで投稿を検索して結果を表示
  if (tab === 'tags') {
    // クエリ未入力の場合は入力を促すメッセージを表示
    if (!query) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          検索したいタグを入力してください
        </div>
      )
    }
    const result = await searchByTag(query)
    const posts = result.success ? result.data?.posts ?? [] : []
    return (
      <TagSearchResults
        tag={query}
        initialPosts={posts}
        currentUserId={currentUserId}
      />
    )
  }

  // 該当するタブがない場合は何も表示しない
  return null
}

/**
 * 検索結果ローディングスケルトンコンポーネント
 *
 * @description
 * 検索結果の読み込み中に表示されるプレースホルダーUI
 * ユーザーに視覚的なフィードバックを提供し、体感的な待ち時間を短縮
 *
 * @returns ローディングスケルトンのJSX
 */
function SearchResultsLoading() {
  return (
    <div className="space-y-4">
      {/* 3つのスケルトンカードを表示 */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-muted/50 rounded-lg p-4 animate-pulse">
          {/* ユーザー情報部分のスケルトン */}
          <div className="flex items-center gap-3 mb-3">
            {/* アバタースケルトン */}
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="space-y-2">
              {/* ユーザー名スケルトン */}
              <div className="h-4 w-24 bg-muted rounded" />
              {/* 投稿日時スケルトン */}
              <div className="h-3 w-16 bg-muted rounded" />
            </div>
          </div>
          {/* 投稿本文部分のスケルトン */}
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
