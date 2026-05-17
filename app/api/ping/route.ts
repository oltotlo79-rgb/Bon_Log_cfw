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

export function GET(): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      runtime: typeof navigator !== 'undefined' && (navigator as { userAgent?: string }).userAgent
        ? (navigator as { userAgent: string }).userAgent
        : 'unknown',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  )
}
