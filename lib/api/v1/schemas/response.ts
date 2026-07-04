/**
 * @module lib/api/v1/schemas/response
 * モバイル API v1 レスポンスボディの Zod スキーマ。
 *
 * route handler の実戻り値と OpenAPI ジェネレータの双方が同一スキーマを参照する。
 * エラーコード enum は MOBILE_API_ERROR_CODES から全値を z.enum 化する。
 */

import { z } from 'zod'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { DICTIONARY_CATEGORIES, KANA_ROW_LABELS } from '@/lib/constants/dictionary'

// ──────────────────────────────────────────────────
// 成功レスポンス
// ──────────────────────────────────────────────────

/** アクセストークン + リフレッシュトークン + 有効期間（秒）のペア */
export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
})
export type TokenPair = z.infer<typeof tokenPairSchema>

/** POST /api/v1/auth/login 202 — 2FA が必要な場合 */
export const requires2FASchema = z.object({
  requires2FA: z.literal(true),
  ticket: z.string(),
})
export type Requires2FAResponse = z.infer<typeof requires2FASchema>

/**
 * GET /api/v1/auth/2fa/setup 200
 *
 * otpAuthUrl は otpauth:// URI（Native 側でローカルに QR を描画する用途）。
 * setupId は POST /api/v1/auth/2fa/enable に必須で渡す必要がある
 * （TOTP シークレットの再送を避けるための一時参照キー）。
 */
export const twoFactorSetupResponseSchema = z.object({
  secret: z.string(),
  otpAuthUrl: z.string(),
  setupId: z.string(),
  backupCodes: z.array(z.string()),
})
export type TwoFactorSetupResponse = z.infer<typeof twoFactorSetupResponseSchema>

/** POST /api/v1/auth/2fa/enable 200 */
export const twoFactorEnableResponseSchema = z.object({
  enabled: z.literal(true),
})
export type TwoFactorEnableResponse = z.infer<typeof twoFactorEnableResponseSchema>

/** DELETE /api/v1/auth/2fa/disable 200 */
export const twoFactorDisableResponseSchema = z.object({
  disabled: z.literal(true),
})
export type TwoFactorDisableResponse = z.infer<typeof twoFactorDisableResponseSchema>

/** 単純な成功フラグ（logout / password-reset/request / password-reset/confirm） */
export const successSchema = z.object({
  success: z.literal(true),
})
export type SuccessResponse = z.infer<typeof successSchema>

/** GET /api/v1/users/me 200 */
export const usersMeSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  isPremium: z.boolean(),
  twoFactorEnabled: z.boolean(),
})
export type UsersMeResponse = z.infer<typeof usersMeSchema>

// ──────────────────────────────────────────────────
// Phase 2 Batch 2a — 読み取り系エンドポイント
// ──────────────────────────────────────────────────

/** メディアファイル（画像・動画）の共通スキーマ */
export const mediaItemSchema = z.object({
  id: z.string(),
  url: z.string(),
  type: z.string(),
  sortOrder: z.number().int(),
})
export type MediaItem = z.infer<typeof mediaItemSchema>

/** ジャンルの共通スキーマ */
export const genreItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
})
export type GenreItem = z.infer<typeof genreItemSchema>

/** 投稿著者の最小スキーマ（nestedPost / quotePost / repostPost のネスト投稿著者に使用） */
export const postAuthorSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
})
export type PostAuthor = z.infer<typeof postAuthorSchema>

/**
 * トップレベル投稿者・コメント投稿者のスキーマ（閲覧者視点の Block/Mute 状態付き）。
 *
 * nestedPostSchema（quotePost / repostPost の著者）には適用しない。
 * スコープをトップレベルのみに限定することで isBlocked/isMuted の
 * 計算コストをページ単位の著者数に抑える。
 */
export const postAuthorWithStateSchema = postAuthorSchema.extend({
  /** 閲覧者が投稿者をブロック中か（ゲストまたは未ブロックは false） */
  isBlocked: z.boolean(),
  /** 閲覧者が投稿者をミュート中か（ゲストまたは未ミュートは false） */
  isMuted: z.boolean(),
})
export type PostAuthorWithState = z.infer<typeof postAuthorWithStateSchema>

/** 引用元・リポスト元投稿（ネスト）の最小スキーマ */
export const nestedPostSchema = z.object({
  id: z.string(),
  content: z.string(),
  user: postAuthorSchema,
  media: z.array(mediaItemSchema).optional(),
})
export type NestedPost = z.infer<typeof nestedPostSchema>

/** メンションユーザーの最小スキーマ */
export const mentionedUserSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
})
export type MentionedUser = z.infer<typeof mentionedUserSchema>

// ──────────────────────────────────────────────────
// アンケート（PostResponse 埋め込み用 poll 実形）
// ──────────────────────────────────────────────────

/**
 * PostResponse.poll.options の 1 件。
 *
 * Prisma の生形をそのまま JSON 化したもの。
 * 投票後レスポンス用の PollOptionResponse（voteCount/percentage を持つ）とは別スキーマ。
 */
export const postPollOptionSchema = z.object({
  id: z.string(),
  pollId: z.string(),
  text: z.string(),
  sortOrder: z.number().int(),
  _count: z.object({ votes: z.number().int() }),
})
export type PostPollOption = z.infer<typeof postPollOptionSchema>

/** PostResponse.poll.votes の 1 件（認証ユーザーの投票履歴レコード） */
export const postPollVoteRecordSchema = z.object({
  id: z.string(),
  pollId: z.string(),
  optionId: z.string(),
  userId: z.string(),
  createdAt: z.string().datetime(),
})
export type PostPollVoteRecord = z.infer<typeof postPollVoteRecordSchema>

/**
 * PostResponse.poll の型（Prisma 生形をそのまま JSON 化）。
 *
 * totalVotes は _count.votes で取得する。閲覧者の投票状態は votes[0].optionId で判定する
 * （votes フィールドはゲストには含まれない；未投票なら空配列）。
 * PollVoteResponse（投票後 expiresAt/isExpired/totalVotes/userVoteOptionId を返す）とは別形状。
 */
export const postPollSchema = z.object({
  id: z.string(),
  postId: z.string(),
  duration: z.number().int(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  options: z.array(postPollOptionSchema),
  /** 認証ユーザーのみ存在。投票済みなら 1 件、未投票なら空配列。ゲストには含まれない。 */
  votes: z.array(postPollVoteRecordSchema).optional(),
  _count: z.object({ votes: z.number().int() }),
})
export type PostPollResponse = z.infer<typeof postPollSchema>

/**
 * GET /api/v1/feed および /api/v1/posts/[id] の投稿スキーマ
 *
 * content フィールド: メンションは `<@userId>` トークンとして格納される。
 * mentionedUsers で id→表示情報を解決してクライアント側でレンダリングすること。
 */
export const postSchema = z.object({
  id: z.string(),
  /** メンションは `<@userId>` トークンとして格納され、mentionedUsers で id→表示情報を解決する */
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  userId: z.string(),
  user: postAuthorWithStateSchema,
  media: z.array(mediaItemSchema),
  genres: z.array(genreItemSchema),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  repostCount: z.number().int(),
  isLiked: z.boolean(),
  isBookmarked: z.boolean(),
  isReposted: z.boolean(),
  quotePost: nestedPostSchema.nullable(),
  repostPost: nestedPostSchema.nullable(),
  poll: postPollSchema.nullable(),
  mentionedUsers: z.array(mentionedUserSchema),
})
export type PostResponse = z.infer<typeof postSchema>

// NOTE: feedResponseSchema / searchPostsResponseSchema は postSchema を参照するため
// postSchema.user の変更が自動伝播する。別途スキーマを作る必要はない。

/** GET /api/v1/feed 200 */
export const feedResponseSchema = z.object({
  items: z.array(postSchema),
  nextCursor: z.string().nullable(),
  isGuest: z.boolean(),
})
export type FeedResponse = z.infer<typeof feedResponseSchema>

/**
 * GET /api/v1/posts/[id]/comments のコメントスキーマ
 *
 * content フィールド: メンションは `<@userId>` トークンとして格納される。
 * mentionedUsers で id→表示情報を解決してクライアント側でレンダリングすること。
 */
export const commentSchema = z.object({
  id: z.string(),
  postId: z.string(),
  userId: z.string(),
  parentId: z.string().nullable(),
  /** メンションは `<@userId>` トークンとして格納され、mentionedUsers で id→表示情報を解決する */
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  isDeleted: z.boolean(),
  isBlockedUser: z.boolean(),
  likeCount: z.number().int(),
  replyCount: z.number().int(),
  isLiked: z.boolean(),
  user: postAuthorWithStateSchema,
  media: z.array(mediaItemSchema),
  mentionedUsers: z.array(mentionedUserSchema),
})
export type CommentResponse = z.infer<typeof commentSchema>

/** GET /api/v1/posts/[id]/comments 200 */
export const commentsListResponseSchema = z.object({
  items: z.array(commentSchema),
  nextCursor: z.string().nullable(),
})
export type CommentsListResponse = z.infer<typeof commentsListResponseSchema>

/**
 * GET /api/v1/users/[id]/comments の 1 件。
 * Post に slug/title が存在しないため、遷移先として `post.id` を GET /api/v1/posts/{id} に渡す設計。
 */
export const userCommentListItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
  post: z.object({
    id: z.string(),
    content: z.string().nullable(),
  }),
  media: z.array(mediaItemSchema),
})
export type UserCommentListItem = z.infer<typeof userCommentListItemSchema>

