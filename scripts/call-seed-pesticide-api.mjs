#!/usr/bin/env node
/**
 * 本番の薬剤シードAPIを呼び出すスクリプト。
 * 使い方:
 *   node --env-file=.env.local scripts/call-seed-pesticide-api.mjs
 *   または
 *   SEED_PESTICIDE_SECRET=xxx node scripts/call-seed-pesticide-api.mjs
 *   CRON_SECRET=xxx node scripts/call-seed-pesticide-api.mjs
 *
 * .env.local に SEED_PESTICIDE_SECRET または CRON_SECRET を設定しておけば --env-file で読み込まれる。
 */

const API_URL = 'https://www.bon-log.com/api/admin/seed-pesticide'

const secret =
  process.env.SEED_PESTICIDE_SECRET?.trim() ||
  process.env.CRON_SECRET?.trim() ||
  process.env.VERCEL_CRON_SECRET?.trim()

if (!secret) {
  console.error('Error: Set SEED_PESTICIDE_SECRET or CRON_SECRET in env (or .env.local with --env-file=.env.local)')
  process.exit(1)
}

async function main() {
  console.log('Calling production seed API...')
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
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
