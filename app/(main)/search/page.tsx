import { Suspense } from 'react'

import { auth } from '@/lib/auth'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchTabs } from '@/components/search/SearchTabs'
import { GenreFilter } from '@/components/search/GenreFilter'
import { PopularTags } from '@/components/search/SearchResults'
import { getPopularTags, getAllGenres } from '@/lib/actions/search'
import { AdvancedSearchFilters } from '@/components/search/AdvancedSearchFilters'
import { isSearchMediaType } from '@/lib/constants/search-media'
import { SearchResultsContent, SearchResultsLoading } from './SearchResultsContent'

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