/** GET /api/v1/users/[id]/comments 200 */
export const userCommentsListResponseSchema = z.object({
  items: z.array(userCommentListItemSchema),
  nextCursor: z.string().nullable(),
})
export type UserCommentsListResponse = z.infer<typeof userCommentsListResponseSchema>

/** GET /api/v1/users/[id] 200 */
export const userProfileSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
  headerUrl: z.string().nullable(),
  bio: z.string().nullable(),
  location: z.string().nullable(),
  isPublic: z.boolean(),
  bonsaiStartYear: z.number().int().nullable(),
  bonsaiStartMonth: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  postsCount: z.number().int(),
  followersCount: z.number().int(),
  followingCount: z.number().int(),
  following: z.boolean(),
  requested: z.boolean(),
  isSelf: z.boolean(),
  /** 閲覧者が対象ユーザーをブロックしているか（自分自身の場合は false） */
  isBlocked: z.boolean(),
  /** 閲覧者が対象ユーザーをミュートしているか（自分自身の場合は false） */
  isMuted: z.boolean(),
  /** 対象ユーザーがプレミアム会員かどうか */
  isPremium: z.boolean(),
})
export type UserProfileResponse = z.infer<typeof userProfileSchema>

// ──────────────────────────────────────────────────
// Phase 2 Batch 2b — 通報・ブロック・ミュート
// ──────────────────────────────────────────────────

/** POST /api/v1/users/[id]/block 200 */
export const blockResponseSchema = z.object({
  blocked: z.boolean(),
})
export type BlockResponse = z.infer<typeof blockResponseSchema>

/** POST /api/v1/users/[id]/mute 200 */
export const muteResponseSchema = z.object({
  muted: z.boolean(),
})
export type MuteResponse = z.infer<typeof muteResponseSchema>

/** ブロック/ミュート一覧の各ユーザー項目 */
export const userMinimalWithBioSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
})
export type UserMinimalWithBio = z.infer<typeof userMinimalWithBioSchema>

/** GET /api/v1/users/me/blocks 200 / GET /api/v1/users/me/mutes 200 */
export const userMinimalListResponseSchema = z.object({
  items: z.array(userMinimalWithBioSchema),
  nextCursor: z.string().nullable(),
})
export type UserMinimalListResponse = z.infer<typeof userMinimalListResponseSchema>

/** GET /api/v1/search/posts 200 */
export const searchPostsResponseSchema = z.object({
  items: z.array(postSchema),
  nextCursor: z.string().nullable(),
})
export type SearchPostsResponse = z.infer<typeof searchPostsResponseSchema>

/** GET /api/v1/search/users の検索ユーザースキーマ */
export const searchUserItemSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  followersCount: z.number().int(),
  followingCount: z.number().int(),
  following: z.boolean(),
  requested: z.boolean(),
  isPublic: z.boolean(),
})
export type SearchUserItem = z.infer<typeof searchUserItemSchema>

/** GET /api/v1/search/users 200 */
export const searchUsersResponseSchema = z.object({
  items: z.array(searchUserItemSchema),
  nextCursor: z.string().nullable(),
})
export type SearchUsersResponse = z.infer<typeof searchUsersResponseSchema>

/** 通知アクター（最小情報）のスキーマ */
export const notificationActorSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
})
export type NotificationActor = z.infer<typeof notificationActorSchema>

/** GET /api/v1/notifications の通知スキーマ */
export const notificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  isRead: z.boolean(),
  createdAt: z.string().datetime(),
  actorId: z.string().nullable(),
  postId: z.string().nullable(),
  commentId: z.string().nullable(),
  actor: notificationActorSchema.nullable(),
  post: z.object({ id: z.string(), content: z.string() }).nullable(),
  comment: z.object({ id: z.string(), content: z.string() }).nullable(),
})
export type NotificationResponse = z.infer<typeof notificationSchema>

/** GET /api/v1/notifications 200 */
export const notificationsListResponseSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
})
export type NotificationsListResponse = z.infer<typeof notificationsListResponseSchema>

/** GET /api/v1/notifications/unread-count 200 */
export const unreadCountResponseSchema = z.object({
  count: z.number().int(),
})
export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>

// ──────────────────────────────────────────────────
// Phase 2 Batch 2c-upload — メディアアップロード
// ──────────────────────────────────────────────────

/**
 * POST /api/v1/upload/presigned 200
 *
 * 動画 presigned PUT URL のレスポンス。
 * クライアントは uploadUrl に Content-Type / Content-Length を付与して PUT する。
 * fileUrl は自社ストレージの公開 URL で、投稿作成時の mediaUrls に渡せる。
 */
export const presignedUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  fileUrl: z.string().url(),
  key: z.string(),
  contentLength: z.number().int().positive(),
})
export type PresignedUploadResponse = z.infer<typeof presignedUploadResponseSchema>

/**
 * POST /api/v1/upload/image 200
 *
 * 画像アップロード成功のレスポンス。
 * url は EXIF/GPS 除去済みの自社ストレージ公開 URL で、投稿作成時の mediaUrls に渡せる。
 */
export const imageUploadResponseSchema = z.object({
  url: z.string().url(),
})
export type ImageUploadResponse = z.infer<typeof imageUploadResponseSchema>

// ──────────────────────────────────────────────────
// Batch 2d — プロフィール編集・アカウント削除
// ──────────────────────────────────────────────────

/**
 * PATCH /api/v1/users/me 200 — 更新後のプロフィール
 *
 * usersMeSchema に加え、プロフィール編集で変更できる全フィールドを含む。
 * GET /api/v1/users/me の拡張版であり、編集後の確定値として使用できる。
 */
export const usersMeFullSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
  headerUrl: z.string().nullable(),
  bio: z.string().nullable(),
  location: z.string().nullable(),
  isPublic: z.boolean(),
  bonsaiStartYear: z.number().int().nullable(),
  bonsaiStartMonth: z.number().int().nullable(),
  birthDate: z.string().nullable(),
  isPremium: z.boolean(),
  twoFactorEnabled: z.boolean(),
})
export type UsersMeFullResponse = z.infer<typeof usersMeFullSchema>

// ──────────────────────────────────────────────────
// Phase 3 Batch 3a — ブックマーク + 発見/explore
// ──────────────────────────────────────────────────

/** POST/DELETE /api/v1/posts/[id]/bookmark 200 */
export const bookmarkResponseSchema = z.object({
  bookmarked: z.boolean(),
})
export type BookmarkResponse = z.infer<typeof bookmarkResponseSchema>

/** GET /api/v1/users/me/bookmarks 200 */
export const bookmarksListResponseSchema = z.object({
  items: z.array(postSchema),
  nextCursor: z.string().nullable(),
})
export type BookmarksListResponse = z.infer<typeof bookmarksListResponseSchema>

/** GET /api/v1/explore/trending-hashtags の 1 件 */
export const trendingHashtagItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().int(),
})
export type TrendingHashtagItem = z.infer<typeof trendingHashtagItemSchema>

/** GET /api/v1/explore/trending-hashtags 200 */
export const trendingHashtagsResponseSchema = z.object({
  items: z.array(trendingHashtagItemSchema),
})
export type TrendingHashtagsResponse = z.infer<typeof trendingHashtagsResponseSchema>

/** GET /api/v1/search/hashtags 200 */
export const hashtagSearchResponseSchema = z.object({
  items: z.array(trendingHashtagItemSchema),
})
export type HashtagSearchResponse = z.infer<typeof hashtagSearchResponseSchema>

/** GET /api/v1/explore/trending-genres の 1 件 */
export const trendingGenreItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  /** 直近 48 時間の投稿数。0 の場合は集計対象外または未集計。 */
  postCount: z.number().int(),
})
export type TrendingGenreItem = z.infer<typeof trendingGenreItemSchema>

/** GET /api/v1/explore/trending-genres 200 */
export const trendingGenresResponseSchema = z.object({
  items: z.array(trendingGenreItemSchema),
})
export type TrendingGenresResponse = z.infer<typeof trendingGenresResponseSchema>

/** GET /api/v1/explore/recommended-users の 1 件 */
export const recommendedUserItemSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  followersCount: z.number().int(),
  following: z.boolean(),
  requested: z.boolean(),
  isPublic: z.boolean(),
})
export type RecommendedUserItem = z.infer<typeof recommendedUserItemSchema>

/** GET /api/v1/explore/recommended-users 200 */
export const recommendedUsersResponseSchema = z.object({
  items: z.array(recommendedUserItemSchema),
})
export type RecommendedUsersResponse = z.infer<typeof recommendedUsersResponseSchema>

// ──────────────────────────────────────────────────
// Phase 3 Batch 3b — 辞典・施肥・ホルモン（読み取り専用・ゲスト可）
// ──────────────────────────────────────────────────

// ── 辞典 ─────────────────────────────────────────

