/**
 * @module lib/api/v1/types
 * モバイル API v1 共通型定義。
 */

/**
 * レート制限チェック結果。
 * `lib/rate-limit.ts` の `RateLimitResult` と同形で、response.ts が
 * rate-limit に直接依存しなくて済むように再定義する。
 */
export interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}

/**
 * Bearer 認証ガードの戻り値。
 * 成功時は `{ ok: true; userId: string }`、失敗時は `{ ok: false; response: NextResponse }` を返す。
 * upload route の UploadUserResult と同じ判別可能 union パターン。
 */
export type BearerAuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: import('next/server').NextResponse }

/**
 * カーソルページネーションのレスポンス型。
 * モバイルと合意済みの `{ items, nextCursor }` 形式。
 */
export interface PaginatedResponse<T> {
  items: T[]
  nextCursor: string | null
}
