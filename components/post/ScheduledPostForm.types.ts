/**
 * @module components/post/ScheduledPostForm.types
 */
import type { MembershipLimits } from '@/lib/premium'

export type ScheduledPostGenre = {
  id: string
  name: string
  category: string
}

export type ScheduledPostFormProps = {
  genres: Record<string, ScheduledPostGenre[]>
  limits: MembershipLimits
  editData?: {
    id: string
    content: string | null
    scheduledAt: Date
    genreIds: string[]
    media: { url: string; type: string }[]
  }
}