/** GET /api/v1/dictionary の 1 件（一覧・ナビゲーション共通） */
export const dictionaryTermSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  term: z.string(),
  reading: z.string(),
  category: z.string(),
  description: z.string(),
})
export type DictionaryTermSummaryResponse = z.infer<typeof dictionaryTermSummarySchema>

/** GET /api/v1/dictionary/{slug} の詳細 */
export const dictionaryTermDetailSchema = dictionaryTermSummarySchema.extend({
  description: z.string(),
})
export type DictionaryTermDetailResponse = z.infer<typeof dictionaryTermDetailSchema>

/** GET /api/v1/dictionary 200 */
export const dictionaryListResponseSchema = z.object({
  items: z.array(dictionaryTermSummarySchema),
  nextCursor: z.string().nullable(),
})
export type DictionaryListResponse = z.infer<typeof dictionaryListResponseSchema>

/** GET /api/v1/dictionary/{slug} 200 */
export const dictionaryDetailResponseSchema = z.object({
  term: dictionaryTermDetailSchema,
  prev: dictionaryTermSummarySchema.nullable(),
  next: dictionaryTermSummarySchema.nullable(),
  related: z.array(dictionaryTermSummarySchema),
})
export type DictionaryDetailResponse = z.infer<typeof dictionaryDetailResponseSchema>

// ── 辞典 enum 契約 ──────────────────────────────────

/**
 * 辞典カテゴリ enum（7 固定値）。
 * DICTIONARY_CATEGORIES 定数から導出する。
 */
export const dictionaryCategorySchema = z.enum(DICTIONARY_CATEGORIES)
export type DictionaryCategory = z.infer<typeof dictionaryCategorySchema>

/**
 * 五十音行 enum（10 行）。
 * KANA_ROW_LABELS 定数から導出する。
 */
export const kanaRowSchema = z.enum(KANA_ROW_LABELS)
export type KanaRow = z.infer<typeof kanaRowSchema>

// ── 施肥 ─────────────────────────────────────────

/** GET /api/v1/fertilizers/nutrients の 1 件 */
export const nutrientItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  bonsaiRole: z.string().nullable(),
  slug: z.string(),
})
export type NutrientItem = z.infer<typeof nutrientItemSchema>

/** GET /api/v1/fertilizers/nutrients/{slug} の詳細 */
export const nutrientDetailSchema = nutrientItemSchema.extend({
  deficiencySymptoms: z.string().nullable(),
  excessSymptoms: z.string().nullable(),
  foodSources: z.string().nullable(),
})
export type NutrientDetail = z.infer<typeof nutrientDetailSchema>

/** GET /api/v1/fertilizers/categories の 1 件 */
export const fertilizerCategoryItemSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  merit: z.string().nullable(),
  demerit: z.string().nullable(),
  bonsaiUsage: z.string().nullable(),
  slug: z.string(),
})
export type FertilizerCategoryItem = z.infer<typeof fertilizerCategoryItemSchema>

/** GET /api/v1/fertilizers/tree-species の 1 件 */
export const treeSpeciesItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  fertilizingPolicy: z.string().nullable(),
  slug: z.string(),
})
export type TreeSpeciesItem = z.infer<typeof treeSpeciesItemSchema>

/** GET /api/v1/fertilizers/tree-species/{slug}/schedule の月別データ 1 件 */
export const fertilizationMonthSchema = z.object({
  month: z.number().int(),
  action: z.string(),
  nitrogenLevel: z.string().nullable(),
  phosphorusLevel: z.string().nullable(),
  potassiumLevel: z.string().nullable(),
  recommendedType: z.string().nullable(),
  description: z.string().nullable(),
  cautionNote: z.string().nullable(),
})
export type FertilizationMonth = z.infer<typeof fertilizationMonthSchema>

/** GET /api/v1/fertilizers/tree-species/{slug}/schedule 200 */
export const fertilizationScheduleResponseSchema = z.object({
  treeSpeciesName: z.string(),
  nameEn: z.string().nullable(),
  category: z.string(),
  description: z.string().nullable(),
  examples: z.string().nullable(),
  fertilizingPolicy: z.string().nullable(),
  slug: z.string(),
  months: z.array(fertilizationMonthSchema),
})
export type FertilizationScheduleResponse = z.infer<typeof fertilizationScheduleResponseSchema>

// ── 施肥 enum 契約 ──────────────────────────────────

/** NutrientCategory enum（Prisma enum 値と一致） */
export const nutrientCategorySchema = z.enum(['primary', 'secondary', 'trace'])
export type NutrientCategoryEnum = z.infer<typeof nutrientCategorySchema>

/** TreeCategory enum（Prisma enum 値と一致） */
export const treeCategorySchema = z.enum([
  'conifer',
  'deciduous',
  'flowering',
  'fruiting',
  'grass',
  'evergreen',
])
export type TreeCategoryEnum = z.infer<typeof treeCategorySchema>

/** FertilizerAction enum（Prisma enum 値と一致） */
export const fertilizerActionSchema = z.enum(['none', 'light', 'moderate', 'heavy'])
export type FertilizerActionEnum = z.infer<typeof fertilizerActionSchema>

/** NutrientLevel enum（Prisma enum 値と一致） */
export const nutrientLevelSchema = z.enum(['high', 'balanced', 'low', 'none'])
export type NutrientLevelEnum = z.infer<typeof nutrientLevelSchema>

// ── Wave 3 F-1 / F-2 施肥コラム ──────────────────────

/** GET /api/v1/fertilizers/columns の 1 件 */
export const fertilizerColumnItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  publishedAt: z.string().datetime(),
  sortOrder: z.number().int(),
})
export type FertilizerColumnItem = z.infer<typeof fertilizerColumnItemSchema>

/** GET /api/v1/fertilizers/columns/{slug} の詳細 */
export const fertilizerColumnDetailSchema = fertilizerColumnItemSchema.extend({
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type FertilizerColumnDetail = z.infer<typeof fertilizerColumnDetailSchema>

/** GET /api/v1/fertilizers/columns 200 */
export const fertilizerColumnListResponseSchema = z.object({
  items: z.array(fertilizerColumnItemSchema),
  nextCursor: z.string().nullable(),
})
export type FertilizerColumnListResponse = z.infer<typeof fertilizerColumnListResponseSchema>

// ── ホルモン ──────────────────────────────────────

/** GET /api/v1/hormones の 1 件 */
export const hormoneItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameEn: z.string().nullable(),
  slug: z.string(),
  category: z.string(),
  chemicalFormula: z.string().nullable(),
  description: z.string().nullable(),
})
export type HormoneItem = z.infer<typeof hormoneItemSchema>

/** GET /api/v1/hormones/{slug} の effects 1 件 */
export const hormoneEffectSchema = z.object({
  effectName: z.string(),
  isPromoting: z.boolean(),
})
export type HormoneEffect = z.infer<typeof hormoneEffectSchema>

/** GET /api/v1/hormones/{slug} の seasonalLevels 1 件 */
export const hormoneSeasonalLevelSchema = z.object({
  month: z.number().int(),
  level: z.string(),
})
export type HormoneSeasonalLevel = z.infer<typeof hormoneSeasonalLevelSchema>

/** GET /api/v1/hormones/interactions の 1 件 / 詳細 interactions 配列要素 */
export const hormoneInteractionItemSchema = z.object({
  id: z.string(),
  hormoneAId: z.string(),
  hormoneAName: z.string(),
  hormoneASlug: z.string(),
  hormoneBId: z.string(),
  hormoneBName: z.string(),
  hormoneBSlug: z.string(),
  type: z.string(),
  description: z.string().nullable(),
  bonsaiRelevance: z.string().nullable(),
})
export type HormoneInteractionItem = z.infer<typeof hormoneInteractionItemSchema>

/** GET /api/v1/hormones/interactions 200 */
export const hormoneInteractionListResponseSchema = z.object({
  items: z.array(hormoneInteractionItemSchema),
})
export type HormoneInteractionListResponse = z.infer<typeof hormoneInteractionListResponseSchema>

/** 詳細 techniques 配列要素（techniqueSlug → techniqueKey / techniqueName → techniqueNameJa にリマップ） */
export const hormoneTechniqueItemSchema = z.object({
  id: z.string(),
  techniqueKey: z.string(),
  techniqueNameJa: z.string(),
  techniqueNameEn: z.string().nullable(),
  effectType: z.string(),
  magnitude: z.string(),
  mechanism: z.string().nullable(),
})
export type HormoneTechniqueItem = z.infer<typeof hormoneTechniqueItemSchema>

/** GET /api/v1/hormones/techniques の effects 1 件 */
export const hormoneTechniqueEffectItemSchema = z.object({
  hormoneId: z.string(),
  hormoneNameJa: z.string(),
  hormoneSlug: z.string(),
  effectType: z.string(),
  magnitude: z.string(),
  mechanism: z.string().nullable(),
})
export type HormoneTechniqueEffectItem = z.infer<typeof hormoneTechniqueEffectItemSchema>

/**
 * GET /api/v1/hormones/techniques の技法グループ 1 件。
 *
 * 注: HormoneTechnique モデルに技法レベルの description フィールドが存在しないため
 * description は含まない（実データに忠実）。
 */
