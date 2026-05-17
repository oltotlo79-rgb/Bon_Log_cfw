#!/usr/bin/env node
/**
 * 本番のシードAPI（薬剤以外: ジャンル / 辞典 / 肥料 / ホルモン / ゲスト）を呼び出すスクリプト。
 *
 * 使い方:
 *   node --env-file=.env.local scripts/call-seed-api.mjs [domain]
 *
 *   domain は省略可能で、未指定時は "all"。指定可能値:
 *     genres | dictionary | fertilizer | hormone | guest | all
 *
 * 例:
 *   node --env-file=.env.local scripts/call-seed-api.mjs all
 *   node --env-file=.env.local scripts/call-seed-api.mjs hormone
 *
 * .env.local に SEED_PESTICIDE_SECRET または CRON_SECRET を設定しておけば
 * --env-file で読み込まれる。
 */

const API_URL = 'https://www.bon-log.com/api/admin/seed'
const VALID_DOMAINS = ['genres', 'dictionary', 'fertilizer', 'hormone', 'guest', 'all']

const domain = (process.argv[2] || 'all').trim()
if (!VALID_DOMAINS.includes(domain)) {
  console.error(`Error: Invalid domain "${domain}". Valid: ${VALID_DOMAINS.join(', ')}`)
  process.exit(1)
}

const secret =
  process.env.SEED_PESTICIDE_SECRET?.trim() ||
  process.env.CRON_SECRET?.trim() ||
  process.env.VERCEL_CRON_SECRET?.trim()

if (!secret) {
  console.error('Error: Set SEED_PESTICIDE_SECRET or CRON_SECRET in env (or .env.local with --env-file=.env.local)')
  process.exit(1)
}

async function main() {
  console.log(`Calling production seed API (domain="${domain}")...`)
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ domain }),
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
