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
// Cloudflare Workers 用に Plan B (provider = "prisma-client") で生成した
// 新 PrismaClient を runtime で使う。
// 新クライアントは内部で `import('./query_engine_bg.wasm?module')` を呼び、
// wrangler のネイティブ WASM binding に乗るため Workers でそのまま動作する。
//
// 型は legacy @prisma/client から取り、コードベース他箇所 (93 ファイル) との
// 型互換を維持する。runtime 値は新 client で、型注釈は legacy で。
import type { PrismaClient as PrismaClientType } from '@prisma/client'
import { PrismaClient as PrismaClientCF } from '@/lib/generated/prisma-cf/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Client, Pool } from 'pg'
import type { ClientConfig, PoolClient, Pool as PgPoolType } from 'pg'
import {
  DB_POOL_CONNECTION_TIMEOUT_MS,
  DB_POOL_IDLE_TIMEOUT_MS,
  DB_POOL_MAX_DEFAULT,
} from '@/lib/constants/limits'

const DUMMY_DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'
const NEXT_BUILD_PHASE = 'phase-production-build'

/**
 * Cloudflare Workers の Hyperdrive binding から接続文字列を取得する。
 *
 * 優先順位:
 *  1. Cloudflare Hyperdrive binding (`env.HYPERDRIVE.connectionString`)
 *     OpenNext の `getCloudflareContext()` 経由でアクセス。Workers ランタイムでのみ取得可能。
 *  2. `globalThis.__BON_LOG_HYPERDRIVE_CONNECTION_STRING__`
 *     (worker fetch handler 内で予め global にセットする legacy 経路)
 *  3. `process.env.DATABASE_URL`
 *     (Node.js dev / vitest / scripts / Workers でも env から流れ込んだ場合)
 *  4. dummy URL (build 時 / 完全に env が空のときのフォールバック)
 *
 * Workers Sockets で Supabase へ直接接続すると "Connection terminated unexpectedly"
 * で失敗するため、Hyperdrive 経由が事実上必須。
 */
/**
 * Diagnostic 用に最後の resolve source を export。/api/ping?probe=db で参照する。
 * 値そのものは出さず、どこから取った経路を示すラベルのみ。
 */
export let __DB_CONNECTION_SOURCE: 'hyperdrive-binding' | 'hyperdrive-global' | 'process-env-database-url' | 'dummy' | 'unknown' = 'unknown'

function resolveConnectionString(): string {
  // 1. getCloudflareContext() で env.HYPERDRIVE.connectionString を取得
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- runtime に存在しない場合があるため動的 require
    const cf = require('@opennextjs/cloudflare') as {
      getCloudflareContext?: (opts?: { async?: boolean }) => {
        env?: { HYPERDRIVE?: { connectionString?: string } }
      }
    }
    if (typeof cf.getCloudflareContext === 'function') {
      const ctx = cf.getCloudflareContext({ async: false })
      const cs = ctx?.env?.HYPERDRIVE?.connectionString
      if (typeof cs === 'string' && cs.length > 0) {
        __DB_CONNECTION_SOURCE = 'hyperdrive-binding'
        return cs
      }
    }
  } catch {
    // OpenNext 未インストール or per-request context 外 → fallback
  }

  // 2. legacy globalThis 経路
  const hyperdrive = (globalThis as unknown as {
    __BON_LOG_HYPERDRIVE_CONNECTION_STRING__?: string
  }).__BON_LOG_HYPERDRIVE_CONNECTION_STRING__
  if (hyperdrive) {
    __DB_CONNECTION_SOURCE = 'hyperdrive-global'
    return hyperdrive
  }

  // 3. process.env.DATABASE_URL
  if (process.env.DATABASE_URL) {
    __DB_CONNECTION_SOURCE = 'process-env-database-url'
    return process.env.DATABASE_URL
  }

  __DB_CONNECTION_SOURCE = 'dummy'
  return DUMMY_DATABASE_URL
}

/**
 * dummy 判定: build 中の SKIP_DB_CONNECTION=true、または DATABASE_URL 完全欠落、
 * または明示的に dummy URL がセットされている場合。
 *
 * `SKIP_DB_CONNECTION=true` は build phase のみで尊重する。runtime で true でも
 * 無視する (Cloudflare では build/runtime の env vars が同じ source なため誤って
 * runtime まで届いた場合の安全装置)。
 */
function hasHyperdriveBinding(): boolean {
  // 1. globalThis bridge (legacy)
  if ((globalThis as { __BON_LOG_HYPERDRIVE_CONNECTION_STRING__?: string }).__BON_LOG_HYPERDRIVE_CONNECTION_STRING__) {
    return true
  }
  // 2. getCloudflareContext() で env.HYPERDRIVE が存在するか
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cf = require('@opennextjs/cloudflare') as {
      getCloudflareContext?: (opts?: { async?: boolean }) => {
        env?: { HYPERDRIVE?: unknown }
      }
    }
    return !!cf.getCloudflareContext?.({ async: false })?.env?.HYPERDRIVE
  } catch {
    return false
  }
}