export const hormoneTechniqueGroupSchema = z.object({
  techniqueKey: z.string(),
  techniqueNameJa: z.string(),
  techniqueNameEn: z.string().nullable(),
  effects: z.array(hormoneTechniqueEffectItemSchema),
})
export type HormoneTechniqueGroup = z.infer<typeof hormoneTechniqueGroupSchema>

/** GET /api/v1/hormones/techniques 200 */
export const hormoneTechniqueListResponseSchema = z.object({
  items: z.array(hormoneTechniqueGroupSchema),
})
export type HormoneTechniqueListResponse = z.infer<typeof hormoneTechniqueListResponseSchema>

/** GET /api/v1/hormones/{slug} の詳細（interactions / techniques を含む） */
export const hormoneDetailSchema = hormoneItemSchema.extend({
  bonsaiRole: z.string().nullable(),
  productionSite: z.string().nullable(),
  practicalTips: z.string().nullable(),
  activationMethod: z.string().nullable(),
  effects: z.array(hormoneEffectSchema),
  seasonalLevels: z.array(hormoneSeasonalLevelSchema),
  interactions: z.array(hormoneInteractionItemSchema),
  techniques: z.array(hormoneTechniqueItemSchema),
})
export type HormoneDetail = z.infer<typeof hormoneDetailSchema>

// ── ホルモン enum 契約 ──────────────────────────────

/** HormoneCategory enum（Prisma enum 値と一致） */
export const hormoneCategorySchema = z.enum(['major', 'secondary'])
export type HormoneCategoryEnum = z.infer<typeof hormoneCategorySchema>

// ── Wave 3 H-5 シミュレーター ────────────────────────

/** GET /api/v1/hormones/simulator の hormones 配列要素 */
export const hormoneSimulatorHormoneItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  nameEn: z.string().nullable(),
})
export type HormoneSimulatorHormoneItem = z.infer<typeof hormoneSimulatorHormoneItemSchema>

/** GET /api/v1/hormones/simulator の techniques[].effects 配列要素 */
export const hormoneSimulatorEffectItemSchema = z.object({
  hormoneId: z.string(),
  effectType: z.string(),
  magnitude: z.string(),
})
export type HormoneSimulatorEffectItem = z.infer<typeof hormoneSimulatorEffectItemSchema>

/** GET /api/v1/hormones/simulator の techniques 配列要素 */
export const hormoneSimulatorTechniqueItemSchema = z.object({
  techniqueKey: z.string(),
  nameJa: z.string(),
  nameEn: z.string().nullable(),
  effects: z.array(hormoneSimulatorEffectItemSchema),
})
export type HormoneSimulatorTechniqueItem = z.infer<typeof hormoneSimulatorTechniqueItemSchema>

/** GET /api/v1/hormones/simulator の seasonalLevels 配列要素 */
export const hormoneSimulatorSeasonalLevelItemSchema = z.object({
  hormoneId: z.string(),
  month: z.number().int(),
  level: z.string(),
})
export type HormoneSimulatorSeasonalLevelItem = z.infer<typeof hormoneSimulatorSeasonalLevelItemSchema>

/** GET /api/v1/hormones/simulator 200 */
export const hormoneSimulatorResponseSchema = z.object({
  hormones: z.array(hormoneSimulatorHormoneItemSchema),
  techniques: z.array(hormoneSimulatorTechniqueItemSchema),
  seasonalLevels: z.array(hormoneSimulatorSeasonalLevelItemSchema),
})
export type HormoneSimulatorResponse = z.infer<typeof hormoneSimulatorResponseSchema>

// ── Wave 3 H-6 / H-7 ホルモンコラム ──────────────────

/** GET /api/v1/hormones/columns の 1 件 */
export const hormoneColumnItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  publishedAt: z.string().datetime(),
  sortOrder: z.number().int(),
})
export type HormoneColumnItem = z.infer<typeof hormoneColumnItemSchema>

/** GET /api/v1/hormones/columns/{slug} の詳細 */
export const hormoneColumnDetailSchema = hormoneColumnItemSchema.extend({
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type HormoneColumnDetail = z.infer<typeof hormoneColumnDetailSchema>

/** GET /api/v1/hormones/columns 200 */
export const hormoneColumnListResponseSchema = z.object({
  items: z.array(hormoneColumnItemSchema),
  nextCursor: z.string().nullable(),
})
export type HormoneColumnListResponse = z.infer<typeof hormoneColumnListResponseSchema>

// ──────────────────────────────────────────────────
// Phase 3 Batch 3c — 農薬・病害虫図鑑（読み取り専用・ゲスト可）
// ──────────────────────────────────────────────────

// ── 農薬・病害虫 enum 契約 ────────────────────────

/** DiseasePestCategory enum（Prisma enum 値と一致） */
export const diseasePestCategorySchema = z.enum(['disease', 'pest', 'beneficial_insect'])
export type DiseasePestCategoryEnum = z.infer<typeof diseasePestCategorySchema>

/** PesticideType enum（Prisma enum 値と一致） */
export const pesticideTypeSchema = z.enum(['fungicide', 'insecticide', 'acaricide', 'compound', 'other'])
export type PesticideTypeEnum = z.infer<typeof pesticideTypeSchema>

/** EffectRating enum（Prisma enum 値と一致） */
export const effectRatingSchema = z.enum(['excellent', 'good', 'fair', 'poor', 'none'])
export type EffectRatingEnum = z.infer<typeof effectRatingSchema>

/** ResistanceRisk enum（Prisma enum 値と一致） */
export const resistanceRiskSchema = z.enum(['low', 'medium', 'high'])
export type ResistanceRiskEnum = z.infer<typeof resistanceRiskSchema>

// ── 病害虫図鑑 ────────────────────────────────────

/** GET /api/v1/pesticides/disease-pests の 1 件 */
export const diseasePestItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameKana: z.string().nullable(),
  category: diseasePestCategorySchema,
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  slug: z.string(),
  bodySizeMinMm: z.number().nullable(),
  bodySizeMaxMm: z.number().nullable(),
})
export type DiseasePestItem = z.infer<typeof diseasePestItemSchema>

/** 農薬製品詳細の有効成分 1 件 */
export const pesticideActiveIngredientItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  fracCode: z.string().nullable(),
  iracCode: z.string().nullable(),
  resistanceRisk: resistanceRiskSchema.nullable(),
  slug: z.string(),
})
export type PesticideActiveIngredientItem = z.infer<typeof pesticideActiveIngredientItemSchema>

/** 農薬製品詳細の剤型 */
export const pesticideFormulationTypeSchema = z.object({
  name: z.string(),
  code: z.string(),
})
export type PesticideFormulationType = z.infer<typeof pesticideFormulationTypeSchema>

/** GET /api/v1/pesticides/disease-pests の効果 1 件 */
export const diseasePestEffectItemSchema = z.object({
  pesticide: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    pesticideType: pesticideTypeSchema,
    formulationType: pesticideFormulationTypeSchema.nullable(),
    activeIngredients: z.array(pesticideActiveIngredientItemSchema),
  }),
  rating: z.object({
    preventionLevel: effectRatingSchema.nullable(),
    treatmentLevel: effectRatingSchema.nullable(),
    efficacyLevel: effectRatingSchema.nullable(),
    persistenceLevel: effectRatingSchema.nullable(),
  }),
})
export type DiseasePestEffectItem = z.infer<typeof diseasePestEffectItemSchema>

/** GET /api/v1/pesticides/disease-pests/{slug} の詳細 */
export const diseasePestDetailSchema = diseasePestItemSchema.extend({
  effects: z.array(diseasePestEffectItemSchema),
})
export type DiseasePestDetail = z.infer<typeof diseasePestDetailSchema>

/** GET /api/v1/pesticides/disease-pests 200 */
export const diseasePestListResponseSchema = z.object({
  items: z.array(diseasePestItemSchema),
  nextCursor: z.string().nullable(),
})
export type DiseasePestListResponse = z.infer<typeof diseasePestListResponseSchema>

// ── 農薬製品 ──────────────────────────────────────

/** GET /api/v1/pesticides/products の 1 件 */
export const pesticideItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  registrationNumber: z.string().nullable(),
  pesticideType: pesticideTypeSchema,
  description: z.string().nullable(),
  slug: z.string(),
})
export type PesticideItem = z.infer<typeof pesticideItemSchema>

/** 農薬製品詳細の効果 1 件 */
export const pesticideEffectItemSchema = z.object({
  diseasePest: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
  rating: z.object({
    preventionLevel: effectRatingSchema.nullable(),
    treatmentLevel: effectRatingSchema.nullable(),
    efficacyLevel: effectRatingSchema.nullable(),
    persistenceLevel: effectRatingSchema.nullable(),
  }),
})
export type PesticideEffectItem = z.infer<typeof pesticideEffectItemSchema>

/** 農薬製品詳細の混用不可 1 件 */
export const pesticideIncompatibilityItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  formulationTypeName: z.string().nullable(),
})
export type PesticideIncompatibilityItem = z.infer<typeof pesticideIncompatibilityItemSchema>

/** 農薬製品詳細の展着剤タイプ 1 件（GET /api/v1/pesticides/spreader-products の spreaderTypes 配列要素と共用） */
export const spreaderTypeInProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
})
export type SpreaderTypeInProduct = z.infer<typeof spreaderTypeInProductSchema>

