/**
 * @module lib/api/v1/schemas/request
 * モバイル API v1 リクエストボディの Zod スキーマ。
 *
 * route handler と generate-openapi.ts の双方が同一スキーマを import する。
 * スキーマ定義のみ。バリデーションロジックは各 route handler が担う。
 */

import { z } from 'zod'
import { normalizedEmailSchema } from '@/lib/actions/schemas/common'
import { passwordSchema } from '@/lib/validations/password'
import {
  TWO_FACTOR_CODE_LENGTH,
  MIN_TOKEN_LENGTH,
  MAX_NICKNAME_LENGTH,
} from '@/lib/constants/limits'
import {
  ERR_NICKNAME_REQUIRED,
  ERR_NICKNAME_TOO_LONG,
  ERR_NICKNAME_INVALID_CHARS,
} from '@/lib/constants/errors/content'

/** POST /api/v1/auth/login */
export const loginRequestSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(1),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

/** POST /api/v1/auth/2fa/verify */
export const verify2FARequestSchema = z.object({
  ticket: z.string().min(1),
  code: z.string().min(TWO_FACTOR_CODE_LENGTH),
})
export type Verify2FARequest = z.infer<typeof verify2FARequestSchema>

/** POST /api/v1/auth/refresh */
export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
})
export type RefreshRequest = z.infer<typeof refreshRequestSchema>

/** POST /api/v1/auth/logout */
export const logoutRequestSchema = z.object({
  refreshToken: z.string().min(1),
})
export type LogoutRequest = z.infer<typeof logoutRequestSchema>

/** POST /api/v1/auth/google */
export const googleRequestSchema = z.object({
  idToken: z.string().min(1),
})
export type GoogleRequest = z.infer<typeof googleRequestSchema>

/** POST /api/v1/auth/password-reset/request */
export const passwordResetRequestSchema = z.object({
  email: normalizedEmailSchema,
})
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>

/** POST /api/v1/auth/password-reset/confirm */
export const passwordResetConfirmSchema = z.object({
  email: normalizedEmailSchema,
  token: z.string().min(MIN_TOKEN_LENGTH),
  newPassword: passwordSchema,
})
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>

/**
 * POST /api/v1/auth/register
 *
 * nickname の検証は Web の registerUserSchema と完全に一致させる（差異があると
 * モバイル側事前検証を通過したのにサーバーで弾かれるという UX 劣化が起きる）。
 * termsAccepted は z.literal(true) で同意必須を強制する。
 */
export const registerRequestSchema = z.object({
  nickname: z
    .string()
    .min(1, ERR_NICKNAME_REQUIRED)
    .max(MAX_NICKNAME_LENGTH, ERR_NICKNAME_TOO_LONG(MAX_NICKNAME_LENGTH))
    .refine((v) => !/[\r\n<>]/.test(v), ERR_NICKNAME_INVALID_CHARS),
  email: normalizedEmailSchema,
  password: passwordSchema,
  termsAccepted: z.literal(true),
})
export type RegisterRequest = z.infer<typeof registerRequestSchema>

// ──────────────────────────────────────────────────
// Phase 2 Batch 2a — 読み取り系エンドポイントのクエリパラメータ
// ──────────────────────────────────────────────────

import { MAX_SEARCH_QUERY_LENGTH } from '@/lib/constants/limits'
import { paginationSchema } from '@/lib/actions/schemas/common'

/** GET /api/v1/feed / notifications / posts/[id]/comments などのページネーションクエリ */
export const readPaginationQuerySchema = paginationSchema

/** GET /api/v1/search/posts および /api/v1/search/users の検索クエリパラメータ */
export const searchQuerySchema = paginationSchema.extend({
  q: z.string().max(MAX_SEARCH_QUERY_LENGTH).optional().default(''),
})
export type SearchQuery = z.infer<typeof searchQuerySchema>

// ──────────────────────────────────────────────────
// Phase 2 Batch 2b — 通報・ブロック・ミュート
// ──────────────────────────────────────────────────

