/**
 * クライアント表示用の投稿関連共通型
 *
 * Server Actions（`lib/actions/`）と UI（`components/`）の双方で参照するため、
 * レイヤを跨いだ import を避けられるよう `types/` に配置する。
 * Prisma の生のレコード型ではなく、`formatPostForClient` 後の整形済み形状を表す。
 */

export type PostUser = {
  id: string
  nickname: string
  avatarUrl: string | null
}

export type PostMedia = {
  id: string
  url: string
  type: string
  sortOrder: number
}

export type PostGenre = {
  id: string
  name: string
  category: string
}

export type QuotePost = {
  id: string
  content: string | null
  createdAt: string | Date
  user: PostUser
}

export type PostPollOption = {
  id: string
  text: string
  _count: { votes: number }
}

export type PostPoll = {
  id: string
  expiresAt: string | Date
  options: PostPollOption[]
  votes?: { userId: string; optionId: string }[]
  _count: { votes: number }
}

export type Post = {
  id: string
  content: string | null
  createdAt: string | Date
  /** 投稿後に編集された日時。null/undefined は未編集。 */
  editedAt?: string | Date | null
  user: PostUser
  media: PostMedia[]
  genres: PostGenre[]
  likeCount: number
  commentCount: number
  /** この投稿がリポストされた回数。 */
  repostCount?: number
  quotePost?: QuotePost | null
  repostPost?: (QuotePost & { media: PostMedia[] }) | null
  isLiked?: boolean
  isBookmarked?: boolean
  /** 閲覧者がこの投稿をリポスト済みか。 */
  isReposted?: boolean
  poll?: PostPoll | null
  /** プロフィール固定投稿として表示中か（オーナーのプロフィール文脈でのみ true）。 */
  isPinned?: boolean
}

export type MentionUser = {
  id: string
  nickname: string
  avatarUrl: string | null
}