/** GET /api/v1/pesticides/products/{slug} の詳細 */
export const pesticideDetailSchema = pesticideItemSchema.extend({
  formulationType: pesticideFormulationTypeSchema.nullable(),
  activeIngredients: z.array(pesticideActiveIngredientItemSchema),
  effects: z.array(pesticideEffectItemSchema),
  incompatibilities: z.array(pesticideIncompatibilityItemSchema),
  spreaderTypes: z.array(spreaderTypeInProductSchema),
})
export type PesticideDetail = z.infer<typeof pesticideDetailSchema>

/** GET /api/v1/pesticides/products 200 */
export const pesticideListResponseSchema = z.object({
  items: z.array(pesticideItemSchema),
  nextCursor: z.string().nullable(),
})
export type PesticideListResponse = z.infer<typeof pesticideListResponseSchema>

// ── 有効成分 ──────────────────────────────────────

/** GET /api/v1/pesticides/ingredients の 1 件 */
export const ingredientItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameEn: z.string().nullable(),
  fracCode: z.string().nullable(),
  iracCode: z.string().nullable(),
  resistanceRisk: resistanceRiskSchema.nullable(),
  slug: z.string(),
})
export type IngredientItem = z.infer<typeof ingredientItemSchema>

/** 有効成分詳細の農薬 1 件 */
export const ingredientPesticideItemSchema = z.object({
  contentLabel: z.string().nullable(),
  pesticide: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    formulationTypeName: z.string().nullable(),
  }),
})
export type IngredientPesticideItem = z.infer<typeof ingredientPesticideItemSchema>

/** GET /api/v1/pesticides/ingredients/{slug} の詳細 */
export const ingredientDetailSchema = ingredientItemSchema.extend({
  ingredientGroup: z.string().nullable(),
  description: z.string().nullable(),
  pesticides: z.array(ingredientPesticideItemSchema),
})
export type IngredientDetail = z.infer<typeof ingredientDetailSchema>

/** GET /api/v1/pesticides/ingredients 200 */
export const ingredientListResponseSchema = z.object({
  items: z.array(ingredientItemSchema),
  nextCursor: z.string().nullable(),
})
export type IngredientListResponse = z.infer<typeof ingredientListResponseSchema>

// ── 展着剤 ──────────────────────────────────────────

/** 展着剤タイプ内の製品 1 件（P-1 / P-2 products 配列要素） */
export const spreaderProductInSpreaderTypeSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  formulationType: pesticideFormulationTypeSchema.nullable(),
})
export type SpreaderProductInSpreaderType = z.infer<typeof spreaderProductInSpreaderTypeSchema>

/** GET /api/v1/pesticides/spreaders の 1 件 */
export const spreaderTypeItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  products: z.array(spreaderProductInSpreaderTypeSchema),
})
export type SpreaderTypeItem = z.infer<typeof spreaderTypeItemSchema>

/** GET /api/v1/pesticides/spreaders/{slug} の詳細 */
export const spreaderTypeDetailSchema = spreaderTypeItemSchema.extend({
  effect: z.string().nullable(),
  usageNote: z.string().nullable(),
})
export type SpreaderTypeDetail = z.infer<typeof spreaderTypeDetailSchema>

/** GET /api/v1/pesticides/spreaders 200 */
export const spreaderTypeListResponseSchema = z.object({
  items: z.array(spreaderTypeItemSchema),
})
export type SpreaderTypeListResponse = z.infer<typeof spreaderTypeListResponseSchema>

/** GET /api/v1/pesticides/spreader-products の 1 件 */
export const spreaderProductItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  formulationType: pesticideFormulationTypeSchema.nullable(),
  registrationNumber: z.string().nullable(),
  spreaderTypes: z.array(spreaderTypeInProductSchema),
})
export type SpreaderProductItem = z.infer<typeof spreaderProductItemSchema>

/** GET /api/v1/pesticides/spreader-products 200 */
export const spreaderProductListResponseSchema = z.object({
  items: z.array(spreaderProductItemSchema),
  nextCursor: z.string().nullable(),
})
export type SpreaderProductListResponse = z.infer<typeof spreaderProductListResponseSchema>

// ── 農薬コラム ──────────────────────────────────────

/** GET /api/v1/pesticides/columns の 1 件 */
export const pesticideColumnItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  publishedAt: z.string().datetime(),
  sortOrder: z.number().int(),
})
export type PesticideColumnItem = z.infer<typeof pesticideColumnItemSchema>

/** GET /api/v1/pesticides/columns/{slug} の詳細 */
export const pesticideColumnDetailSchema = pesticideColumnItemSchema.extend({
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type PesticideColumnDetail = z.infer<typeof pesticideColumnDetailSchema>

/** GET /api/v1/pesticides/columns 200 */
export const pesticideColumnListResponseSchema = z.object({
  items: z.array(pesticideColumnItemSchema),
  nextCursor: z.string().nullable(),
})
export type PesticideColumnListResponse = z.infer<typeof pesticideColumnListResponseSchema>

// ── 剤型マスタ ──────────────────────────────────────

/** GET /api/v1/pesticides/formulations の 1 件 */
export const formulationTypeItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  pesticidesCount: z.number().int(),
})
export type FormulationTypeItem = z.infer<typeof formulationTypeItemSchema>

/** GET /api/v1/pesticides/formulations 200 */
export const formulationTypeListResponseSchema = z.object({
  items: z.array(formulationTypeItemSchema),
})
export type FormulationTypeListResponse = z.infer<typeof formulationTypeListResponseSchema>

// ── 混用チェッカー ──────────────────────────────────

/** GET /api/v1/pesticides/mixing-data の pesticides 配列要素 */
export const mixingDataPesticideItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  pesticideType: pesticideTypeSchema,
})
export type MixingDataPesticideItem = z.infer<typeof mixingDataPesticideItemSchema>

/** GET /api/v1/pesticides/mixing-data の incompatibilities 配列要素 */
export const mixingDataIncompatibilityItemSchema = z.object({
  pesticideId: z.string(),
  incompatibleWithId: z.string(),
})
export type MixingDataIncompatibilityItem = z.infer<typeof mixingDataIncompatibilityItemSchema>

/** GET /api/v1/pesticides/mixing-data 200 */
export const mixingDataResponseSchema = z.object({
  pesticides: z.array(mixingDataPesticideItemSchema),
  incompatibilities: z.array(mixingDataIncompatibilityItemSchema),
})
export type MixingDataResponse = z.infer<typeof mixingDataResponseSchema>

// ──────────────────────────────────────────────────
// §3.3 マイ盆栽 CRUD
// ──────────────────────────────────────────────────

/** GET /api/v1/bonsai の最新記録サムネイル（一覧用） */
export const bonsaiLatestRecordSchema = z.object({
  id: z.string(),
  content: z.string().nullable(),
  recordAt: z.string().datetime(),
  thumbnailUrl: z.string().nullable(),
})
export type BonsaiLatestRecord = z.infer<typeof bonsaiLatestRecordSchema>

/** GET /api/v1/bonsai の 1 件 */
export const bonsaiListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  species: z.string().nullable(),
  acquiredAt: z.string().datetime().nullable(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  recordCount: z.number().int(),
  latestRecord: bonsaiLatestRecordSchema.nullable(),
})
export type BonsaiListItem = z.infer<typeof bonsaiListItemSchema>

/** GET /api/v1/bonsai 200 */
export const bonsaiListResponseSchema = z.object({
  items: z.array(bonsaiListItemSchema),
  nextCursor: z.string().nullable(),
})
export type BonsaiListResponse = z.infer<typeof bonsaiListResponseSchema>

/** 盆栽詳細（POST 201 / GET 200 / PATCH 200 共用） */
export const bonsaiDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  species: z.string().nullable(),
  acquiredAt: z.string().datetime().nullable(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  recordCount: z.number().int(),
})
export type BonsaiDetail = z.infer<typeof bonsaiDetailSchema>

/** 成長記録画像 1 件 */
export const bonsaiRecordImageSchema = z.object({
  url: z.string(),
  sortOrder: z.number().int(),
})
export type BonsaiRecordImage = z.infer<typeof bonsaiRecordImageSchema>

/** 成長記録 1 件（POST 201 / GET 一覧 / PATCH 200 共用） */
export const bonsaiRecordItemSchema = z.object({
  id: z.string(),
  content: z.string().nullable(),
  recordAt: z.string().datetime(),
  images: z.array(bonsaiRecordImageSchema),
})
export type BonsaiRecordItem = z.infer<typeof bonsaiRecordItemSchema>

/** GET /api/v1/bonsai/{id}/records 200 */
export const bonsaiRecordListResponseSchema = z.object({
  items: z.array(bonsaiRecordItemSchema),
  nextCursor: z.string().nullable(),
})
export type BonsaiRecordListResponse = z.infer<typeof bonsaiRecordListResponseSchema>

// ──────────────────────────────────────────────────
// §3.5 イベント CRUD
// ──────────────────────────────────────────────────

/** イベント作成者の最小情報（nullable: 作成者不明の場合は null） */
export const eventCreatorSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
})
export type EventCreator = z.infer<typeof eventCreatorSchema>

