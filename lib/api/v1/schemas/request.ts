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
