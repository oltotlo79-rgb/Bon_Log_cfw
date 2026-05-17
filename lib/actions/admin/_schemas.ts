/**
 * @module lib/actions/admin/_schemas
 *
 * Admin Server Action 群で共有する Zod スキーマ・型エイリアス。
 *
 * Why: CLAUDE.md ルール3 (auth → Zod → rate limit) を admin 経路でも徹底するため、
 * 手動 if-validation を Zod に置き換える際に使う共通プリミティブを集約する。
 * 各 admin action では Action 固有スキーマを `z.object({...})` で組み、必要に応じて
 * ここで定義する primitive を再利用する。
 *
 * 個別 schema は呼び出し側ファイルに置き、ここには **複数 Action から再利用される共通片** のみを置く。
 */

import { z } from 'zod'
import {
  MAX_ADMIN_REASON_LENGTH,
  MAX_CMS_TITLE_LENGTH,
  MAX_CMS_CONTENT_LENGTH,
  MAX_CMS_CATEGORY_LENGTH,
  MAX_WARNING_REASON_LENGTH,
  NG_WORD_MAX_LENGTH,
  NG_WORD_REGEX_MAX_LENGTH,
  MAX_SEGMENT_NAME_LENGTH,
  MAX_SEGMENT_DESCRIPTION_LENGTH,
  MIN_PREMIUM_GRANT_DAYS,
  MAX_PREMIUM_GRANT_DAYS,
  BULK_MODERATION_MAX,
  BULK_DELETE_POSTS_MAX,
  BULK_SUSPEND_USERS_MAX,
  CMS_SLUG_PATTERN,
} from '@/lib/constants/limits'

/**
 * 管理者操作で受け取る ID 文字列 (cuid 等)。空文字を弾く。
 * 内部生成された ID なので長すぎる値は早期に拒否する保護的上限を 200 で置く。
 */
export const adminIdSchema = z.string().min(1).max(200)

/**
 * 管理者がコンテンツ削除・ユーザー停止などに残す自由記述の理由文字列。
 *
 * 空文字を許可: 「理由を残さず即削除」ユースケースを既存契約として保つ。
 * adminLog.details に JSON で格納されるため上限を `MAX_ADMIN_REASON_LENGTH` で保護する。
 */
export const adminReasonSchema = z.string().max(MAX_ADMIN_REASON_LENGTH)

/**
 * 警告 (UserWarning) の理由フィールド。事案説明のため長文を許容する上限。
 */
export const adminWarningReasonSchema = z.string().min(1).max(MAX_WARNING_REASON_LENGTH)

/**
 * 任意の関連レポート ID。空文字も許可（呼び出し側で `|| null` 変換するため）。
 */
export const adminOptionalIdSchema = z.string().max(200).optional()

/**
 * CMS スラッグ。`CMS_SLUG_PATTERN` (小文字英数・ハイフン・アンダースコア) に従う。
 * 予約語チェック (`CMS_SLUG_RESERVED`) は呼び出し側で個別に行う。
 */
export const cmsSlugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(CMS_SLUG_PATTERN)

export const cmsTitleSchema = z.string().min(1).max(MAX_CMS_TITLE_LENGTH)
export const cmsContentSchema = z.string().max(MAX_CMS_CONTENT_LENGTH)
export const cmsCategorySchema = z.string().min(1).max(MAX_CMS_CATEGORY_LENGTH)

/**
 * NG ワード本体。空白除去後に min(1) を満たすよう trim を適用する。
 */
export const ngWordSchema = z
  .string()
  .trim()
  .min(1)
  .max(NG_WORD_MAX_LENGTH)

/**
 * NG ワード正規表現本体。
 */
export const ngWordRegexSchema = z.string().trim().min(1).max(NG_WORD_REGEX_MAX_LENGTH)

/**
 * セグメント名 / 説明。
 */
export const segmentNameSchema = z.string().min(1).max(MAX_SEGMENT_NAME_LENGTH)
export const segmentDescriptionSchema = z.string().max(MAX_SEGMENT_DESCRIPTION_LENGTH)

/**
 * プレミアム手動付与・延長の日数。整数 + 範囲制限。
 */
export const premiumDurationDaysSchema = z
  .number()
  .int()
  .min(MIN_PREMIUM_GRANT_DAYS)
  .max(MAX_PREMIUM_GRANT_DAYS)

/**
 * 一括操作の ID 配列スキーマファクトリ。
 * `BULK_*_MAX` 定数を受け取り、空配列を弾きつつ上限を強制する。
 */
export function makeBulkIdsSchema(max: number) {
  return z.array(adminIdSchema).min(1).max(max)
}

export const bulkModerationIdsSchema = makeBulkIdsSchema(BULK_MODERATION_MAX)
export const bulkDeletePostIdsSchema = makeBulkIdsSchema(BULK_DELETE_POSTS_MAX)
export const bulkSuspendUserIdsSchema = makeBulkIdsSchema(BULK_SUSPEND_USERS_MAX)

/**
 * モデレーション処理結果。
 */
export const moderationActionSchema = z.enum(['approved', 'rejected'])

/**
 * 管理者用コンテンツタイプ enum (hidden / report の対象判別に使用)。
 */
export const contentTypeSchema = z.enum(['post', 'comment', 'event', 'shop', 'review'])