function isDummyDatabaseRuntime(): boolean {
  const isBuildPhase = process.env.NEXT_PHASE === NEXT_BUILD_PHASE
  const skipByEnv = isBuildPhase && process.env.SKIP_DB_CONNECTION === 'true'
  return (
    skipByEnv ||
    (!process.env.DATABASE_URL && !hasHyperdriveBinding()) ||
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
/**
 * Cloudflare 公式 Hyperdrive 例 (https://developers.cloudflare.com/hyperdrive/)
 * は pg.Pool ではなく **pg.Client (単一接続)** を使う。pg.Pool は Workers の
 * TCP socket 管理と相性が悪く、複数 connect で timeout を起こす。
 *
 * このクラスは pg.Pool API を mimic しつつ内部では **Worker invocation あたり
 * 1 つの pg.Client** を保持する。@prisma/adapter-pg は pool.connect() → client.release()
 * のパターンで動くため、ここで返す client の release を noop にし接続を再利用させる。
 *
 * Worker instance のライフサイクル終了時に自然に socket もクローズされるため
 * 明示的な end() 呼出は不要 (waitUntil 等で呼んでも良い)。
 */
class SingleClientPool {
  private client: Client | null = null
  private connectPromise: Promise<Client> | null = null

  constructor(private readonly config: ClientConfig) {}

  private async ensureClient(): Promise<Client> {
    if (this.client) return this.client
    if (this.connectPromise) return this.connectPromise
    this.connectPromise = (async () => {
      const c = new Client(this.config)
      await c.connect()
      this.client = c
      this.connectPromise = null
      return c
    })()
    return this.connectPromise
  }

  /** Pool.connect() 互換: 内部の単一 Client を release noop でラップして返す。 */
  async connect(): Promise<PoolClient> {
    const c = await this.ensureClient()
    // Object.create で同じ prototype を継承しつつ release を上書きする。
    // 元の Client の状態 (connected, query queue 等) はそのまま共有される。
    const wrapped = Object.create(Object.getPrototypeOf(c)) as Client & { release?: (err?: Error) => void }
    Object.assign(wrapped, c)
    wrapped.release = () => {
      // noop: 接続は Worker invocation 終了まで維持
    }
    return wrapped as unknown as PoolClient
  }

  /** Pool.query() 互換: 内部 Client で直接 query 実行。 */
  async query(text: string, values?: unknown[]): Promise<unknown> {
    const c = await this.ensureClient()
    return c.query(text, values as never)
  }

  /** Pool.on() 互換: event handler は noop (Pool events を使わない設計)。 */
  on(): this { return this }

  /** Pool.end() 互換: 明示的に Client を閉じる (通常は不要)。 */
  async end(): Promise<void> {
    if (this.client) {
      try { await this.client.end() } catch { /* ignore */ }
      this.client = null
    }
  }
}

let cachedPrisma: PrismaClientType | undefined
function getPrismaClient(): PrismaClientType {
  if (cachedPrisma) return cachedPrisma

  const isDummy = isDummyDatabaseRuntime()
  const connectionString = isDummy ? DUMMY_DATABASE_URL : resolveConnectionString()
  const isLocal = isLocalConnection(connectionString)
  const usingHyperdrive = hasHyperdriveBinding()

  // SSL は次の場合に有効化:
  //  - Hyperdrive 経由でない (Worker → Hyperdrive は内部閉域網のため平文)
  //  - localhost でない (dev は SSL なし)
  //  - production env で dummy でない
  const useSsl = !isDummy && !usingHyperdrive && process.env.NODE_ENV === 'production' && !isLocal

  let pool: PgPoolType
  if (usingHyperdrive) {
    // Plan F: pg.Pool を廃止し SingleClientPool を使う。
    // 並列 connect の競合・idle 切断 / reconnect timeout 問題を一掃。
    pool = new SingleClientPool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: true, ca: getSupabaseCaCert() } : false,
    }) as unknown as PgPoolType
  } else {
    // Node.js (Vercel / dev / vitest) は従来通り pg.Pool を使う。
    pool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: true, ca: getSupabaseCaCert() } : false,
      max: parseInt(process.env.DB_POOL_MAX || String(DB_POOL_MAX_DEFAULT), 10),
      idleTimeoutMillis: DB_POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: DB_POOL_CONNECTION_TIMEOUT_MS,
    })
    pool.on('error', (err) => {
      console.error('[db-pool] error:', err.message)
    })
  }

  // 新 client (PrismaClientCF) は同じ API を持つので legacy 型へキャストして
  // 既存 93 ファイルの import { Prisma, ... } from '@prisma/client' との互換を維持する。
  // Workers ランタイムで /feed の Server Action が hang する原因特定のため
  // 一時的に query log を warn level で有効化する (Phase 5 で error のみに戻す)。
  cachedPrisma = new PrismaClientCF({
    adapter: new PrismaPg(pool),
    log: usingHyperdrive
      ? [{ emit: 'event', level: 'query' }, { emit: 'event', level: 'error' }, { emit: 'event', level: 'warn' }]
      : process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }) as unknown as PrismaClientType

  // Workers: query 完了時に duration とテーブルを warn 出力 (eslint no-console は warn 許容)
  if (usingHyperdrive) {
    interface QueryEvent { query: string; duration: number }
    interface PrismaEventEmitter {
      $on?(event: 'query', cb: (e: QueryEvent) => void): void
      $on(event: string, cb: (e: unknown) => void): void
    }
    const p = cachedPrisma as unknown as PrismaEventEmitter
    if (typeof p.$on === 'function') {
      p.$on('query', (e: QueryEvent) => {
        // SELECT FROM "Post" WHERE ... → table 名のみ抽出
        const m = e.query.match(/(?:from|update|into)\s+["`]?(\w+)["`]?/i)
        const table = m?.[1] ?? '?'
        console.warn(`[prisma-q] ${e.duration}ms ${table}`)
      })
    }
  }

  return cachedPrisma
}

/**
 * 既存呼び出し側 (`import { prisma } from '@/lib/db'` → `prisma.user.findMany(...)`)
 * との後方互換のため Proxy で公開する。プロパティアクセス時に lazy 初期化が走る。
 */
export const prisma = new Proxy({} as PrismaClientType, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrismaClient(), prop, receiver)
  },
}) as PrismaClientType