/** イベント 1 件（一覧・詳細共用） */
export const eventItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().nullable(),
  prefecture: z.string().nullable(),
  city: z.string().nullable(),
  venue: z.string().nullable(),
  organizer: z.string().nullable(),
  admissionFee: z.string().nullable(),
  hasSales: z.boolean(),
  externalUrl: z.string().nullable(),
  creator: eventCreatorSchema.nullable(),
  createdAt: z.string().datetime(),
})
export type EventItem = z.infer<typeof eventItemSchema>

/** GET /api/v1/events 200 */
export const eventListResponseSchema = z.object({
  items: z.array(eventItemSchema),
  nextCursor: z.string().nullable(),
})
export type EventListResponse = z.infer<typeof eventListResponseSchema>

// ──────────────────────────────────────────────────
// §3.4 盆栽園マップ
// ──────────────────────────────────────────────────

/** 盆栽園ジャンル 1 件（id, name）*/
export const shopGenreItemSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type ShopGenreItem = z.infer<typeof shopGenreItemSchema>

/** 盆栽園 1 件（一覧・詳細共用） */
export const shopItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  businessHours: z.string().nullable(),
  closedDays: z.string().nullable(),
  genres: z.array(shopGenreItemSchema),
  averageRating: z.number().nullable(),
  reviewCount: z.number().int(),
  /** 閲覧者が作成者かどうか（ゲストまたは非作成者は false） */
  isOwner: z.boolean(),
})
export type ShopItem = z.infer<typeof shopItemSchema>

/** GET /api/v1/shops 200 */
export const shopListResponseSchema = z.object({
  items: z.array(shopItemSchema),
  nextCursor: z.string().nullable(),
})
export type ShopListResponse = z.infer<typeof shopListResponseSchema>

/** POST /api/v1/shops 201 */
export const shopCreatedResponseSchema = z.object({
  id: z.string(),
})
export type ShopCreatedResponse = z.infer<typeof shopCreatedResponseSchema>

/** GET /api/v1/shops/map-pins の 1 件（地図マーカー用の軽量表現） */
export const shopMapPinItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  address: z.string(),
  averageRating: z.number().nullable(),
  reviewCount: z.number().int(),
})
export type ShopMapPinItem = z.infer<typeof shopMapPinItemSchema>

/** GET /api/v1/shops/map-pins 200（全件・ページネーションなし） */
export const shopMapPinsResponseSchema = z.object({
  items: z.array(shopMapPinItemSchema),
})
export type ShopMapPinsResponse = z.infer<typeof shopMapPinsResponseSchema>

/** レビュー画像 1 件 */
export const reviewImageSchema = z.object({
  url: z.string(),
})
export type ReviewImage = z.infer<typeof reviewImageSchema>

/** レビュー投稿者の最小情報 */
export const reviewUserSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
})
export type ReviewUser = z.infer<typeof reviewUserSchema>

/** レビュー 1 件 */
export const reviewItemSchema = z.object({
  id: z.string(),
  rating: z.number().int(),
  content: z.string().nullable(),
  images: z.array(reviewImageSchema),
  user: reviewUserSchema,
  createdAt: z.string().datetime(),
})
export type ReviewItem = z.infer<typeof reviewItemSchema>

/** GET /api/v1/shops/{id}/reviews 200 */
export const reviewListResponseSchema = z.object({
  items: z.array(reviewItemSchema),
  nextCursor: z.string().nullable(),
})
export type ReviewListResponse = z.infer<typeof reviewListResponseSchema>

/** GET /api/v1/genres 200 */
export const genreListResponseSchema = z.object({
  items: z.array(shopGenreItemSchema),
})
export type GenreListResponse = z.infer<typeof genreListResponseSchema>

// ──────────────────────────────────────────────────
// §3.10 予約投稿 CRUD
// ──────────────────────────────────────────────────

import { SCHEDULED_POST_STATUS } from '@/lib/constants/status'

/**
 * ScheduledPostStatus enum（Prisma enum 値と一致）。
 * SCHEDULED_POST_STATUS 定数から全値を導出する。
 */
export const scheduledPostStatusSchema = z.enum(
  Object.values(SCHEDULED_POST_STATUS) as [string, ...string[]],
)
export type ScheduledPostStatusEnum = z.infer<typeof scheduledPostStatusSchema>

/** 予約投稿メディア 1 件 */
export const scheduledPostMediaItemSchema = z.object({
  url: z.string(),
  type: z.string(),
  sortOrder: z.number().int(),
})
export type ScheduledPostMediaItem = z.infer<typeof scheduledPostMediaItemSchema>

/** 予約投稿ジャンル 1 件 */
export const scheduledPostGenreItemSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type ScheduledPostGenreItem = z.infer<typeof scheduledPostGenreItemSchema>

/** 予約投稿 1 件（一覧・詳細共用） */
export const scheduledPostItemSchema = z.object({
  id: z.string(),
  content: z.string().nullable(),
  scheduledAt: z.string().datetime(),
  status: scheduledPostStatusSchema,
  media: z.array(scheduledPostMediaItemSchema),
  genres: z.array(scheduledPostGenreItemSchema),
  publishedPostId: z.string().nullable(),
  createdAt: z.string().datetime(),
})
export type ScheduledPostItem = z.infer<typeof scheduledPostItemSchema>

/** GET /api/v1/scheduled-posts 200 */
export const scheduledPostListResponseSchema = z.object({
  items: z.array(scheduledPostItemSchema),
  nextCursor: z.string().nullable(),
})
export type ScheduledPostListResponse = z.infer<typeof scheduledPostListResponseSchema>

/** POST /api/v1/scheduled-posts 201 */
export const scheduledPostCreatedResponseSchema = z.object({
  id: z.string(),
})
export type ScheduledPostCreatedResponse = z.infer<typeof scheduledPostCreatedResponseSchema>

// ──────────────────────────────────────────────────
// §3.12 法的文章（読み取り専用・ゲスト可）
// ──────────────────────────────────────────────────

/** 法的文章の 1 セクション */
export const legalSectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
})
export type LegalSection = z.infer<typeof legalSectionSchema>

/** GET /api/v1/legal/{slug} 200 — 法的文章詳細 */
export const legalDocumentSchema = z.object({
  slug: z.string(),
  title: z.string(),
  updatedAt: z.string(),
  sections: z.array(legalSectionSchema),
})
export type LegalDocumentResponse = z.infer<typeof legalDocumentSchema>

/** GET /api/v1/legal の 1 件 */
export const legalListItemSchema = z.object({
  slug: z.string(),
  title: z.string(),
  updatedAt: z.string(),
})
export type LegalListItem = z.infer<typeof legalListItemSchema>

/** GET /api/v1/legal 200 — 利用可能な法的文章一覧 */
export const legalListResponseSchema = z.object({
  items: z.array(legalListItemSchema),
})
export type LegalListResponse = z.infer<typeof legalListResponseSchema>

// ──────────────────────────────────────────────────
// §3.11 投稿分析サマリ（Bearer 必須・プレミアム限定・読み取り専用・自分のデータのみ）
// ──────────────────────────────────────────────────

/** 分析サマリの集計期間情報 */
export const analyticsPeriodSchema = z.object({
  /** 集計日数: 7 / 30 / 90 のいずれか */
  days: z.number().int(),
  /** 集計開始日（YYYY-MM-DD） */
  start: z.string(),
  /** 集計終了日（YYYY-MM-DD） */
  end: z.string(),
})
export type AnalyticsPeriodData = z.infer<typeof analyticsPeriodSchema>

