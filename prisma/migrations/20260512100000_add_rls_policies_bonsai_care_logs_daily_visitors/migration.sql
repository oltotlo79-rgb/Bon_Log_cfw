-- bonsai_care_logs / daily_visitors は RLS 有効だがポリシー未定義のため
-- anon / authenticated からのアクセスは事実上全て拒否される一方、
-- Supabase の advisor が「RLS Enabled No Policy」として警告を出す。
--
-- 本プロジェクトは Prisma 経由 (postgres ロール) でのみ書き込み/読み出しを行う設計のため、
-- 既存規約 (20260225_add_rls_policies_and_fk_indexes 等) に揃えて
-- `postgres_only` ポリシーで明示する。anon / authenticated 由来の
-- /rest/v1/<table> へのアクセスは引き続き全件拒否される。

-- bonsai_care_logs: ユーザーごとのカレンダー専用メモ。サーバー側 (Server Action) でのみ書き込み。
DO $$ BEGIN
  CREATE POLICY "postgres_only" ON public.bonsai_care_logs
    FOR ALL TO postgres USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- daily_visitors: 日次の実訪問者ログ。/api/analytics/track からのみサーバー側で upsert。
DO $$ BEGIN
  CREATE POLICY "postgres_only" ON public.daily_visitors
    FOR ALL TO postgres USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
