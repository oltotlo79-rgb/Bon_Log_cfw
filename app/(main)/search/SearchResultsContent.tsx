import {
  searchPosts,
  searchUsers,
  searchByTag,
} from '@/lib/actions/search'
import {
  PostSearchResults,
  UserSearchResults,
  TagSearchResults,
} from '@/components/search/SearchResults'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'

type SearchResultsContentProps = {
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
}

export async function SearchResultsContent({
  tab,
  query,
  genreIds,
  currentUserId,
  filters,
}: SearchResultsContentProps) {
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

export function SearchResultsLoading() {
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
