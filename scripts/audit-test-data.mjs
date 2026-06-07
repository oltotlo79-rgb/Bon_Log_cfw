/**
 * @module scripts/audit-test-data
 *
 * 本番 DB に残っているテスト用データを READ-ONLY で監査する。削除はしない。
 * 使い方: node --env-file=.env.local scripts/audit-test-data.mjs
 */
import pg from 'pg'

const { Client } = pg
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.error('DIRECT_URL / DATABASE_URL が未設定')
  process.exit(1)
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

const TEST_RE = `(e2e|テスト|test|サンプル|sample|demo|ダミー|dummy|あいうえお|aaa|test1|テスト1)`

async function q(label, sql, params = []) {
  const r = await client.query(sql, params)
  console.log(`\n===== ${label} (${r.rowCount}) =====`)
  for (const row of r.rows) console.log(JSON.stringify(row))
  return r.rows
}

async function main() {
  await client.connect()

  console.log('## 全件カウント')
  const counts = await client.query(`
    select 'users' t, count(*) from users
    union all select 'bonsai_shops', count(*) from bonsai_shops
    union all select 'events', count(*) from events
    union all select 'posts', count(*) from posts
    union all select 'shop_reviews', count(*) from shop_reviews
    union all select 'bonsai', count(*) from bonsais
    union all select 'shop_change_requests', count(*) from shop_change_requests
    order by t`)
  for (const row of counts.rows) console.log(`${row.t}: ${row.count}`)

  // 盆栽園は全件出す（本番では少数のはず）
  await q('bonsai_shops (ALL)', `
    select id, name, address, created_by, created_at
    from bonsai_shops order by created_at`)

  await q('bonsai_shops matching test pattern', `
    select id, name, address, created_by, created_at
    from bonsai_shops where name ~* $1 or address ~* $1 order by created_at`, [TEST_RE])

  await q('events created_by IS NULL (orphaned)', `
    select count(*) from events where created_by is null`)

  await q('users matching test pattern', `
    select id, email, nickname, created_at
    from users where nickname ~* $1 or email ~* $1 order by created_at`, [TEST_RE])

  await q('events matching test pattern', `
    select id, title, created_by, created_at
    from events where title ~* $1 order by created_at`, [TEST_RE])

  await q('posts matching test pattern (first 30)', `
    select id, user_id, left(content, 40) content, created_at
    from posts where content ~* $1 order by created_at limit 30`, [TEST_RE])

  await q('shop_reviews matching test pattern', `
    select id, shop_id, user_id, left(content, 40) content, created_at
    from shop_reviews where content ~* $1 order by created_at`, [TEST_RE])

  await q('bonsai matching test pattern', `
    select id, user_id, name, species, created_at
    from bonsais where name ~* $1 order by created_at`, [TEST_RE])

  await client.end()
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
