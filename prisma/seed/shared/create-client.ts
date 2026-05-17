/**
 * シードスクリプト共通の PrismaClient ファクトリ。
 *
 * dotenv ロード → Pool → PrismaPg → PrismaClient を一元化し、
 * 各シードファイルでのボイラープレート重複を排除する。
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const dotenv = require('dotenv')
dotenv.config({ path: '.env.local', override: true })
dotenv.config({ path: '.env', override: false })

// localhost フォールバック: .env.local を強制再読み込み
const initialCS = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!initialCS || initialCS.includes('localhost')) {
  const fs = require('fs')
  if (fs.existsSync('.env.local')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env.local'))
    for (const k in envConfig) {
      process.env[k] = envConfig[k]
    }
  }
}
/* eslint-enable @typescript-eslint/no-require-imports */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

/**
 * シード用 PrismaClient を生成する。
 *
 * 接続文字列の優先順位:
 * - **Vercel サーバレス環境** (`process.env.VERCEL === '1'`):
 *   `DATABASE_URL`（pgBouncer pooler）→ `DIRECT_URL` の順で解決する。
 *   Vercel 関数は IPv6 を持たず Supabase の direct connection
 *   (`db.<ref>.supabase.co`) に到達できないため、必ず pooler を使う。
 * - **ローカル / 通常の Node.js 環境**:
 *   `DIRECT_URL` → `DATABASE_URL` の順。マイグレーション・大量シードでは
 *   pooler のトランザクションモード制約を避けるため direct を優先する。
 */
export function createSeedPrismaClient(): PrismaClient {
  const isVercel = process.env.VERCEL === '1'
  const connectionString = isVercel
    ? process.env.DATABASE_URL || process.env.DIRECT_URL
    : process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL or DIRECT_URL is not set')
  }
  console.log(
    'Using Connection String (masked):',
    connectionString.replace(/:\/\/.*@/, '://***:***@'),
    isVercel ? '[Vercel: DATABASE_URL preferred]' : '[Local: DIRECT_URL preferred]',
  )
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}
