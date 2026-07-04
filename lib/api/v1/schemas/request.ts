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

/**
 * POST /api/v1/auth/2fa/enable
 *
 * setupId は GET /api/v1/auth/2fa/setup で発行された Redis 上の一時セットアップ情報を
 * 参照するために必須（TOTP シークレットを再送させない設計上、必ず両方を送る）。
 */
export const twoFactorEnableRequestSchema = z.object({
  code: z.string().min(TWO_FACTOR_CODE_LENGTH),
  setupId: z.string().min(1),
})
export type TwoFactorEnableRequest = z.infer<typeof twoFactorEnableRequestSchema>

/**
 * DELETE /api/v1/auth/2fa/disable
 *
 * Web の disable2FA と同じくパスワード確認を要求する（TOTP コードではない）。
 */
export const twoFactorDisableRequestSchema = z.object({
  password: z.string().min(1),
})
export type TwoFactorDisableRequest = z.infer<typeof twoFactorDisableRequestSchema>

/**
 * POST /api/v1/auth/password/change
 *
 * ログイン中ユーザーのパスワード変更。現パスワード確認必須（Web の changePassword と同一仕様）。
 * newPassword の強度検証は登録時と同一の passwordSchema を流用する。
 */
export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>

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

/** POST /api/v1/auth/verify-email/resend */
export const verifyEmailResendRequestSchema = z.object({
  email: normalizedEmailSchema,
})
export type VerifyEmailResendRequest = z.infer<typeof verifyEmailResendRequestSchema>

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

/** GET /api/v1/search/posts の mediaType 値（v1 API 表現）。サービス層の SearchMediaType とは異なる。 */
export const SEARCH_POST_MEDIA_TYPE_VALUES = ['image', 'video', 'none'] as const
export type SearchPostMediaTypeValue = (typeof SEARCH_POST_MEDIA_TYPE_VALUES)[number]

/** GET /api/v1/search/posts — 投稿専用の追加フィルタを含む検索クエリパラメータ */
export const searchPostsQuerySchema = searchQuerySchema.extend({
  genreId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  minLikes: z.coerce.number().int().min(0).optional(),
  mediaType: z.enum(SEARCH_POST_MEDIA_TYPE_VALUES).optional(),
})
export type SearchPostsQuery = z.infer<typeof searchPostsQuerySchema>

/** GET /api/v1/search/hashtags のクエリパラメータ */
export const searchHashtagsQuerySchema = z.object({
  q: z.string().max(MAX_HASHTAG_QUERY_LENGTH).optional().default(''),
  limit: z.coerce.number().int().min(1).max(MAX_HASHTAG_LIMIT).optional(),
})
export type SearchHashtagsQuery = z.infer<typeof searchHashtagsQuerySchema>

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

import {
  MIN_POLL_OPTIONS,
  MAX_POLL_OPTIONS,
  MAX_POLL_OPTION_LENGTH,
  VALID_POLL_DURATIONS,
  DEFAULT_POLL_DURATION_SECONDS,
} from '@/lib/constants/limits'

/**
 * POST /api/v1/posts
 *
 * content / genreIds / mediaUrls / mediaTypes を受ける。
 * poll を省略するとアンケートなし投稿になる。
 * mediaUrls の URL 検証は Web の createPost と同等（文字列存在チェックのみ）。
 */
export const createPostRequestSchema = z.object({
  content: z.string().optional().default(''),
  genreIds: z.array(z.string()).max(MAX_GENRES_PER_POST).default([]),
  mediaUrls: z.array(z.string()).default([]),
  mediaTypes: z.array(z.enum(['image', 'video'])).default([]),
  poll: z
    .object({
      options: z.array(z.string().min(1).max(MAX_POLL_OPTION_LENGTH)).min(MIN_POLL_OPTIONS).max(MAX_POLL_OPTIONS),
      durationSeconds: z
        .number()
        .int()
        .refine((v) => (VALID_POLL_DURATIONS as readonly number[]).includes(v))
        .optional()
        .default(DEFAULT_POLL_DURATION_SECONDS),
    })
    .optional(),
})
export type CreatePostRequest = z.infer<typeof createPostRequestSchema>

