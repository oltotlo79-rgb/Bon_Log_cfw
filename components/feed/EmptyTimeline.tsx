/**
 * @module components/feed/EmptyTimeline
 */

import Image from 'next/image'
import Link from 'next/link'
import { ROUTE_SEARCH } from '@/lib/constants/routes'
import { ILLUSTRATION_WIDTH, ILLUSTRATION_HEIGHT } from '@/lib/constants/limits'
import { EmptyTimelineSuggestions } from './EmptyTimelineSuggestions'

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function EmptyTimeline() {
  return (
    <div className="bg-card rounded-lg border p-8 text-center">
      <Image src="/images/generated/placeholders/empty-timeline.webp" alt="" width={ILLUSTRATION_WIDTH} height={ILLUSTRATION_HEIGHT} className="mx-auto mb-4 opacity-60 empty-state-illustration dark:hidden" />
      <Image src="/images/generated/placeholders/empty-timeline-dark.webp" alt="" width={ILLUSTRATION_WIDTH} height={ILLUSTRATION_HEIGHT} className="mx-auto mb-4 opacity-60 empty-state-illustration hidden dark:block" />
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
        <UsersIcon className="w-8 h-8 text-muted-foreground" />
      </div>

      <h3 className="text-lg font-semibold mb-2">タイムラインに投稿がありません</h3>

      <p className="text-muted-foreground mb-6">
        ユーザーをフォローすると、その人の投稿がここに表示されます
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href={ROUTE_SEARCH}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <SearchIcon className="w-4 h-4" />
          ユーザーを検索
        </Link>
      </div>

      <EmptyTimelineSuggestions />
    </div>
  )
}
