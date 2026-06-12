/**
 * @module lib/api/v1/pagination
 * モバイル API v1 のページネーション共通スキーマ・型。
 *
 * cursor + limit の形式は lib/actions/schemas/common.ts の paginationSchema と同一。
 * モバイル API のレスポンスは { items, nextCursor } 形式で統一する（モバイルと合意済み）。
 */

import { paginationSchema } from '@/lib/actions/schemas/common'
import type { PaginatedResponse } from './types'

/**
 * API v1 のページネーションパラメータスキーマ。
 * 既存の Server Action 用 paginationSchema（cursor + limit、MAX_PAGE_LIMIT=100）を再エクスポートし、
 * 将来の API 固有拡張の差し込み口として機能させる。
 */
export { paginationSchema as apiPaginationSchema }

export type { PaginatedResponse }