/**
 * POST /api/v1/posts/{id}/quote
 *
 * 引用元投稿のコンテンツ。content は必須（空文字は 400）。
 * genreIds / mediaUrls / mediaTypes は POST /api/v1/posts と同形。
 */
export const createQuoteRequestSchema = z.object({
  content: z.string().optional().default(''),
  genreIds: z.array(z.string()).max(MAX_GENRES_PER_POST).default([]),
  mediaUrls: z.array(z.string()).default([]),
  mediaTypes: z.array(z.enum(['image', 'video'])).default([]),
})
export type CreateQuoteRequest = z.infer<typeof createQuoteRequestSchema>

/**
 * POST /api/v1/polls/{id}/vote
 *
 * optionId: 投票する選択肢の ID。
 */
export const pollVoteRequestSchema = z.object({
  optionId: z.string().min(1),
})
export type PollVoteRequest = z.infer<typeof pollVoteRequestSchema>

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
// Batch 2d — プロフィール編集・アカウント削除
// ──────────────────────────────────────────────────

import {
  MAX_BIO_LENGTH,
  MAX_LOCATION_LENGTH,
  BONSAI_START_MIN_YEAR,
} from '@/lib/constants/limits'
import {
  ERR_BIO_TOO_LONG,
  ERR_LOCATION_TOO_LONG,
  ERR_BONSAI_START_YEAR_INVALID,
  ERR_BONSAI_START_MONTH_INVALID,
  ERR_BIRTH_DATE_INVALID,
} from '@/lib/constants/errors'

/**
 * PATCH /api/v1/users/me
 *
 * すべてのフィールドが optional（部分更新）。省略したフィールドはそのまま維持する。
 * nickname の検証は Web の profileSchema と完全一致させる。
 * avatarUrl / headerUrl は POST /api/v1/upload/image で取得した自社ストレージ URL を渡す
 * （外部 URL は route handler 内で assertMediaUrlsFromOwnStorage で拒否される）。
 */
export const updateProfileRequestSchema = z.object({
  nickname: z
    .string()
    .min(1, ERR_NICKNAME_REQUIRED)
    .max(MAX_NICKNAME_LENGTH, ERR_NICKNAME_TOO_LONG(MAX_NICKNAME_LENGTH))
    .refine((v) => !/[\r\n<>]/.test(v), ERR_NICKNAME_INVALID_CHARS)
    .optional(),
  bio: z.string().max(MAX_BIO_LENGTH, ERR_BIO_TOO_LONG(MAX_BIO_LENGTH)).nullable().optional(),
  location: z
    .string()
    .max(MAX_LOCATION_LENGTH, ERR_LOCATION_TOO_LONG(MAX_LOCATION_LENGTH))
    .nullable()
    .optional(),
  bonsaiStartYear: z
    .number({ message: ERR_BONSAI_START_YEAR_INVALID })
    .int(ERR_BONSAI_START_YEAR_INVALID)
    .min(BONSAI_START_MIN_YEAR, ERR_BONSAI_START_YEAR_INVALID)
    .max(new Date().getFullYear(), ERR_BONSAI_START_YEAR_INVALID)
    .nullable()
    .optional(),
  bonsaiStartMonth: z
    .number({ message: ERR_BONSAI_START_MONTH_INVALID })
    .int(ERR_BONSAI_START_MONTH_INVALID)
    .min(1, ERR_BONSAI_START_MONTH_INVALID)
    .max(12, ERR_BONSAI_START_MONTH_INVALID)
    .nullable()
    .optional(),
  birthDate: z.string({ message: ERR_BIRTH_DATE_INVALID }).nullable().optional(),
  isPublic: z.boolean().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  headerUrl: z.string().url().nullable().optional(),
})
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>

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

// ──────────────────────────────────────────────────
// Phase 3 Batch 3a — Push 通知デバイストークン登録/解除
// ──────────────────────────────────────────────────

import { MAX_DEVICE_TOKEN_LENGTH } from '@/lib/constants/limits'

/**
 * POST /api/v1/devices
 *
 * Expo / APNs / FCM の Push トークンを登録する（冪等な upsert）。
 * 既存トークンは現所有者に付け替える（端末譲渡・再インストールに対応）。
 */
