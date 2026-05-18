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
import { PrismaClient as PrismaClientCF } from '@/lib/generated/prisma-cf/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

export const dynamic = 'force-dynamic'

/**
 * Build version 識別用の sentinel。bundle が再生成されているかをユーザー側で
 * 確認できるよう、commit ごとに人手で更新する。
 *
 * Cloudflare のビルド出力キャッシュが古い worker.js を serve している場合、
 * ここの値が更新されていても /api/ping のレスポンスは古いまま (= cache 配信)。
 */
const BUILD_VERSION = 'v20-hyperdrive-id-nohyphen'

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
/**
 * スタックトレースから path と行番号だけ抽出 (最大 12 行)。
 * 値・引数・絶対パス内のユーザー名等は含まない。
 */
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

function serializeErr(err: unknown): unknown {
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
    return { ok: false, ...serializeErr(err) as Record<string, unknown> }
  }
}

/**
 * 接続パラメータを変えながら SELECT 1 を試して切り分ける。
 * Plan B 採用後、Connection terminated unexpectedly エラーの原因が
 * pgbouncer (6543) vs direct (5432) / SSL verify on/off のどれかを判別する。
 */
async function probeDbVariants(): Promise<unknown> {
  function decodeCa(): string | undefined {
    const raw = process.env.SUPABASE_CA_CERT
    if (!raw) return undefined
    return Buffer.from(raw, 'base64').toString('utf-8')
  }

  async function tryOnce(label: string, connectionString: string, ssl: false | { rejectUnauthorized: boolean; ca?: string }): Promise<unknown> {
    const pool = new Pool({
      connectionString,
      ssl,
      max: 1,
      idleTimeoutMillis: 1_000,
      connectionTimeoutMillis: 5_000,
    })
    const client = new PrismaClientCF({ adapter: new PrismaPg(pool) })
    try {
      const rows = (await client.$queryRaw`SELECT 1 AS ok`) as unknown[]
      return { label, ok: true, rowCount: rows.length }
    } catch (err) {
      return { label, ok: false, ...serializeErr(err) as Record<string, unknown> }
    } finally {
      try { await client.$disconnect() } catch {}
      try { await pool.end() } catch {}
    }
  }

  const ca = decodeCa()
  const dbUrl = process.env.DATABASE_URL ?? ''
  const directUrl = process.env.DIRECT_URL ?? ''
  const results: unknown[] = []

  // Variant 1: DATABASE_URL (pgbouncer 6543) + SSL verify on
  if (dbUrl) {
    results.push(await tryOnce('database_url+ssl-verify', dbUrl, { rejectUnauthorized: true, ca }))
  }
  // Variant 2: DATABASE_URL + SSL skip verify
  if (dbUrl) {
    results.push(await tryOnce('database_url+ssl-noverify', dbUrl, { rejectUnauthorized: false }))
  }
  // Variant 3: DIRECT_URL (direct 5432) + SSL verify on
  if (directUrl) {
    results.push(await tryOnce('direct_url+ssl-verify', directUrl, { rejectUnauthorized: true, ca }))
  }
  // Variant 4: DIRECT_URL + SSL skip verify
  if (directUrl) {
    results.push(await tryOnce('direct_url+ssl-noverify', directUrl, { rejectUnauthorized: false }))
  }
  return results
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const mode = url.searchParams.get('probe')
  if (mode === 'db') {
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
  if (mode === 'db-variants') {
    const variants = await probeDbVariants()
    return new Response(
      JSON.stringify({
        ok: true,
        runtime: 'Cloudflare-Workers',
        buildVersion: BUILD_VERSION,
        timestamp: new Date().toISOString(),
        variants,
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
