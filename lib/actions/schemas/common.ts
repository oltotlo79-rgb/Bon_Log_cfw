/**
 * 共通Zodバリデーションスキーマ
 *
 * Server Actions間で再利用可能なバリデーションスキーマを提供します。
 *
 * @module lib/actions/schemas/common
 */

import { z, type ZodError } from 'zod'
import { MAX_EMAIL_LENGTH, MAX_REPORT_DETAIL_LENGTH, MIN_FINGERPRINT_LENGTH, MAX_FINGERPRINT_LENGTH, MAX_PAGE_LIMIT } from '@/lib/constants/limits'
import { ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { actionError } from '@/types/action-result'

/**
 * Zod 検証失敗時の ActionResult を生成するヘルパー。
 *
 * スキーマで ERR_* 定数をメッセージ指定している場合はその定数値を露出し、
 * 指定がないフィールドは ERR_INVALID_INPUT にフォールバックする。
 * 各 Action から `parsed.error.issues[0]?.message ?? ERR_INVALID_INPUT` の
 * 繰り返し記述を排除するための統一 API。
 */
export function actionZodError(error: ZodError) {
  return actionError(error.issues[0]?.message ?? ERR_INVALID_INPUT)
}

/** CUID形式のID */
export const cuidSchema = z.string().min(1).max(30)

/** メールアドレス */
export const emailSchema = z.string().email().max(MAX_EMAIL_LENGTH).transform((v) => v.toLowerCase().trim())

/** デバイスフィンガープリント */
export const fingerprintSchema = z.string().min(MIN_FINGERPRINT_LENGTH).max(MAX_FINGERPRINT_LENGTH)

/** 汎用テキスト理由（管理者用） */
export const reasonSchema = z.string().max(MAX_REPORT_DETAIL_LENGTH).optional()

/** ページネーションオプション */
export const paginationSchema = z.object({
  cursor: cuidSchema.optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
})

/** 日時文字列（ISO 8601） */
export const datetimeStringSchema = z.string().refine(
  (v) => !isNaN(new Date(v).getTime()),
  { message: '有効な日時を指定してください' }
)

/** メディア種別（`image` / `video`）。Post / Comment / ScheduledPost で共通利用。 */
export const mediaTypeSchema = z.enum(['image', 'video'])
export type MediaType = z.infer<typeof mediaTypeSchema>

/** メディア種別配列。FormData の `mediaTypes` を受ける際の標準形。 */
export const mediaTypeListSchema = z.array(mediaTypeSchema).default([])

/** メディアURL配列（非空文字）。標準の投稿・コメント・予約投稿で共通利用。 */
export const mediaUrlListSchema = z.array(z.string()).default([])
