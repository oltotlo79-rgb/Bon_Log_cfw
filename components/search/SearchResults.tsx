/**
 * @module components/search/SearchResults
 */

import Link from 'next/link'

export { PostSearchResults } from '@/components/search/PostSearchResults'
export { UserSearchResults } from '@/components/search/UserSearchResults'
export { TagSearchResults } from '@/components/search/TagSearchResults'
export { SearchResultsSkeleton } from '@/components/search/SearchResultsSkeleton'

type PopularTagsProps = {
  tags: {
    tag: string
    count: number
  }[]
}

export function PopularTags({ tags }: PopularTagsProps) {
  if (tags.length === 0) {
    return null
  }

  return (
    <div className="bg-card rounded-lg border p-4">
      <h3 className="font-semibold mb-3">人気のタグ</h3>

      <div className="flex flex-wrap gap-2">
        {tags.map(({ tag, count }) => (
          <Link
            key={tag}
            href={`/search?tab=tags&q=${encodeURIComponent(tag)}`}
            className="px-3 py-1.5 bg-muted rounded-full text-sm hover:bg-muted/80 transition-colors"
          >
            #{tag}

            <span className="ml-1 text-muted-foreground text-xs">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
