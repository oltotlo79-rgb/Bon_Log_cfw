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
