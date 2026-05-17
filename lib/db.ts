/**
 * Prisma + PostgreSQL 接続のシングルトン管理 (Cloudflare Workers 対応版)
 *
 * @module lib/db
 *
 * ## なぜ lazy initialization か
 *
 * Cloudflare Workers では env vars は **per-request の `env` 引数** として注入される。
 * OpenNext がそれを `process.env` にマージするのは fetch handler の入口であり、
 * **module init 時 (= 各 lib/* の top-level 評価時)** には `process.env.DATABASE_URL`
 * 等は undefined。
 *
 * Vercel 移行前は module init で `new Pool(...)` を作って差し支えなかったが、
 * Workers でこれをやると DUMMY URL で Pool が作られ、その後 env が流れ込んでも
 * Pool は dummy のままで全 query が失敗する。
 *
 * よって Pool / PrismaClient は **最初に prisma.* が呼ばれた瞬間に作る** (lazy)。
 * その時点では Worker fetch handler 内なので process.env は populated。
 */

// Next.js ビルド時のみ server-only を適用（スクリプト直接実行時はスキップ）
if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- 条件付き import には require が必要
  require('server-only')
}
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import {
  DB_POOL_CONNECTION_TIMEOUT_MS,
  DB_POOL_IDLE_TIMEOUT_MS,
  DB_POOL_MAX_DEFAULT,
} from '@/lib/constants/limits'

const DUMMY_DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'
const NEXT_BUILD_PHASE = 'phase-production-build'

/**
 * Cloudflare Workers の Hyperdrive binding (Phase 4 で導入予定) から接続文字列を取得する。
 *
 * 優先順位:
 *  1. `globalThis.__BON_LOG_HYPERDRIVE_CONNECTION_STRING__`
 *     (worker fetch handler 内で lib/cloudflare-context.ts がセット)
 *  2. `process.env.DATABASE_URL`
 *  3. dummy URL (build 時 / 完全に env が空のときのフォールバック)
 */
function resolveConnectionString(): string {
  const hyperdrive = (globalThis as unknown as {
    __BON_LOG_HYPERDRIVE_CONNECTION_STRING__?: string
  }).__BON_LOG_HYPERDRIVE_CONNECTION_STRING__
  return hyperdrive || process.env.DATABASE_URL || DUMMY_DATABASE_URL
}

/**
 * dummy 判定: build 中の SKIP_DB_CONNECTION=true、または DATABASE_URL 完全欠落、
 * または明示的に dummy URL がセットされている場合。
 *
 * `SKIP_DB_CONNECTION=true` は build phase のみで尊重する。runtime で true でも
 * 無視する (Cloudflare では build/runtime の env vars が同じ source なため誤って
 * runtime まで届いた場合の安全装置)。
 */
function isDummyDatabaseRuntime(): boolean {
  const hasHyperdriveBinding = !!(globalThis as { __BON_LOG_HYPERDRIVE_CONNECTION_STRING__?: string })
    .__BON_LOG_HYPERDRIVE_CONNECTION_STRING__
  const isBuildPhase = process.env.NEXT_PHASE === NEXT_BUILD_PHASE
  const skipByEnv = isBuildPhase && process.env.SKIP_DB_CONNECTION === 'true'
  return (
    skipByEnv ||
    (!process.env.DATABASE_URL && !hasHyperdriveBinding) ||
    process.env.DATABASE_URL === DUMMY_DATABASE_URL
  )
}

/** ローカル接続 (localhost / 127.0.0.1 / ::1) では SSL を要求しない。 */
function isLocalConnection(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

/** SUPABASE_CA_CERT (Base64) を PEM へデコード。未設定なら undefined。 */
function getSupabaseCaCert(): string | undefined {
  const raw = process.env.SUPABASE_CA_CERT
  if (!raw) return undefined
  return Buffer.from(raw, 'base64').toString('utf-8')
}

/**
 * Lazy 初期化された PrismaClient を返す。
 *
 * 1 つの Worker instance 内では最初の prisma.* 呼び出しで作られて以降キャッシュされる。
 * Worker instance ごとに独立した singleton になるため Workers のライフサイクルと整合。
 */
let cachedPrisma: PrismaClient | undefined
function getPrismaClient(): PrismaClient {
  if (cachedPrisma) return cachedPrisma

  const isDummy = isDummyDatabaseRuntime()
  const connectionString = isDummy ? DUMMY_DATABASE_URL : resolveConnectionString()
  const isLocal = isLocalConnection(connectionString)

  const pool = new Pool({
    connectionString,
    ssl:
      !isDummy && process.env.NODE_ENV === 'production' && !isLocal
        ? { rejectUnauthorized: true, ca: getSupabaseCaCert() }
        : false,
    max: parseInt(process.env.DB_POOL_MAX || String(DB_POOL_MAX_DEFAULT), 10),
    idleTimeoutMillis: DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: DB_POOL_CONNECTION_TIMEOUT_MS,
  })

  pool.on('error', (err) => {
    console.error('[db] Unexpected pool error:', err.message)
  })

  cachedPrisma = new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

  return cachedPrisma
}

/**
 * 既存呼び出し側 (`import { prisma } from '@/lib/db'` → `prisma.user.findMany(...)`)
 * との後方互換のため Proxy で公開する。プロパティアクセス時に lazy 初期化が走る。
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrismaClient(), prop, receiver)
  },
}) as PrismaClient
