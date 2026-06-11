---
name: prod-db-and-test-data
description: How to access the production DB for Bon_Log_cfw, the Supabase-MCP pitfall, and the 2026-06-07 E2E test-data cleanup
metadata:
  type: project
---

**Production DB access for `Bon_Log_cfw`:** the prod Postgres is the Supabase project **`yxwmnimyzcmseshtittp`** (matches `NEXT_PUBLIC_SUPABASE_URL` in fly `[build.args]`). Connect via `.env.local` `DATABASE_URL` (pgbouncer `:6543`) / `DIRECT_URL` (`:5432`, use this for scripts) — same creds fly uses. See [[flyio-deployment]].

**PITFALL: the connected Supabase MCP points at a DIFFERENT project** (`sfyeazvigsomjhuhemjf`), NOT production. `mcp__supabase__*` (execute_sql/list_tables) therefore query the WRONG database — do NOT use them to inspect/modify prod. Use a `node --env-file=.env.local` script with the `pg` package instead (pure JS, works on this ARM-Windows machine where `tsx`/Prisma/esbuild native binaries are blocked by WDAC Application Control). Example tool kept in repo: `scripts/audit-test-data.mjs` (read-only prod audit by test-name regex).

**E2E-against-prod left orphaned test data (cleaned 2026-06-07):** on 2026-05-25/26, E2E ran against PRODUCTION ~49× and created `bonsai_shops.name='E2E用テスト盆栽園'` (address 東京都渋谷区1-2-3) + `events.title='E2E用テストイベント'` each run. The prod user-cleanup script then deleted the E2E users, but `events.created_by` / `bonsai_shops.created_by` are `onDelete: SetNull`, so the content was orphaned (created_by=null) and survived — visible on `/shops`. User-owned content (posts/bonsai/comments) is `onDelete: Cascade` so it died with the user; only event/shop survived. Deleted 49+49 (+49 shop_genres cascaded) via a pg script after JSON backup; the 147→98 remaining shops are all REAL nurseries (大樹園 etc.), do not touch.

**Prevention (committed):** `scripts/delete-e2e-users-production.ts` now also `deleteMany`s the E2E shop/event by exact name BEFORE deleting users. E2E normally targets localhost only (`playwright.config.ts` `baseURL: 'http://localhost:3000'`; `prisma/seed.ts` gates E2E seed on `isLocalDb`) — the incident came from running E2E/seed against prod manually. Re-audit anytime: `node --env-file=.env.local scripts/audit-test-data.mjs`. Prod-data backups are written as `e2e-prod-data-backup-*.json` (gitignored — contains PII).
