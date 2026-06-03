#!/usr/bin/env node
/**
 * 本番のマイグレーション適用 API を呼び出すスクリプト。
 *
 * 使い方:
 *   npm run db:apply-migration-production -- <migration-name>
 *   または
 *   node --env-file=.env.local scripts/call-apply-migration-api.mjs <migration-name>
 *
 *   例:
 *     npm run db:apply-migration-production -- add_daily_visitors
 *
 * .env.local に ADMIN_MIGRATION_SECRET を設定しておく。
 * (route 側は ADMIN_MIGRATION_SECRET 専用 = seed/cron secret 漏洩経路から DDL を遮断するため)
 */

const API_URL = 'https://www.bon-log.com/api/admin/apply-migration'

const migration = process.argv[2]
if (!migration) {
  console.error('Error: migration name required.')
  console.error('Usage: npm run db:apply-migration-production -- <migration-name>')
  process.exit(1)
}

const secret = process.env.ADMIN_MIGRATION_SECRET?.trim()

if (!secret) {
  console.error('Error: Set ADMIN_MIGRATION_SECRET in .env.local')
  console.error('(本番 Vercel と同じ値を使用すること。seed/cron secret では認証不可)')
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
