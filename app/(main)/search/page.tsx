import { Suspense } from 'react'

import { auth } from '@/lib/auth'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchTabs } from '@/components/search/SearchTabs'
import { GenreFilter } from '@/components/search/GenreFilter'
import {
  PostSearchResults,
  UserSearchResults,
  TagSearchResults,
  PopularTags,
} from '@/components/search/SearchResults'
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

export const metadata = {
  title: '検索',
  robots: { index: false, follow: false },
}

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

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const session = await auth()

  const query = params.q || ''
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

  const [genresResult, popularTagsResult] = await Promise.all([
    getAllGenres(),
    getPopularTags(10),
  ])

  const genres = genresResult.genres || {}
  const popularTags = popularTagsResult.tags || []

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border p-4">
        <SearchBar defaultValue={query} placeholder="投稿やユーザーを検索..." />
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
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

      {!query && tab === 'tags' && <PopularTags tags={popularTags} />}
    </div>
  )
}

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

  if (tab === 'users') {
    const result = await searchUsers(query)
    const users = result.success ? result.data?.users ?? [] : []
    return <UserSearchResults query={query} initialUsers={users} />
  }

  if (tab === 'tags') {
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

  return null
}

function SearchResultsLoading() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-muted/50 rounded-lg p-4 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
