/**
 * @module app/api/ping/route
 *
 * Cloudflare Workers ランタイム診断専用エンドポイント。
 * `?probe=db` を付けると DB 接続のエラー詳細を返す。それ以外は app-level import なしの
 * 軽量応答 (Worker 自体の生存確認用)。
 *
 * Phase 5 で staging 検証後に削除予定。
 */

import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Workers の env 注入タイミング検証用 (存在チェックのみ)。
 *
 * 値・プレフィックス・サフィックスは一切出さない。
 * 「set されているか / 値の長さは妥当か」だけ返す。
 */
function probe(name: string): { exists: boolean; len?: number } {
  const v = process.env[name]
  if (typeof v !== 'string' || v.length === 0) {
    return { exists: false }
  }
  return { exists: true, len: v.length }
}

/**
 * DB 接続を最小クエリで試し、エラー詳細を返す。
 * 値そのもの (DATABASE_URL / password) は返さず、error.name / message / code だけ返す。
 */
async function probeDb(): Promise<unknown> {
  try {
    const rows = (await prisma.$queryRaw`SELECT 1 AS ok`) as unknown[]
    return { ok: true, rowCount: rows.length }
  } catch (err) {
    if (err instanceof Error) {
      return {
        ok: false,
        name: err.name,
        message: err.message,
        // pg や Prisma が乗せる追加プロパティ
        code: (err as Error & { code?: string }).code,
        cause: err.cause instanceof Error
          ? { name: err.cause.name, message: err.cause.message }
          : err.cause,
      }
    }
    return { ok: false, message: String(err) }
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (url.searchParams.get('probe') === 'db') {
    const dbResult = await probeDb()
    return new Response(
      JSON.stringify({
        ok: true,
        runtime: 'Cloudflare-Workers',
        timestamp: new Date().toISOString(),
        db: dbResult,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  return getLite()
}

function getLite(): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      runtime: typeof navigator !== 'undefined' && (navigator as { userAgent?: string }).userAgent
        ? (navigator as { userAgent: string }).userAgent
        : 'unknown',
      timestamp: new Date().toISOString(),
      env: {
        DATABASE_URL: probe('DATABASE_URL'),
        DIRECT_URL: probe('DIRECT_URL'),
        NEXTAUTH_SECRET: probe('NEXTAUTH_SECRET'),
        NEXTAUTH_URL: probe('NEXTAUTH_URL'),
        NEXT_PUBLIC_APP_URL: probe('NEXT_PUBLIC_APP_URL'),
        SUPABASE_CA_CERT: probe('SUPABASE_CA_CERT'),
        TWO_FACTOR_ENCRYPTION_KEY: probe('TWO_FACTOR_ENCRYPTION_KEY'),
        UPSTASH_REDIS_REST_URL: probe('UPSTASH_REDIS_REST_URL'),
        UPSTASH_REDIS_REST_TOKEN: probe('UPSTASH_REDIS_REST_TOKEN'),
        STORAGE_PROVIDER: probe('STORAGE_PROVIDER'),
        EMAIL_PROVIDER: probe('EMAIL_PROVIDER'),
        EMAIL_FROM: probe('EMAIL_FROM'),
        SKIP_DB_CONNECTION: probe('SKIP_DB_CONNECTION'),
        NODE_ENV: probe('NODE_ENV'),
        NEXT_RUNTIME: probe('NEXT_RUNTIME'),
      },
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  )
}