import {
  REPORT_TARGET_TYPES,
  REPORT_REASON_VALUES,
  REPORT_DESCRIPTION_MAX_LENGTH,
} from '@/lib/constants/report'

/**
 * POST /api/v1/reports
 *
 * targetType / reason は定数 enum から取る（値の直書き禁止）。
 * targetId は cuid 相当の長さ制限（Web の createReportSchema と一致）。
 * description は trim 済み optional。
 */
export const createReportRequestSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().min(1).max(64),
  reason: z.enum(REPORT_REASON_VALUES),
  description: z.string().trim().max(REPORT_DESCRIPTION_MAX_LENGTH).optional(),
})
export type CreateReportRequest = z.infer<typeof createReportRequestSchema>

// ──────────────────────────────────────────────────
// Phase 2 Batch 2c — 投稿 CRUD + コメント作成/削除
// ──────────────────────────────────────────────────

import {
  MAX_GENRES_PER_POST,
  MAX_COMMENT_LENGTH,
} from '@/lib/constants/limits'

/**
 * POST /api/v1/posts
 *
 * content / genreIds / mediaUrls / mediaTypes を受ける。
 * bonsai 紐付け・poll はモバイル MVP 対象外のため本バッチでは含まない。
 * mediaUrls の URL 検証は Web の createPost と同等（文字列存在チェックのみ）。
 */
export const createPostRequestSchema = z.object({
  content: z.string().optional().default(''),
  genreIds: z.array(z.string()).max(MAX_GENRES_PER_POST).default([]),
  mediaUrls: z.array(z.string()).default([]),
  mediaTypes: z.array(z.enum(['image', 'video'])).default([]),
})
export type CreatePostRequest = z.infer<typeof createPostRequestSchema>

/**
 * PATCH /api/v1/posts/{id}
 *
 * 部分更新形式だが、ジャンル・メディアは差し替え方式（省略時は空として扱う）。
 * content を省略した場合はデフォルト '' として処理される（mediaUrls のみでも可）。
 */
export const updatePostRequestSchema = z.object({
  content: z.string().optional().default(''),
  genreIds: z.array(z.string()).max(MAX_GENRES_PER_POST).default([]),
  mediaUrls: z.array(z.string()).default([]),
  mediaTypes: z.array(z.enum(['image', 'video'])).default([]),
})
export type UpdatePostRequest = z.infer<typeof updatePostRequestSchema>

/**
 * POST /api/v1/posts/{id}/comments
 *
 * postId は path から取得。parentId は返信の場合のみ指定。
 * 本文長は MAX_COMMENT_LENGTH（500 文字）で制限する。
 */
export const createCommentRequestSchema = z.object({
  content: z.string().max(MAX_COMMENT_LENGTH).optional().default(''),
  parentId: z.string().min(1).nullable().optional(),
  mediaUrls: z.array(z.string()).default([]),
  mediaTypes: z.array(z.enum(['image', 'video'])).default([]),
})
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>

// ──────────────────────────────────────────────────
// Phase 2 Batch 2c-upload — メディアアップロード
// ──────────────────────────────────────────────────

import {
  ALLOWED_UPLOAD_VIDEO_TYPES,
  ALLOWED_UPLOAD_FOLDERS,
  MAX_VIDEO_SIZE,
} from '@/lib/constants/limits'

/**
 * POST /api/v1/upload/presigned
 *
 * Bearer 認証済みユーザー向けの動画 presigned PUT URL 生成。
 * 既存の /api/upload/presigned （Cookie 認証版）の Bearer 版で、動作は同等。
 * 動画アップロードはプレミアム会員限定。
 */
export const presignedUploadRequestSchema = z.object({
  contentType: z.enum(ALLOWED_UPLOAD_VIDEO_TYPES),
  fileSize: z.number().int().positive().max(MAX_VIDEO_SIZE),
  folder: z.enum(ALLOWED_UPLOAD_FOLDERS).default('post-videos'),
})
export type PresignedUploadRequest = z.infer<typeof presignedUploadRequestSchema>