/** 分析サマリのトップ投稿 1 件 */
export const analyticsTopPostSchema = z.object({
  id: z.string(),
  /** 本文の先頭 100 文字。メディアのみの投稿は null */
  content: z.string().nullable(),
  createdAt: z.string().datetime(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
})
export type AnalyticsTopPost = z.infer<typeof analyticsTopPostSchema>

/** 分析サマリの投稿統計 */
export const analyticsPostsSummarySchema = z.object({
  /** 期間内の総投稿数 */
  total: z.number().int(),
  /** 期間内に受け取ったいいね総数 */
  totalLikes: z.number().int(),
  /** 期間内に受け取ったコメント総数 */
  totalComments: z.number().int(),
  /** 1 投稿あたりの平均エンゲージメント（いいね + コメント）。小数第 1 位まで */
  avgEngagement: z.number(),
  /** エンゲージメント上位 5 件の投稿 */
  topPosts: z.array(analyticsTopPostSchema),
})
export type AnalyticsPostsSummary = z.infer<typeof analyticsPostsSummarySchema>

/** 分析サマリの日次エンゲージメント 1 件 */
export const analyticsDailyEngagementSchema = z.object({
  /** YYYY-MM-DD */
  date: z.string(),
  posts: z.number().int(),
  likes: z.number().int(),
  comments: z.number().int(),
  /** いいね + コメントの合計 */
  engagement: z.number().int(),
})
export type AnalyticsDailyEngagement = z.infer<typeof analyticsDailyEngagementSchema>

/** 分析サマリの日次フォロワー増減 1 件 */
export const analyticsFollowerGrowthEntrySchema = z.object({
  /** YYYY-MM-DD */
  date: z.string(),
  newFollowers: z.number().int(),
  totalFollowers: z.number().int(),
})
export type AnalyticsFollowerGrowthEntry = z.infer<typeof analyticsFollowerGrowthEntrySchema>

/** 分析サマリのフォロワー統計 */
export const analyticsFollowersSummarySchema = z.object({
  /** 現在のフォロワー総数 */
  current: z.number().int(),
  /** 期間内の新規フォロワー数 */
  newInPeriod: z.number().int(),
  /** 日次フォロワー推移 */
  growth: z.array(analyticsFollowerGrowthEntrySchema),
})
export type AnalyticsFollowersSummary = z.infer<typeof analyticsFollowersSummarySchema>

/** GET /api/v1/analytics/summary 200 */
export const analyticsSummaryResponseSchema = z.object({
  period: analyticsPeriodSchema,
  posts: analyticsPostsSummarySchema,
  followers: analyticsFollowersSummarySchema,
  /** 期間内の日次エンゲージメント推移 */
  engagementTrend: z.array(analyticsDailyEngagementSchema),
})
export type AnalyticsSummaryResponse = z.infer<typeof analyticsSummaryResponseSchema>

// ──────────────────────────────────────────────────
// §1.20 explore/posts — ハッシュタグ / ジャンル別投稿一覧
// ──────────────────────────────────────────────────

/** GET /api/v1/explore/posts 200 */
export const explorePostsResponseSchema = z.object({
  items: z.array(postSchema),
  nextCursor: z.string().nullable(),
})
export type ExplorePostsResponse = z.infer<typeof explorePostsResponseSchema>

// ──────────────────────────────────────────────────
// §1.20 盆栽手入れログ
// ──────────────────────────────────────────────────

import { BonsaiCareType } from '@prisma/client'

/**
 * BonsaiCareType enum（Prisma enum 値と一致）。
 * z.nativeEnum でなく z.enum を使うため実値配列を抽出する。
 */
export const bonsaiCareTypeSchema = z.nativeEnum(BonsaiCareType)
export type BonsaiCareTypeEnum = z.infer<typeof bonsaiCareTypeSchema>

/** 手入れログ 1 件 */
export const careLogItemSchema = z.object({
  id: z.string(),
  type: bonsaiCareTypeSchema,
  performedAt: z.string().datetime(),
  note: z.string().nullable(),
})
export type CareLogItem = z.infer<typeof careLogItemSchema>

/** 手入れログ作成成功レスポンス */
export const careLogCreatedResponseSchema = z.object({
  id: z.string(),
})
export type CareLogCreatedResponse = z.infer<typeof careLogCreatedResponseSchema>

/** GET /api/v1/bonsai/care-logs 200 */
export const careLogListResponseSchema = z.object({
  items: z.array(careLogItemSchema),
  nextCursor: z.string().nullable(),
})
export type CareLogListResponse = z.infer<typeof careLogListResponseSchema>

// ──────────────────────────────────────────────────
// §1.21 フォローリクエスト管理 + 通知設定
// ──────────────────────────────────────────────────

/** フォローリクエスト 1 件の送信者情報 */
export const followRequestRequesterSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
})
export type FollowRequestRequester = z.infer<typeof followRequestRequesterSchema>

/** GET /api/v1/users/me/follow-requests の 1 件 */
export const followRequestItemSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  requester: followRequestRequesterSchema,
})
export type FollowRequestItem = z.infer<typeof followRequestItemSchema>

/** GET /api/v1/users/me/follow-requests 200 */
export const followRequestsListResponseSchema = z.object({
  requests: z.array(followRequestItemSchema),
  nextCursor: z.string().nullable(),
})
export type FollowRequestsListResponse = z.infer<typeof followRequestsListResponseSchema>

/**
 * GET /api/v1/users/me/notification-settings の設定オブジェクト。
 *
 * 全キーは optional（未設定 = default true の意味）。
 * system / subscription_expiring はユーザーが変更できないため含まない（Web 側と一致）。
 */
export const notificationPreferencesResponseSchema = z.object({
  like: z.boolean().optional(),
  comment: z.boolean().optional(),
  reply: z.boolean().optional(),
  comment_like: z.boolean().optional(),
  follow: z.boolean().optional(),
  quote: z.boolean().optional(),
  follow_request: z.boolean().optional(),
  follow_request_approved: z.boolean().optional(),
  mention: z.boolean().optional(),
  message: z.boolean().optional(),
  repost: z.boolean().optional(),
})
export type NotificationPreferencesResponse = z.infer<typeof notificationPreferencesResponseSchema>

/** GET /api/v1/users/me/notification-settings 200 */
export const notificationSettingsResponseSchema = z.object({
  preferences: notificationPreferencesResponseSchema,
})
export type NotificationSettingsResponse = z.infer<typeof notificationSettingsResponseSchema>

// ──────────────────────────────────────────────────
// §A-1 ユーザー投稿一覧
// ──────────────────────────────────────────────────

/** GET /api/v1/users/{id}/posts 200 */
export const userPostsResponseSchema = z.object({
  items: z.array(postSchema),
  nextCursor: z.string().nullable(),
})
export type UserPostsResponse = z.infer<typeof userPostsResponseSchema>

// ──────────────────────────────────────────────────
// §B-1 リポスト
// ──────────────────────────────────────────────────

/** POST /api/v1/posts/{id}/repost 200 / DELETE /api/v1/posts/{id}/repost 200 */
export const repostResponseSchema = z.object({
  reposted: z.boolean(),
  repostCount: z.number().int(),
})
export type RepostResponse = z.infer<typeof repostResponseSchema>

// ──────────────────────────────────────────────────
// §B-3 アンケート（ポール）
// ──────────────────────────────────────────────────

/** アンケート選択肢（投票後レスポンス用） */
export const pollOptionResponseSchema = z.object({
  id: z.string(),
  text: z.string(),
  voteCount: z.number().int(),
  /** 全票に占める割合（0〜100、小数第1位まで）。totalVotes が 0 なら 0 */
  percentage: z.number(),
})
export type PollOptionResponse = z.infer<typeof pollOptionResponseSchema>

/** POST /api/v1/polls/{id}/vote 200 */
export const pollVoteResponseSchema = z.object({
  id: z.string(),
  expiresAt: z.string().datetime(),
  isExpired: z.boolean(),
  totalVotes: z.number().int(),
  userVoteOptionId: z.string().nullable(),
  options: z.array(pollOptionResponseSchema),
})
export type PollVoteResponse = z.infer<typeof pollVoteResponseSchema>

// ──────────────────────────────────────────────────
// §D — 分析拡張エンドポイント（Wave 3 領域 D）
// Bearer 必須・プレミアム限定・自分のデータのみ
// 実形はそれぞれ lib/services/analytics-service.ts の各関数の戻り値に厳密に一致させる。
// ──────────────────────────────────────────────────

/** 日次カウント 1 件（いいね日次分布など date + count 形式） */
export const analyticsDailyCountSchema = z.object({
  /** YYYY-MM-DD */
  date: z.string(),
  count: z.number().int(),
})
export type AnalyticsDailyCount = z.infer<typeof analyticsDailyCountSchema>

/**
 * GET /api/v1/analytics/posts 200
 *
 * fetchPostAnalytics の戻り値に一致。topPosts / posts は同形
 * （analyticsTopPostSchema を共用）。
 */
export const analyticsPostsResponseSchema = z.object({
  /** 期間内の総投稿数 */
  totalPosts: z.number().int(),
  /** 期間内に受け取ったいいね総数 */
  totalLikes: z.number().int(),
  /** 期間内に受け取ったコメント総数 */
  totalComments: z.number().int(),
  /** 1 投稿あたりの平均エンゲージメント（小数第 1 位まで） */
  avgEngagement: z.number(),
  /** エンゲージメント上位 5 件の投稿 */
  topPosts: z.array(analyticsTopPostSchema),
  /** 期間内の全投稿（作成日降順） */
  posts: z.array(analyticsTopPostSchema),
})
export type AnalyticsPostsResponse = z.infer<typeof analyticsPostsResponseSchema>

/**
 * GET /api/v1/analytics/likes 200
 *
 * fetchLikeAnalytics の戻り値に一致。
 * hourlyData: 24 要素の配列（インデックス = 時刻）。
 * weekdayData: 7 要素の配列（インデックス = 曜日, 0=日〜6=土）。
 */
export const analyticsLikesResponseSchema = z.object({
  totalLikes: z.number().int(),
  /** 時間帯別いいね数（0〜23 時）。24 要素固定 */
  hourlyData: z.array(z.number().int()),
  /** 曜日別いいね数（0=日〜6=土）。7 要素固定 */
  weekdayData: z.array(z.number().int()),
  /** 日次いいね数（YYYY-MM-DD 昇順） */
  dailyData: z.array(analyticsDailyCountSchema),
  /** いいねが最も多い時間帯（0〜23） */
  peakHour: z.number().int(),
  /** いいねが最も多い曜日（0=日〜6=土） */
  peakWeekday: z.number().int(),
})
export type AnalyticsLikesResponse = z.infer<typeof analyticsLikesResponseSchema>

