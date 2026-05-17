/**
 * Prisma + PostgreSQL 接続のシングルトン管理
 *
 * - 開発環境: グローバル変数でホットリロード時の接続リーク防止
 * - 本番環境: Serverless向けプールサイズ制限（DB_POOL_MAX, デフォルト5）
 * - CI/テスト: ダミーURL検出時はPool作成をスキップ
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

const globalForPrisma = global as unknown as { prisma: PrismaClient }

/**
 * CI/テスト/ビルド環境判定: DATABASE_URLが未設定またはダミーの場合は実接続しない。
 *
 * SKIP_DB_CONNECTION=true（明示的フラグ）またはダミーURL完全一致で判定。
 * 従来の `.includes('dummy')` は正規URLにdummyを含むテーブル名等で誤判定する恐れがあったため廃止。
 */
const DUMMY_DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy'
const isDummyDatabase =
  process.env.SKIP_DB_CONNECTION === 'true' ||
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL === DUMMY_DATABASE_URL

/** Supabase CA証明書をBase64環境変数からデコード（Vercel serverless対応） */
const supabaseCaCert = process.env.SUPABASE_CA_CERT
  ? Buffer.from(process.env.SUPABASE_CA_CERT, 'base64').toString('utf-8')
  : undefined

/**
 * ローカル接続（localhost/127.0.0.1）ではSSLを要求しない。
 * `next build` が NODE_ENV=production を設定してもローカルDB（Docker Postgres 等）で
 * ビルドが通るよう、ホスト名ベースで判定する（Supabase等のリモートDBは必ずSSL必須）。
 */
const isLocalDatabase = (() => {
  const url = process.env.DATABASE_URL
  if (!url) return false
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
})()

/**
 * ダミー/未設定時でもPrismaClient初期化を成功させるため、
 * engineType="client"では常にアダプターが必要。
 * DATABASE_URL未設定時はlocalhostへのダミーPoolを作成する（実際の接続はクエリ時に発生）。
 */
const pool = new Pool({
  connectionString: isDummyDatabase
    ? 'postgresql://dummy:dummy@localhost:5432/dummy'
    : process.env.DATABASE_URL,
  // 本番(リモートDB): CA証明書による完全なSSL検証（MITM防止）
  // SUPABASE_CA_CERT 未設定時は rejectUnauthorized:true + ca:undefined → 接続失敗（fail-closed）
  // ローカルDB(localhost)は NODE_ENV=production であってもSSLを強制しない
  ssl: (!isDummyDatabase && process.env.NODE_ENV === 'production' && !isLocalDatabase)
    ? { rejectUnauthorized: true, ca: supabaseCaCert }
    : false,
  // Serverless環境（Vercel）では同時接続が急増しやすいため、
  // プールサイズを制限してSupabaseの接続上限を保護する
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
