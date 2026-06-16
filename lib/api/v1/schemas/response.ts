/**
 * @module lib/api/v1/schemas/response
 * モバイル API v1 レスポンスボディの Zod スキーマ。
 *
 * route handler の実戻り値と OpenAPI ジェネレータの双方が同一スキーマを参照する。
 * エラーコード enum は MOBILE_API_ERROR_CODES から全値を z.enum 化する。
 */

import { z } from 'zod'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'

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