/** GET /api/v1/analytics/quotes の引用投稿 1 件 */
export const analyticsQuoteItemSchema = z.object({
  id: z.string(),
  /** 引用投稿本文の先頭 200 文字。メディアのみの場合は null */
  content: z.string().nullable(),
  /** 引用した著者（USER_MINIMAL_SELECT と同形） */
  user: postAuthorSchema,
  /** 引用元の投稿 ID。元投稿が削除済みの場合は null */
  originalPostId: z.string().nullable(),
  /** 引用元本文の先頭 100 文字 */
  originalContent: z.string().nullable(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  createdAt: z.string().datetime(),
})
export type AnalyticsQuoteItem = z.infer<typeof analyticsQuoteItemSchema>

/**
 * GET /api/v1/analytics/quotes 200
 *
 * fetchQuoteAnalytics の戻り値に一致。days パラメータ不要。
 */
export const analyticsQuotesResponseSchema = z.object({
  /** 自分の投稿を引用した件数 */
  totalQuotes: z.number().int(),
  /** 自分の投稿をリポストした件数 */
  totalReposts: z.number().int(),
  /** 最新の引用投稿一覧（最大 ANALYTICS_POSTS_LIMIT = 50 件） */
  quotes: z.array(analyticsQuoteItemSchema),
})
export type AnalyticsQuotesResponse = z.infer<typeof analyticsQuotesResponseSchema>

/** GET /api/v1/analytics/keywords のキーワード 1 件 */
export const analyticsKeywordItemSchema = z.object({
  word: z.string(),
  count: z.number().int(),
})
export type AnalyticsKeywordItem = z.infer<typeof analyticsKeywordItemSchema>

/**
 * GET /api/v1/analytics/keywords 200
 *
 * fetchKeywordAnalytics の戻り値に一致。
 */
export const analyticsKeywordsResponseSchema = z.object({
  /** 出現頻度上位のキーワード（最大 TOP_KEYWORDS_LIMIT = 30 件、頻度降順） */
  keywords: z.array(analyticsKeywordItemSchema),
  /** 期間内の投稿に登場した単語の総出現数 */
  totalWords: z.number().int(),
  /** 期間内の投稿に登場したユニーク単語数 */
  uniqueWords: z.number().int(),
})
export type AnalyticsKeywordsResponse = z.infer<typeof analyticsKeywordsResponseSchema>

/**
 * GET /api/v1/analytics/engagement-trend 200
 *
 * fetchEngagementTrend の戻り値に一致。
 * trend 各要素は analyticsDailyEngagementSchema（{ date, posts, likes, comments, engagement }）を共用。
 */
export const analyticsEngagementTrendResponseSchema = z.object({
  /** 日次エンゲージメント推移（days 日分、YYYY-MM-DD 昇順） */
  trend: z.array(analyticsDailyEngagementSchema),
})
export type AnalyticsEngagementTrendResponse = z.infer<typeof analyticsEngagementTrendResponseSchema>

/**
 * GET /api/v1/analytics/genre-performance のジャンル 1 件
 *
 * fetchGenrePerformance は genreId を返さない（name のみ）。
 * handoff 目安との差異: genreId フィールドは存在しない。
 */
export const analyticsGenreItemSchema = z.object({
  name: z.string(),
  postCount: z.number().int(),
  /** 1 投稿あたりの平均いいね数（小数第 1 位まで） */
  avgLikes: z.number(),
  /** 1 投稿あたりの平均コメント数（小数第 1 位まで） */
  avgComments: z.number(),
  /** 1 投稿あたりの平均エンゲージメント（小数第 1 位まで） */
  avgEngagement: z.number(),
})
export type AnalyticsGenreItem = z.infer<typeof analyticsGenreItemSchema>

/**
 * GET /api/v1/analytics/genre-performance 200
 *
 * fetchGenrePerformance の戻り値に一致（avgEngagement 降順、最大 GENRE_PERFORMANCE_LIMIT = 10 件）。
 */
export const analyticsGenrePerformanceResponseSchema = z.object({
  genres: z.array(analyticsGenreItemSchema),
})
export type AnalyticsGenrePerformanceResponse = z.infer<typeof analyticsGenrePerformanceResponseSchema>

/**
 * GET /api/v1/analytics/follower-growth 200
 *
 * fetchFollowerGrowth の戻り値に一致。
 * growth 各要素は analyticsFollowerGrowthEntrySchema を共用。
 * handoff 目安との差異: フィールド名が currentFollowers / totalNewInPeriod（camelCase）。
 */
export const analyticsFollowerGrowthResponseSchema = z.object({
  /** 現在のフォロワー総数 */
  currentFollowers: z.number().int(),
  /** 集計期間内の新規フォロワー数 */
  totalNewInPeriod: z.number().int(),
  /** 日次フォロワー推移（days 日分、YYYY-MM-DD 昇順） */
  growth: z.array(analyticsFollowerGrowthEntrySchema),
})
export type AnalyticsFollowerGrowthResponse = z.infer<typeof analyticsFollowerGrowthResponseSchema>

/**
 * GET /api/v1/analytics/period-comparison の単一指標
 *
 * change は前期比の変化率（%整数）。前期が 0 かつ現期が 0 の場合のみ null。
 */
export const analyticsPeriodMetricSchema = z.object({
  current: z.number().int(),
  previous: z.number().int(),
  /** 前期比変化率（%整数）。前期 0 かつ現期 0 の場合は null */
  change: z.number().int().nullable(),
})
export type AnalyticsPeriodMetric = z.infer<typeof analyticsPeriodMetricSchema>

/**
 * GET /api/v1/analytics/period-comparison 200
 *
 * fetchPeriodComparison の戻り値に一致。
 * handoff 目安との差異: { current, previous, ratios } ではなく
 * { posts, likes, comments, followers } それぞれに { current, previous, change } を持つ。
 */
export const analyticsPeriodComparisonResponseSchema = z.object({
  posts: analyticsPeriodMetricSchema,
  likes: analyticsPeriodMetricSchema,
  comments: analyticsPeriodMetricSchema,
  followers: analyticsPeriodMetricSchema,
})
export type AnalyticsPeriodComparisonResponse = z.infer<typeof analyticsPeriodComparisonResponseSchema>

// ──────────────────────────────────────────────────
// Wave 4 領域 F — ダイレクトメッセージ (DM)
// ──────────────────────────────────────────────────

/**
 * 会話一覧の最終メッセージサマリ。
 * senderId を含めることでクライアントが「自分が最後に送ったか」を判定できる。
 */
export const dmLastMessageSchema = z.object({
  id: z.string(),
  content: z.string(),
  senderId: z.string(),
  createdAt: z.string().datetime(),
})
export type DmLastMessage = z.infer<typeof dmLastMessageSchema>

/**
 * 会話一覧の 1 件。
 * otherUser は postAuthorSchema（id / nickname / avatarUrl）を再利用。
 */
export const conversationItemSchema = z.object({
  id: z.string(),
  updatedAt: z.string().datetime(),
  otherUser: postAuthorSchema.nullable(),
  lastMessage: dmLastMessageSchema.nullable(),
  hasUnread: z.boolean(),
})
export type ConversationItem = z.infer<typeof conversationItemSchema>

/** GET /api/v1/messages/conversations 200 */
export const conversationListResponseSchema = z.object({
  items: z.array(conversationItemSchema),
  nextCursor: z.string().nullable(),
})
export type ConversationListResponse = z.infer<typeof conversationListResponseSchema>

/** POST /api/v1/messages/conversations 200 — 会話取得/作成成功 */
export const startConversationResponseSchema = z.object({
  conversationId: z.string(),
})
export type StartConversationResponse = z.infer<typeof startConversationResponseSchema>

/**
 * メッセージ 1 件。
 * sender は postAuthorSchema（id / nickname / avatarUrl）を再利用。
 */
export const messageItemSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  content: z.string(),
  senderId: z.string(),
  sender: postAuthorSchema,
  createdAt: z.string().datetime(),
})
export type MessageItem = z.infer<typeof messageItemSchema>

/**
 * GET /api/v1/messages/conversations/{id}/messages 200
 *
 * items は createdAt 昇順（古い→新しい）。
 * nextCursor は最古メッセージの id で、次回呼び出しでより古いメッセージを取得できる。
 * ポーリング前提: GET するたびに既読時刻が更新される。
 */
export const messageListResponseSchema = z.object({
  items: z.array(messageItemSchema),
  nextCursor: z.string().nullable(),
})
export type MessageListResponse = z.infer<typeof messageListResponseSchema>

// ──────────────────────────────────────────────────
// エラーレスポンス（全エンドポイント共通）
// ──────────────────────────────────────────────────

/**
 * エラーコード enum。MOBILE_API_ERROR_CODES の全値（18 コード）を網羅する。
 * モバイル側がこの enum からコード→メッセージ対応表を導出できるようにする。
 */
export const mobileApiErrorCodeSchema = z.enum(
  Object.values(MOBILE_API_ERROR_CODES) as [string, ...string[]],
)
export type MobileApiErrorCodeEnum = z.infer<typeof mobileApiErrorCodeSchema>

/** 全エンドポイント共通エラーレスポンス本体 */
export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: mobileApiErrorCodeSchema,
    message: z.string(),
    status: z.number().int(),
  }),
})
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>