export const registerDeviceRequestSchema = z.object({
  token: z.string().min(1).max(MAX_DEVICE_TOKEN_LENGTH),
  platform: z.enum(['android', 'ios']),
})
export type RegisterDeviceRequest = z.infer<typeof registerDeviceRequestSchema>

// ──────────────────────────────────────────────────
// §3.3 マイ盆栽 CRUD
// ──────────────────────────────────────────────────

import {
  MAX_BONSAI_NAME_LENGTH,
  MAX_BONSAI_SPECIES_LENGTH,
  MAX_BONSAI_DESCRIPTION_LENGTH,
  MAX_BONSAI_RECORD_IMAGES,
} from '@/lib/constants/limits'

/**
 * POST /api/v1/bonsai
 *
 * 盆栽を新規作成する。name は必須。
 * acquiredAt は ISO 8601 形式の日時文字列（例: "2024-03-15T00:00:00.000Z"）。
 */
export const createBonsaiRequestSchema = z.object({
  name: z.string().min(1).max(MAX_BONSAI_NAME_LENGTH),
  species: z.string().max(MAX_BONSAI_SPECIES_LENGTH).optional(),
  acquiredAt: z.string().datetime().optional(),
  description: z.string().max(MAX_BONSAI_DESCRIPTION_LENGTH).optional(),
})
export type CreateBonsaiRequest = z.infer<typeof createBonsaiRequestSchema>

/**
 * PATCH /api/v1/bonsai/{id}
 *
 * 盆栽情報を部分更新する。全フィールドが optional。
 * acquiredAt に null を渡すと取得日をクリアする。
 */
export const updateBonsaiRequestSchema = z.object({
  name: z.string().min(1).max(MAX_BONSAI_NAME_LENGTH).optional(),
  species: z.string().max(MAX_BONSAI_SPECIES_LENGTH).optional(),
  acquiredAt: z.string().datetime().nullable().optional(),
  description: z.string().max(MAX_BONSAI_DESCRIPTION_LENGTH).optional(),
})
export type UpdateBonsaiRequest = z.infer<typeof updateBonsaiRequestSchema>

/**
 * POST /api/v1/bonsai/{id}/records
 *
 * 成長記録を追加する。recordAt は必須（ISO 8601）。
 * mediaUrls は POST /api/v1/upload/image で取得した自社ストレージ URL を渡すこと
 * （外部 URL は 400 VALIDATION_ERROR）。
 * 最大 MAX_BONSAI_RECORD_IMAGES 枚。
 */
export const createBonsaiRecordRequestSchema = z.object({
  content: z.string().max(MAX_BONSAI_DESCRIPTION_LENGTH).optional(),
  recordAt: z.string().datetime(),
  mediaUrls: z.array(z.string().url()).max(MAX_BONSAI_RECORD_IMAGES).default([]),
})
export type CreateBonsaiRecordRequest = z.infer<typeof createBonsaiRecordRequestSchema>

/**
 * PATCH /api/v1/bonsai/{id}/records/{recordId}
 *
 * 成長記録を部分更新する。mediaUrls 指定時は既存画像を全て置換する。
 * mediaUrls を省略した場合は既存画像をそのまま維持する。
 */
export const updateBonsaiRecordRequestSchema = z.object({
  content: z.string().max(MAX_BONSAI_DESCRIPTION_LENGTH).optional(),
  recordAt: z.string().datetime().optional(),
  mediaUrls: z.array(z.string().url()).max(MAX_BONSAI_RECORD_IMAGES).optional(),
})
export type UpdateBonsaiRecordRequest = z.infer<typeof updateBonsaiRecordRequestSchema>

// ──────────────────────────────────────────────────
// §3.5 イベント CRUD
// ──────────────────────────────────────────────────

