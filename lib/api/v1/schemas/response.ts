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
  poll: z.unknown().nullable(),
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

/** GET /api/v1/dictionary の 1 件（一覧は description 省略） */
export const dictionaryTermSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  term: z.string(),
  reading: z.string(),
  category: z.string(),
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
})
export type FertilizationMonth = z.infer<typeof fertilizationMonthSchema>

/** GET /api/v1/fertilizers/tree-species/{slug}/schedule 200 */
export const fertilizationScheduleResponseSchema = z.object({
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

/** GET /api/v1/hormones/{slug} の詳細 */
export const hormoneDetailSchema = hormoneItemSchema.extend({
  bonsaiRole: z.string().nullable(),
  productionSite: z.string().nullable(),
  practicalTips: z.string().nullable(),
  activationMethod: z.string().nullable(),
  effects: z.array(hormoneEffectSchema),
  seasonalLevels: z.array(hormoneSeasonalLevelSchema),
})
export type HormoneDetail = z.infer<typeof hormoneDetailSchema>

// ── ホルモン enum 契約 ──────────────────────────────

/** HormoneCategory enum（Prisma enum 値と一致） */
export const hormoneCategorySchema = z.enum(['major', 'secondary'])
export type HormoneCategoryEnum = z.infer<typeof hormoneCategorySchema>

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
})
export type DiseasePestItem = z.infer<typeof diseasePestItemSchema>

/** GET /api/v1/pesticides/disease-pests の効果 1 件 */
export const diseasePestEffectItemSchema = z.object({
  pesticide: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    pesticideType: pesticideTypeSchema,
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

/** GET /api/v1/pesticides/products/{slug} の詳細 */
export const pesticideDetailSchema = pesticideItemSchema.extend({
  formulationType: pesticideFormulationTypeSchema.nullable(),
  activeIngredients: z.array(pesticideActiveIngredientItemSchema),
  effects: z.array(pesticideEffectItemSchema),
  incompatibilities: z.array(pesticideIncompatibilityItemSchema),
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
