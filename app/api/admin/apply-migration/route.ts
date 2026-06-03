/**
 * 緊急時用の管理者向けマイグレーション適用 API。
 *
 * 標準フローは `npx prisma migrate deploy`。本 API は本番 DATABASE_URL を手元に持たない
 * 運用時の代替経路として、Vercel 関数経由で本番 DB に allowlist 制限付きの DDL を
 * 適用するためのものである。
 *
 * 認証 / 認可:
 * - Authorization: Bearer <ADMIN_MIGRATION_SECRET> (専用 secret 必須、未設定なら常に 401)
 * - production では `SEED_ALLOWED_IPS` が必須 (`lib/api/seed-auth.ts`)
 *
 * 入力安全性:
 * - 適用可能な migration 名は `MIGRATIONS` allowlist のみ。任意 SQL の流入は不可。
 * - 各 SQL は `IF NOT EXISTS` / `DROP IF EXISTS` で冪等。再実行しても安全。
 * - `_prisma_migrations` への登録はしない。後日 `prisma migrate deploy` を実行した際、
 *   IF NOT EXISTS のため SQL 自体は無害に再実行され、正式に履歴が登録される。
 *
 * 監査:
 * - 開始 / 成功 / 失敗の各フェーズで requestId, migration 名, clientIp を構造化ログに残す。
 * - 運用完了後は `ADMIN_MIGRATION_SECRET` を env から削除して endpoint を実質無効化する。
 *
 * リクエスト例:
 *   curl -X POST -H "Authorization: Bearer SECRET" \
 *        -H "Content-Type: application/json" \
 *        -d '{"migration":"add_daily_visitors"}' \
 *        https://www.bon-log.com/api/admin/apply-migration
 */

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/db'
import { ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { authorizeMigrationRequest, getClientIp, seedErrorResponse } from '@/lib/api/seed-auth'

export const dynamic = 'force-dynamic'

/** 小規模 DDL は通常数秒で完了するが Vercel の 60 秒上限を許可する。 */
export const maxDuration = 60

/**
 * 適用可能な migration 名のタプル。
 * `as const` を付けて z.enum に渡せるリテラル union として保持し、
 * 任意 SQL の流入を型レベルで防ぐ。
 *
 * 各エントリの SQL は順次実行される。すべて冪等な書き方
 * (`IF NOT EXISTS` / `DROP IF EXISTS` / `REVOKE` 等) で複数回適用しても安全。
 */
const MIGRATION_NAMES = [
  'add_daily_visitors',
  'lock_handle_new_user_security',
  'add_rls_policies_bonsai_care_logs_daily_visitors',
  'revoke_data_api_grants_from_public',
] as const
type MigrationName = typeof MIGRATION_NAMES[number]

const MIGRATIONS: Record<MigrationName, readonly string[]> = {
  add_daily_visitors: [
    `CREATE TABLE IF NOT EXISTS "daily_visitors" (
      "id" TEXT NOT NULL,
      "date" DATE NOT NULL,
      "visitor_id" VARCHAR(64) NOT NULL,
      "user_id" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "daily_visitors_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "daily_visitors_date_visitor_id_key"
      ON "daily_visitors"("date", "visitor_id")`,
    `CREATE INDEX IF NOT EXISTS "daily_visitors_date_idx"
      ON "daily_visitors"("date")`,
    `CREATE INDEX IF NOT EXISTS "daily_visitors_user_id_idx"
      ON "daily_visitors"("user_id")`,
    `DO $$ BEGIN
      ALTER TABLE "daily_visitors"
        ADD CONSTRAINT "daily_visitors_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$`,
    `ALTER TABLE public.daily_visitors ENABLE ROW LEVEL SECURITY`,
  ],
  // public.handle_new_user() は auth.users INSERT トリガから SECURITY DEFINER で
  // 呼ばれる前提。ただし PostgREST が /rest/v1/rpc/handle_new_user として anon /
  // authenticated に露出してしまうため API 経由の権限昇格を塞ぐ。
  // トリガは function owner 権限で動くため REVOKE しても継続動作する。
  // search_path 固定で SECURITY DEFINER の object resolution hijack も併せて防ぐ。
  lock_handle_new_user_security: [
    `REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC`,
    `REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon`,
    `REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated`,
    `ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog, public`,
  ],
  // bonsai_care_logs / daily_visitors は RLS 有効だがポリシー未定義で advisor 警告。
  // 既存規約 (postgres_only) に揃え、anon / authenticated アクセスを引き続き拒否しつつ
  // Prisma (postgres ロール) からは全権限を持つ。DO ブロックで再適用安全。
  add_rls_policies_bonsai_care_logs_daily_visitors: [
    `DO $$ BEGIN
      CREATE POLICY "postgres_only" ON public.bonsai_care_logs
        FOR ALL TO postgres USING (true) WITH CHECK (true);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$`,
    `DO $$ BEGIN
      CREATE POLICY "postgres_only" ON public.daily_visitors
        FOR ALL TO postgres USING (true) WITH CHECK (true);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$`,
  ],
  // Supabase Data API (PostgREST / GraphQL / supabase-js) への露出を public schema 全体で
  // 遮断する。本プロジェクトは Data API を一切使用しない方針 (Prisma の postgres ロール接続のみ)。
  // 旧デフォルトで anon / authenticated に GRANT ALL されていた状態を剥がし、ALTER DEFAULT
  // PRIVILEGES で今後新規作成されるテーブル等にも自動付与されないようにする。
  // pg_roles 存在チェック付きでローカル Docker postgres でも noop で安全に通る。
  revoke_data_api_grants_from_public: [
    `DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
        REVOKE ALL ON ALL ROUTINES  IN SCHEMA public FROM anon;
        REVOKE USAGE ON SCHEMA public FROM anon;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON ROUTINES  FROM anon;
      END IF;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM authenticated;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
        REVOKE ALL ON ALL ROUTINES  IN SCHEMA public FROM authenticated;
        REVOKE USAGE ON SCHEMA public FROM authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON ROUTINES  FROM authenticated;
      END IF;
    END $$`,
  ],
}

const requestSchema = z.object({
  migration: z.enum(MIGRATION_NAMES),
})

export async function POST(request: NextRequest) {
  const denied = authorizeMigrationRequest(request)
  if (denied) return denied

  const requestId = randomUUID()
  const clientIp = getClientIp(request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: ERR_INVALID_INPUT, requestId }, { status: 400 })
  }
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: ERR_INVALID_INPUT, available: MIGRATION_NAMES, requestId },
      { status: 400 },
    )
  }
  const { migration } = parsed.data
  const statements = MIGRATIONS[migration]

  logger.info('[Admin] Migration started', { requestId, migration, clientIp, statementCount: statements.length })

  const executed: number[] = []
  try {
    // SAFETY: $executeRawUnsafe は SQL インジェクションのリスクがあるが、
    // 入力は MIGRATIONS allowlist 内のハードコード SQL のみ。Bearer 認証 +
    // IP allowlist でも保護されている。
    for (const sql of statements) {
      await prisma.$executeRawUnsafe(sql)
      executed.push(executed.length)
    }
    logger.info('[Admin] Migration applied', {
      requestId,
      migration,
      clientIp,
      statementCount: executed.length,
    })
    return NextResponse.json({ success: true, migration, statementCount: executed.length, requestId })
  } catch (error) {
    return seedErrorResponse('Migration', error, {
      requestId,
      migration,
      clientIp,
      executedStatementIndices: executed,
    })
  }
}