import { REGION_NAME_LIST, PREFECTURES } from '@/lib/prefectures'
import { MAX_EVENT_TITLE_LENGTH, MAX_PAGE_LIMIT } from '@/lib/constants/limits'
import {
  ERR_EVENT_TITLE_REQUIRED,
  ERR_EVENT_START_DATE_REQUIRED,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'

const MAX_EVENT_DESCRIPTION_LENGTH_REQ = 5000
const MAX_EVENT_PREFECTURE_LENGTH_REQ = 20
const MAX_EVENT_CITY_LENGTH_REQ = 100
const MAX_EVENT_VENUE_LENGTH_REQ = 200
const MAX_EVENT_ORGANIZER_LENGTH_REQ = 200
const MAX_EVENT_ADMISSION_FEE_LENGTH_REQ = 100
const MAX_EVENT_EXTERNAL_URL_LENGTH_REQ = 2000
const MAX_EVENT_ID_LENGTH_REQ = 50

/**
 * GET /api/v1/events のクエリパラメータスキーマ。
 * region: 地方ブロック名 / prefecture: 都道府県名 / showPast / year / month をサポート。
 */
export const listEventsQuerySchema = z.object({
  cursor: z.string().max(MAX_EVENT_ID_LENGTH_REQ).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
  region: z.string().optional().refine(
    (v) => v === undefined || (REGION_NAME_LIST as readonly string[]).includes(v),
    { message: ERR_INVALID_INPUT },
  ),
  prefecture: z
    .string()
    .max(MAX_EVENT_PREFECTURE_LENGTH_REQ)
    .optional()
    .refine(
      (v) => v === undefined || (PREFECTURES as readonly string[]).includes(v),
      { message: ERR_INVALID_INPUT },
    ),
  showPast: z.enum(['true', 'false']).optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  month: z.coerce.number().int().min(0).max(11).optional(),
})
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>

/**
 * POST /api/v1/events リクエストボディスキーマ。
 * title / startDate は必須。prefecture は optional（Web は必須だが API は緩和）。
 */
export const createEventRequestSchema = z.object({
  title: z.string().min(1, ERR_EVENT_TITLE_REQUIRED).max(MAX_EVENT_TITLE_LENGTH),
  startDate: z.string().min(1, ERR_EVENT_START_DATE_REQUIRED),
  description: z.string().max(MAX_EVENT_DESCRIPTION_LENGTH_REQ).nullable().optional(),
  endDate: z.string().nullable().optional(),
  prefecture: z.string().max(MAX_EVENT_PREFECTURE_LENGTH_REQ).nullable().optional(),
  city: z.string().max(MAX_EVENT_CITY_LENGTH_REQ).nullable().optional(),
  venue: z.string().max(MAX_EVENT_VENUE_LENGTH_REQ).nullable().optional(),
  organizer: z.string().max(MAX_EVENT_ORGANIZER_LENGTH_REQ).nullable().optional(),
  admissionFee: z.string().max(MAX_EVENT_ADMISSION_FEE_LENGTH_REQ).nullable().optional(),
  hasSales: z.boolean().optional().default(false),
  externalUrl: z.string().url().max(MAX_EVENT_EXTERNAL_URL_LENGTH_REQ).nullable().optional(),
})
export type CreateEventRequest = z.infer<typeof createEventRequestSchema>

// ──────────────────────────────────────────────────
// §3.4 盆栽園マップ
// ──────────────────────────────────────────────────

import {
  MAX_SHOP_NAME_LENGTH,
  MAX_SHOP_ADDRESS_LENGTH,
  MAX_SHOP_PHONE_LENGTH,
  MAX_SHOP_URL_LENGTH,
  MAX_SHOP_BUSINESS_HOURS_LENGTH,
  MAX_SHOP_CLOSED_DAYS_LENGTH,
  MAX_SHOP_GENRES,
  MIN_RATING,
  MAX_RATING,
  MAX_REVIEW_IMAGES,
} from '@/lib/constants/limits'
import {
  ERR_SHOP_NAME_REQUIRED,
  ERR_SHOP_ADDRESS_REQUIRED,
  ERR_RATING_RANGE,
  ERR_REVIEW_IMAGE_LIMIT,
} from '@/lib/constants/errors'

/** 盆栽園ソート順の有効値（OpenAPI enum + Zod enum 共用） */
export const SHOP_SORT_BY_VALUES = ['rating', 'name', 'newest', 'location'] as const
export type ShopSortByValue = (typeof SHOP_SORT_BY_VALUES)[number]

/** GET /api/v1/shops クエリパラメータスキーマ（OpenAPI 生成用） */
export const listShopsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  search: z.string().max(MAX_SHOP_NAME_LENGTH).optional(),
  genreId: z.string().optional(),
  prefecture: z.string().max(20).optional(),
  sortBy: z.enum(SHOP_SORT_BY_VALUES).optional(),
  region: z.string().optional().refine(
    (v) => v === undefined || (REGION_NAME_LIST as readonly string[]).includes(v),
    { message: ERR_INVALID_INPUT },
  ),
})
export type ListShopsQuery = z.infer<typeof listShopsQuerySchema>

