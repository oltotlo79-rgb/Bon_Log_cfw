import type { z } from 'zod'

/**
 * 任意の値がプレーンな JSON オブジェクトかを判定する型ガード。
 * 配列・null・プリミティブは除外する。
 */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 任意の値を `Record<string, unknown>` として安全に絞り込む。
 * 非オブジェクトは `null` を返す。Prisma の Json カラム読み取りなどで
 * 素の `as` キャストを避けるために使用する。
 */
export function toJsonObject(value: unknown): Record<string, unknown> | null {
  return isJsonObject(value) ? value : null
}

/**
 * 任意の値を JSON オブジェクトとしてパースし、失敗時はフォールバック値を返す。
 * すでにオブジェクトなら toJsonObject と同じ。文字列なら JSON.parse を試みる。
 */
export function parseJsonObject(
  value: unknown,
  fallback: Record<string, unknown> = {},
): Record<string, unknown> {
  const asObject = toJsonObject(value)
  if (asObject) return asObject
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      if (isJsonObject(parsed)) return parsed
    } catch {
      // parse 失敗時は fallback を返す
    }
  }
  return fallback
}

/**
 * Redis (Upstash) から取り出した値を Zod スキーマで検証する。
 *
 * Upstash クライアントは値を string のまま返す場合と、JSON パース後の
 * オブジェクトで返す場合があるため、両方に対応する。`as` キャストで
 * 済ませると不正な形のペイロードが混入するため、必ず Zod で絞り込む。
 *
 * 検証に失敗した場合は `null` を返して呼び出し元で DB フォールバック等に委ねる。
 */
export function parseCachedWithSchema<T>(
  cached: unknown,
  schema: z.ZodType<T>,
): T | null {
  try {
    const raw: unknown = typeof cached === 'string' ? JSON.parse(cached) : cached
    const parsed = schema.safeParse(raw)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
