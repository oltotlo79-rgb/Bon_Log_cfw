import { getTimeline } from '@/lib/actions/feed'
import { Timeline } from '@/components/feed/Timeline'

type TimelineSectionProps = {
  currentUserId?: string
  isGuest?: boolean
}

export async function TimelineSection({ currentUserId, isGuest }: TimelineSectionProps) {
  const timelineResult = await getTimeline()
  const posts = timelineResult.success ? timelineResult.data?.posts ?? [] : []
  const nextCursor = timelineResult.success ? timelineResult.data?.nextCursor : undefined

  return (
    <Timeline
      initialPosts={posts}
      currentUserId={currentUserId}
      isGuest={isGuest}
      nextCursor={nextCursor}
    />
  )
}