/** POST /api/v1/shops リクエストボディスキーマ（OpenAPI 生成用） */
export const createShopRequestSchema = z.object({
  name: z.string().min(1, ERR_SHOP_NAME_REQUIRED).max(MAX_SHOP_NAME_LENGTH),
  address: z.string().min(1, ERR_SHOP_ADDRESS_REQUIRED).max(MAX_SHOP_ADDRESS_LENGTH),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  phone: z.string().max(MAX_SHOP_PHONE_LENGTH).nullable().optional(),
  website: z
    .string()
    .max(MAX_SHOP_URL_LENGTH)
    .nullable()
    .optional()
    .refine(
      (v) => v == null || v === '' || /^https?:\/\//i.test(v),
      { message: 'website は http(s) URL でなければなりません' },
    ),
  businessHours: z.string().max(MAX_SHOP_BUSINESS_HOURS_LENGTH).nullable().optional(),
  closedDays: z.string().max(MAX_SHOP_CLOSED_DAYS_LENGTH).nullable().optional(),
  genreIds: z.array(z.string()).max(MAX_SHOP_GENRES).default([]),
})
export type CreateShopRequest = z.infer<typeof createShopRequestSchema>

/** PATCH /api/v1/shops/{id} リクエストボディスキーマ（OpenAPI 生成用） */
export const updateShopRequestSchema = z.object({
  name: z.string().min(1, ERR_SHOP_NAME_REQUIRED).max(MAX_SHOP_NAME_LENGTH).optional(),
  address: z
    .string()
    .min(1, ERR_SHOP_ADDRESS_REQUIRED)
    .max(MAX_SHOP_ADDRESS_LENGTH)
    .optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  phone: z.string().max(MAX_SHOP_PHONE_LENGTH).nullable().optional(),
  website: z
    .string()
    .max(MAX_SHOP_URL_LENGTH)
    .nullable()
    .optional()
    .refine(
      (v) => v == null || v === '' || /^https?:\/\//i.test(v),
      { message: 'website は http(s) URL でなければなりません' },
    ),
  businessHours: z.string().max(MAX_SHOP_BUSINESS_HOURS_LENGTH).nullable().optional(),
  closedDays: z.string().max(MAX_SHOP_CLOSED_DAYS_LENGTH).nullable().optional(),
  genreIds: z.array(z.string()).max(MAX_SHOP_GENRES).optional(),
})
export type UpdateShopRequest = z.infer<typeof updateShopRequestSchema>

/** POST /api/v1/shops/{id}/reviews リクエストボディスキーマ（OpenAPI 生成用） */
export const createReviewRequestSchema = z.object({
  rating: z
    .number({ message: ERR_RATING_RANGE })
    .int(ERR_RATING_RANGE)
    .min(MIN_RATING, ERR_RATING_RANGE)
    .max(MAX_RATING, ERR_RATING_RANGE),
  content: z.string().nullable().optional(),
  mediaUrls: z.array(z.string()).max(MAX_REVIEW_IMAGES, ERR_REVIEW_IMAGE_LIMIT).default([]),
})
export type CreateReviewRequest = z.infer<typeof createReviewRequestSchema>

// ──────────────────────────────────────────────────
// §3.10 予約投稿 CRUD
// ──────────────────────────────────────────────────

import {
  MAX_POST_CONTENT_PREMIUM,
  MAX_GENRES_PER_POST as MAX_GENRES_PER_POST_SCHEDULED,
  MAX_PENDING_SCHEDULED_POSTS,
  MAX_SCHEDULED_DAYS_AHEAD,
} from '@/lib/constants/limits'
import {
  ERR_SCHEDULED_POST_DATE_REQUIRED,
  ERR_GENRE_LIMIT as ERR_GENRE_LIMIT_SCHEDULED,
} from '@/lib/constants/errors'

