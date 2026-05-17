export type {
  Post,
  PostUser,
  PostMedia,
  PostGenre,
  QuotePost,
  PostPoll,
  PostPollOption,
  MentionUser,
} from '@/types/post'

import type { Post, MentionUser } from '@/types/post'

export type PostCardProps = {
  post: Post
  currentUserId?: string
  initialLiked?: boolean
  initialBookmarked?: boolean
  disableNavigation?: boolean
  mentionUsers?: Map<string, MentionUser>
}
