#!/usr/bin/env node
/**
 * 本番のマイグレーション適用 API を呼び出すスクリプト。
 *
 * 使い方:
 *   node --env-file=.env.local scripts/call-apply-migration-api.mjs <migration-name>
 *
 *   例:
 *     node --env-file=.env.local scripts/call-apply-migration-api.mjs add_daily_visitors
 *
 * .env.local に SEED_PESTICIDE_SECRET または CRON_SECRET を設定しておく。
 */

const API_URL = 'https://www.bon-log.com/api/admin/apply-migration'

const migration = process.argv[2]
if (!migration) {
  console.error('Error: migration name required.')
  console.error('Usage: node --env-file=.env.local scripts/call-apply-migration-api.mjs <migration-name>')
  process.exit(1)
}

const secret =
  process.env.SEED_PESTICIDE_SECRET?.trim() ||
  process.env.CRON_SECRET?.trim() ||
  process.env.VERCEL_CRON_SECRET?.trim()

if (!secret) {
  console.error('Error: Set SEED_PESTICIDE_SECRET or CRON_SECRET in .env.local')
  process.exit(1)
}

async function main() {
  console.log(`Applying migration "${migration}" to production...`)
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ migration }),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error('API error:', res.status, text)
    process.exit(1)
  }
  console.log('OK', res.status, text)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
