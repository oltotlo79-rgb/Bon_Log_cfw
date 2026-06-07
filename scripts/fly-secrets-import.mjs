/**
 * @module scripts/fly-secrets-import
 *
 * `.env.local` を fly secrets へ一括投入する。
 *
 * Why a script instead of `fly secrets import`:
 *   `fly secrets import` は行単位パースのため、BOM 付き UTF-8・日本語コメント行・
 *   クォート付き値・複数行値（SUPABASE_CA_CERT 等の PEM）を扱えず失敗する。
 *   dotenv はこれらを正しく解釈できるため、parse 結果を fly に渡す。
 *
 * 値は表示しない（キー名のみ出力）。
 *
 * 使い方: node scripts/fly-secrets-import.mjs
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { parse } from 'dotenv'

const ENV_FILE = '.env.local'
const APP_URL = process.env.FLY_APP_URL || 'https://www.bon-log.com'

const parsed = parse(readFileSync(ENV_FILE))
const keys = Object.keys(parsed)
if (keys.length === 0) {
  console.error(`No variables parsed from ${ENV_FILE}`)
  process.exit(1)
}

// Vercel 用だった URL を fly 用へ上書き（サーバー側参照と整合させる）。
parsed.NEXTAUTH_URL = APP_URL
parsed.NEXT_PUBLIC_APP_URL = APP_URL

const flyExe = join(process.env.USERPROFILE, '.fly', 'bin', 'fly.exe')

// 各 KEY=VALUE を argv 要素として渡す。shell を介さないため改行・記号を含む値
// (PEM 証明書など) もエスケープ事故なく安全に渡せる。--stage で deploy を抑止。
const pairs = Object.keys(parsed).map((k) => `${k}=${parsed[k]}`)
const args = ['secrets', 'set', '--stage', ...pairs]

console.log(`Setting ${pairs.length} secrets to fly (app from fly.toml):`)
console.log(Object.keys(parsed).join(', '))

execFileSync(flyExe, args, { stdio: 'inherit' })
console.log('\nDone. 反映は次の `fly deploy` 時。確認: fly secrets list')