/**
 * POST /api/v1/scheduled-posts
 *
 * content / mediaUrls のどちらか一方は必須（service 層で検証）。
 * scheduledAt は未来かつ MAX_SCHEDULED_DAYS_AHEAD 日以内の ISO 8601 文字列。
 * genreIds は最大 MAX_GENRES_PER_POST 個。
 * mediaUrls は自社ストレージ URL のみ（service 層で assertMediaUrlsFromOwnStorage 検証）。
 * pending 件数は MAX_PENDING_SCHEDULED_POSTS を超えないこと（service 層で検証）。
 */
export const createScheduledPostRequestSchema = z.object({
  content: z.string().max(MAX_POST_CONTENT_PREMIUM).optional().default(''),
  scheduledAt: z.string().min(1, ERR_SCHEDULED_POST_DATE_REQUIRED),
  genreIds: z
    .array(z.string())
    .max(MAX_GENRES_PER_POST_SCHEDULED, ERR_GENRE_LIMIT_SCHEDULED(MAX_GENRES_PER_POST_SCHEDULED))
    .default([]),
  mediaUrls: z.array(z.string()).default([]),
  mediaTypes: z.array(z.enum(['image', 'video'])).default([]),
})
export type CreateScheduledPostRequest = z.infer<typeof createScheduledPostRequestSchema>

/**
 * PATCH /api/v1/scheduled-posts/{id}
 *
 * pending 状態のもののみ更新可能（published/cancelled/failed は 400）。
 * フィールド構成は POST と同一（差し替え方式）。
 */
export const updateScheduledPostRequestSchema = createScheduledPostRequestSchema
export type UpdateScheduledPostRequest = z.infer<typeof updateScheduledPostRequestSchema>

// MAX_PENDING_SCHEDULED_POSTS / MAX_SCHEDULED_DAYS_AHEAD は OpenAPI description で参照
export { MAX_PENDING_SCHEDULED_POSTS, MAX_SCHEDULED_DAYS_AHEAD }

// ──────────────────────────────────────────────────
// §1.20 explore/posts — ハッシュタグ / ジャンル別投稿一覧
// ──────────────────────────────────────────────────

import { MAX_HASHTAG_QUERY_LENGTH, MAX_HASHTAG_LIMIT } from '@/lib/constants/limits'

/**
 * GET /api/v1/explore/posts クエリパラメータスキーマ。
 *
 * hashtag と genreId はどちらか一方のみ指定可能（排他）。
 * 両方指定 / 両方未指定の場合は 400 VALIDATION_ERROR。
 */
export const explorePostsQuerySchema = z.object({
  hashtag: z.string().min(1).max(MAX_HASHTAG_QUERY_LENGTH).optional(),
  genreId: z.string().min(1).max(64).optional(),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
})
export type ExplorePostsQuery = z.infer<typeof explorePostsQuerySchema>

// ──────────────────────────────────────────────────
// §1.20 盆栽手入れログ CRUD（認証必須・ゲスト 403）
// ──────────────────────────────────────────────────

import { BonsaiCareType } from '@prisma/client'
import { MAX_BONSAI_CARE_NOTE_LENGTH, MAX_CARE_LOG_RANGE_DAYS } from '@/lib/constants/limits'

/**
 * POST /api/v1/bonsai/care-logs リクエストボディスキーマ。
 *
 * type は BonsaiCareType enum の実値のみ受け付ける。
 * performedAt は ISO 8601 形式の日時文字列。未来日（+1 日トレランス）は 400。
 */
export const createCareLogRequestSchema = z.object({
  type: z.nativeEnum(BonsaiCareType),
  performedAt: z.string().datetime(),
  note: z.string().max(MAX_BONSAI_CARE_NOTE_LENGTH).optional(),
})
export type CreateCareLogRequest = z.infer<typeof createCareLogRequestSchema>

/**
 * PATCH /api/v1/bonsai/care-logs/{logId} リクエストボディスキーマ。
 *
 * すべてのフィールドが optional（部分更新）。
 * note に null を渡すとノートをクリアする。
 */
export const updateCareLogRequestSchema = z.object({
  type: z.nativeEnum(BonsaiCareType).optional(),
  performedAt: z.string().datetime().optional(),
  note: z.string().max(MAX_BONSAI_CARE_NOTE_LENGTH).nullable().optional(),
})
export type UpdateCareLogRequest = z.infer<typeof updateCareLogRequestSchema>

