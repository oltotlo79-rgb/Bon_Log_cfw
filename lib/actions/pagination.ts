/**
 * @module lib/actions/pagination
 * カーソルベース pagination 用のヘルパ。limit は必ず MAX_PAGE_LIMIT で clamp して
 * 「クライアントから巨大 limit を渡されて DB が爆発する」経路を共通的に塞ぐ。
 */

import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@/lib/constants/limits'

/** cursor の最大文字数 (cuid / uuid / id 等を許容する余裕値)。 */
const CURSOR_MAX_LENGTH = 64

/** cuid / uuid / 数値 id を許容するため英数字・ハイフン・アンダースコアのみ受け入れる */
const CURSOR_ALLOWED_PATTERN = /^[A-Za-z0-9_-]+$/

/**
 * カーソル / リミットを安全な範囲に正規化する。
 *
 *   - limit 未指定 / NaN / 0 以下 → DEFAULT_PAGE_LIMIT
 *   - limit が MAX_PAGE_LIMIT 超 → MAX_PAGE_LIMIT に clamp
 *   - cursor が空文字 / 長すぎる / 不正文字含む → undefined (新規取得扱い)
 *
 * 読み取り系の Server Action 用に「明確に失敗を返さず安全側に倒す」設計。
 * 失敗を呼び出し側に通知する必要がある場合は zod schema を使う。
 */
export function normalizeCursorPagination(input: {
  cursor?: string
  limit?: number
}): { cursor?: string; limit: number } {
  const rawLimit = input.limit
  const limit =
    typeof rawLimit === 'number' && Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_PAGE_LIMIT)
      : DEFAULT_PAGE_LIMIT

  const rawCursor = input.cursor
  const cursor =
    typeof rawCursor === 'string' &&
    rawCursor.length > 0 &&
    rawCursor.length <= CURSOR_MAX_LENGTH &&
    CURSOR_ALLOWED_PATTERN.test(rawCursor)
      ? rawCursor
      : undefined

  return { cursor, limit }
}

/**
 * 単独の limit を安全な範囲 [1, max] に clamp する。
 * cursor を伴わない `take` 直渡しの read action で、巨大 limit による DB 過負荷を防ぐ。
 */
export function clampLimit(limit: number | undefined, max: number = MAX_PAGE_LIMIT): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
    return Math.min(DEFAULT_PAGE_LIMIT, max)
  }
  return Math.min(Math.floor(limit), max)
}

/**
 * Prisma 用 take / cursor / skip を組み立てる。limit は必ず MAX_PAGE_LIMIT で clamp する。
 * `normalizeCursorPagination` を通していない呼び出しでも安全に動作する二重防御。
 */
export function buildCursorPagination(cursor?: string, limit: number = DEFAULT_PAGE_LIMIT) {
  const safeLimit = Math.min(
    Math.max(Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_PAGE_LIMIT, 1),
    MAX_PAGE_LIMIT,
  )
  return {
    take: safeLimit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
  }
}
