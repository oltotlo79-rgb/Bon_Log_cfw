/**
 * @module app/api/ping/route
 *
 * Cloudflare Workers ランタイム診断専用エンドポイント。
 *   - `GET /api/ping` : env 存在チェックと runtime 識別 (DB 不要)
 *   - `GET /api/ping?probe=db` : prisma.$queryRaw \`SELECT 1\` で DB 接続を確認
 *
 * Phase 5 (本番カットオーバー検証完了) で削除予定。
 */

import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const BUILD_VERSION = 'v23-hyperdrive-pool-max3'

function probe(name: string): { exists: boolean; len?: number } {
  const v = process.env[name]
  if (typeof v !== 'string' || v.length === 0) {
    return { exists: false }
  }
  return { exists: true, len: v.length }
}

function sanitizeStack(stack: string | undefined): string[] {
  if (!stack) return []
  return stack
    .split('\n')
    .slice(0, 15)
    .map((line) => line.replace(/file:\/\/[^\s)]+/g, (m) => {
      const idx = m.lastIndexOf('/')
      return idx >= 0 ? m.slice(idx) : m
    }))
}

function serializeErr(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      code: (err as Error & { code?: string }).code,
      cause: err.cause instanceof Error
        ? { name: err.cause.name, message: err.cause.message, stack: sanitizeStack(err.cause.stack) }
        : err.cause,
      stack: sanitizeStack(err.stack),
    }
  }
  return { message: String(err) }
}

async function probeDb(): Promise<unknown> {
  try {
    const rows = (await prisma.$queryRaw`SELECT 1 AS ok`) as unknown[]
    return { ok: true, rowCount: rows.length }
  } catch (err) {
    return { ok: false, ...serializeErr(err) }
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
        buildVersion: BUILD_VERSION,
        timestamp: new Date().toISOString(),
        db: dbResult,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  return new Response(
    JSON.stringify({
      ok: true,
      runtime: typeof navigator !== 'undefined' && (navigator as { userAgent?: string }).userAgent
        ? (navigator as { userAgent: string }).userAgent
        : 'unknown',
      buildVersion: BUILD_VERSION,
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
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}
