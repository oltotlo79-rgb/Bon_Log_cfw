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
} from '@/lib/constants/limits'

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