/**
 * GET /api/v1/bonsai/care-logs クエリパラメータスキーマ。
 *
 * from / to 両方指定時は期間フィルタ（半開区間 [from, to)）。
 * to - from が MAX_CARE_LOG_RANGE_DAYS を超える場合は 400。
 */
export const listCareLogsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
})
export type ListCareLogsQuery = z.infer<typeof listCareLogsQuerySchema>

export { MAX_CARE_LOG_RANGE_DAYS, MAX_BONSAI_CARE_NOTE_LENGTH }

// ──────────────────────────────────────────────────
// §3.11 投稿分析サマリ
// ──────────────────────────────────────────────────

import { ANALYTICS_ALLOWED_DAYS_PARAM } from '@/lib/constants/limits'

/**
 * GET /api/v1/analytics/summary のクエリパラメータスキーマ。
 *
 * days は [7, 30, 90] の文字列表現のみ許容（クエリパラメータは常に文字列で届く）。
 * 省略時はデフォルト '30' を使用する。
 * ANALYTICS_ALLOWED_DAYS_PARAM 定数から enum を導出し、マジックナンバーを排除する。
 */
export const analyticsSummaryQuerySchema = z.object({
  days: z.enum(ANALYTICS_ALLOWED_DAYS_PARAM).optional().default('30'),
})
export type AnalyticsSummaryQuery = z.infer<typeof analyticsSummaryQuerySchema>

/**
 * PATCH /api/v1/events/{id} リクエストボディスキーマ。
 * すべてのフィールドが optional（部分更新）。
 */
export const updateEventRequestSchema = z.object({
  title: z
    .string()
    .min(1, ERR_EVENT_TITLE_REQUIRED)
    .max(MAX_EVENT_TITLE_LENGTH)
    .optional(),
  startDate: z.string().min(1, ERR_EVENT_START_DATE_REQUIRED).optional(),
  description: z.string().max(MAX_EVENT_DESCRIPTION_LENGTH_REQ).nullable().optional(),
  endDate: z.string().nullable().optional(),
  prefecture: z.string().max(MAX_EVENT_PREFECTURE_LENGTH_REQ).nullable().optional(),
  city: z.string().max(MAX_EVENT_CITY_LENGTH_REQ).nullable().optional(),
  venue: z.string().max(MAX_EVENT_VENUE_LENGTH_REQ).nullable().optional(),
  organizer: z.string().max(MAX_EVENT_ORGANIZER_LENGTH_REQ).nullable().optional(),
  admissionFee: z.string().max(MAX_EVENT_ADMISSION_FEE_LENGTH_REQ).nullable().optional(),
  hasSales: z.boolean().optional(),
  externalUrl: z.string().url().max(MAX_EVENT_EXTERNAL_URL_LENGTH_REQ).nullable().optional(),
})
export type UpdateEventRequest = z.infer<typeof updateEventRequestSchema>

// ──────────────────────────────────────────────────
// Wave 4 領域 F — ダイレクトメッセージ (DM)
// ──────────────────────────────────────────────────

import { MAX_MESSAGE_LENGTH } from '@/lib/constants/limits'

/**
 * POST /api/v1/messages/conversations
 *
 * 指定ユーザーとの会話を取得または新規作成する。
 * ブロック関係・自己 DM は 403 FORBIDDEN。
 */
export const startConversationRequestSchema = z.object({
  targetUserId: z.string().min(1),
})
export type StartConversationRequest = z.infer<typeof startConversationRequestSchema>

/**
 * POST /api/v1/messages/conversations/{id}/messages
 *
 * メッセージを送信する。content は必須・非空・MAX_MESSAGE_LENGTH 以内。
 * Zod refine で空文字と長さ超過を弾く（エラーメッセージは既存定数と一致させる）。
 */
export const sendMessageRequestSchema = z.object({
  content: z
    .string()
    .refine((s) => s.trim().length > 0, { message: 'メッセージを入力してください' })
    .refine((s) => s.length <= MAX_MESSAGE_LENGTH, {
      message: `メッセージは${MAX_MESSAGE_LENGTH}文字以内で入力してください`,
    }),
})
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>

// MAX_MESSAGE_LENGTH は OpenAPI description で参照
export { MAX_MESSAGE_LENGTH }
