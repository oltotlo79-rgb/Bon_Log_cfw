/**
 * Prisma + PostgreSQL 接続のシングルトン管理 (Cloudflare Workers 対応版)
 *
 * Vercel 版との差分:
 *  - DB 接続文字列を **Hyperdrive binding (`env.HYPERDRIVE.connectionString`) から優先取得**
 *    することで Workers から TCP 経由で Supabase に到達できるようにする。
 *  - Hyperdrive が無い実行環境 (Next.js dev / vitest / scripts) では従来通り
 *    `process.env.DATABASE_URL` を使う (localhost or Supabase direct)。
 *  - 各 fetch ハンドラごとに Prisma client をキャッシュ可能だが、Phase 2 では
 *    `globalForPrisma` シングルトンを維持して挙動互換を確保する。
 *
 * @module lib/db
 */

// Next.jsビルド時のみserver-onlyを適用（スクリプト直接実行時はスキップ）
if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- 条件付きインポートにはrequireが必要
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

/**
 * Cloudflare Workers 環境で Hyperdrive binding から接続文字列を取得する。
 *
 * 優先順位:
 *  1. `globalThis.__BON_LOG_HYPERDRIVE_CONNECTION_STRING__` (Workers fetch handler 内で
 *     `lib/cloudflare-context.ts` がセット)
 *  2. `process.env.DATABASE_URL` (Node.js dev / vitest / scripts)
 *  3. ダミー DB URL (build 時のフォールバック)
 */
function resolveConnectionString(): string {
  const hyperdrive = (globalThis as unknown as {
    __BON_LOG_HYPERDRIVE_CONNECTION_STRING__?: string
  }).__BON_LOG_HYPERDRIVE_CONNECTION_STRING__
  return hyperdrive || process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy'
}

const globalForPrisma = global as unknown as { prisma: PrismaClient }

/**
 * CI/テスト/ビルド環境判定: DATABASE_URLが未設定またはダミーの場合は実接続しない。
 *
 * `SKIP_DB_CONNECTION=true` は **build phase でのみ有効**。
 * Cloudflare Workers では build/runtime の env を分離できないため、runtime まで
 * skip が効くと全機能が死亡する。`NEXT_PHASE === 'phase-production-build'` で
 * build 中のみに限定する。
 */
const DUMMY_DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'
const NEXT_BUILD_PHASE = 'phase-production-build'
const isBuildPhase = process.env.NEXT_PHASE === NEXT_BUILD_PHASE
const hasHyperdriveBinding = !!(globalThis as { __BON_LOG_HYPERDRIVE_CONNECTION_STRING__?: string }).__BON_LOG_HYPERDRIVE_CONNECTION_STRING__
const skipByEnv = isBuildPhase && process.env.SKIP_DB_CONNECTION === 'true'
const isDummyDatabase =
  skipByEnv ||
  (!process.env.DATABASE_URL && !hasHyperdriveBinding) ||
  process.env.DATABASE_URL === DUMMY_DATABASE_URL

/** Supabase CA証明書をBase64環境変数からデコード */
const supabaseCaCert = process.env.SUPABASE_CA_CERT
  ? Buffer.from(process.env.SUPABASE_CA_CERT, 'base64').toString('utf-8')
  : undefined

/**
 * ローカル接続（localhost/127.0.0.1）ではSSLを要求しない。
 * Hyperdrive 経由の接続文字列は `default` host になるため SSL は内部で処理される。
 */
function isLocalConnection(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

const connectionString = isDummyDatabase ? DUMMY_DATABASE_URL : resolveConnectionString()
const isLocal = isLocalConnection(connectionString)

/**
 * Hyperdrive 経由か直接 Supabase 接続かに応じて SSL 設定を切り替える。
 *
 * - Hyperdrive: Cloudflare が edge 側で SSL 終端するため Worker → Hyperdrive は平文 (内部閉域網)
 * - direct Supabase: rejectUnauthorized + CA 必須
 * - localhost: SSL なし
 */
const pool = new Pool({
  connectionString,
  ssl: (!isDummyDatabase && process.env.NODE_ENV === 'production' && !isLocal)
    ? { rejectUnauthorized: true, ca: supabaseCaCert }
    : false,
  // Serverless環境（Workers）では同時接続が急増しやすいため、
  // プールサイズを制限。Hyperdrive 自身もプーリングするため Worker 側は控えめに。
  max: parseInt(process.env.DB_POOL_MAX || String(DB_POOL_MAX_DEFAULT), 10),
  idleTimeoutMillis: DB_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: DB_POOL_CONNECTION_TIMEOUT_MS,
})

// プールのエラーハンドラ（接続切断等を検知しログに記録）
pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message)
})

const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// 開発環境ではグローバルに保存してホットリロード時の接続増殖を防止
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
