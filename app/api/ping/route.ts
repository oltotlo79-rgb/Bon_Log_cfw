/**
 * @module app/api/ping/route
 *
 * Cloudflare Workers ランタイム診断専用エンドポイント。
 * 一切の app-level import (prisma / auth / sentry / redis) を持たず、
 * Web 標準の `Response` だけを返す。
 *
 * 動作仕様:
 *   - `GET /api/ping` が 200 を返せば Worker 自体は健全
 *   - それでも `Server failed to respond` が出るなら OpenNext bundle 自体の
 *     初期化で例外が起きている (Next.js / Prisma / NextAuth init などより前段)
 *
 * Phase 5 で staging 検証後に削除予定。
 */

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

export function GET(): Response {
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
