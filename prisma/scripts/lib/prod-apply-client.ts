/* eslint-disable no-console */
/**
 * @module prisma/scripts/lib/prod-apply-client
 *
 * 本番 DB へのワンショット適用スクリプト（`prisma/scripts/apply-*.ts`）が共通で使う
 * 接続解決ロジック。誤って `.env.local`（ローカル DB）に接続してしまう事故や、
 * プーリング接続と非プーリング接続の優先順位を取り違える事故を防ぐために、
 * 一度確立した安全なロジックを single source of truth として集約する。
 *
 * 接続解決の優先順位（`resolveConnectionString` 内で確定）:
 * 1. シェルの環境変数 `DIRECT_URL` / `DATABASE_URL`（dotenv ロードより前に退避して最優先扱いする）
 * 2. `.env.production` に記載された `DIRECT_URL` / `DATABASE_URL`（`override: false` でロード）
 * 3. いずれも無ければ fail-closed でエラーを throw する
 *
 * `DIRECT_URL` と `DATABASE_URL` が両方存在する場合は `DIRECT_URL`（非プーリング）を優先する。
 * ワンショットスクリプトは prepared statement を使うため、PgBouncer 等のトランザクション
 * プーリング経由だと衝突する可能性があるため。
 *
 * `.env.local` は意図的に読み込まない。ローカル開発用の DB 接続情報が紛れ込み、
 * 本番のつもりでローカル DB を書き換えてしまう事故を防ぐため。
 */

import { existsSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const ENV_PRODUCTION_PATH = '.env.production'

// dotenv ロードより前にシェル由来の値を退避する。dotenv 側は override:false のため
// 理論上はシェル値を上書きしないが、本番誤接続を防ぐ最優先ルールを dotenv の内部挙動に
// 依存させないための明示的な保険。どちらのソースを使ったか表示するためにも使う。
const shellDatabaseUrl = process.env.DATABASE_URL
const shellDirectUrl = process.env.DIRECT_URL

const envProductionExists = existsSync(ENV_PRODUCTION_PATH)

if (envProductionExists) {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const dotenv = require('dotenv')
  dotenv.config({ path: ENV_PRODUCTION_PATH, override: false })
  /* eslint-enable @typescript-eslint/no-require-imports */
}

export interface ConnectionResolution {
  connectionString: string
  variableName: 'DIRECT_URL' | 'DATABASE_URL'
  source: 'shell' | typeof ENV_PRODUCTION_PATH
}

/**
 * 接続文字列を解決する。`DIRECT_URL` を優先し、シェル環境変数を `.env.production` より優先する。
 * どちらも見つからない場合は fail-closed でエラーを throw する（黙って undefined を返さない）。
 */
export function resolveConnectionString(): ConnectionResolution {
  const directUrl = process.env.DIRECT_URL
  const databaseUrl = process.env.DATABASE_URL

  if (!directUrl && !databaseUrl) {
    if (!envProductionExists) {
      throw new Error(
        `本番接続情報が見つかりません。${ENV_PRODUCTION_PATH} が存在しません。作成して DATABASE_URL / DIRECT_URL を設定してください。`,
      )
    }
    throw new Error(
      `本番接続情報が見つかりません。${ENV_PRODUCTION_PATH} に DATABASE_URL / DIRECT_URL を設定してください。`,
    )
  }

  if (directUrl) {
    return {
      connectionString: directUrl,
      variableName: 'DIRECT_URL',
      source: shellDirectUrl ? 'shell' : ENV_PRODUCTION_PATH,
    }
  }

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      variableName: 'DATABASE_URL',
      source: shellDatabaseUrl ? 'shell' : ENV_PRODUCTION_PATH,
    }
  }

  // 上の guard で !directUrl && !databaseUrl は throw 済みのため到達しないが、
  // 型ガードによる絞り込みのみで解決し `as` キャストを避けるために明示しておく
  throw new Error(
    `本番接続情報が見つかりません。${ENV_PRODUCTION_PATH} に DATABASE_URL / DIRECT_URL を設定してください。`,
  )
}

/** 接続文字列のユーザー情報部分（`user:password@`）をマスクして表示用に整形する。 */
export function maskConnectionString(connectionString: string): string {
  return connectionString.replace(/:\/\/.*@/, '://***:***@')
}

/**
 * 解決した接続先で `PrismaClient` を組み立てる。生成前に「接続先 (masked)」と
 * 使用した環境変数名・読込元を必ず 1 行ログ出力する（実行者が目視確認できるようにするため）。
 */
export function createProdApplyClient(): PrismaClient {
  const resolved = resolveConnectionString()
  console.log(
    `接続先 (masked): ${maskConnectionString(resolved.connectionString)}  [${resolved.variableName}, from ${resolved.source === 'shell' ? 'シェル環境変数' : resolved.source}]`,
  )
  const pool = new Pool({ connectionString: resolved.connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

/** `--apply` フラグの有無を判定する。無指定・その他フラグは常に dry-run（安全側）。 */
export function isApplyMode(argv: string[] = process.argv): boolean {
  return argv.includes('--apply')
}

/** Direct 接続が届かない環境向けの定型ヒントを表示する（接続失敗時の catch で呼ぶ）。 */
export function printConnectionFailureHint(): void {
  console.error(
    'ヒント: Direct 接続（db.<ref>.supabase.co）は IPv4 環境から届かないことがある。' +
      'その場合は Supabase の Session pooler（Transaction pooler は不可）の接続文字列を ' +
      'DATABASE_URL/DIRECT_URL に使うとよい。',
  )
}
