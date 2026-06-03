-- Supabase Data API (PostgREST / GraphQL / supabase-js) への露出を public schema 全体で遮断する。
--
-- 背景:
--   本プロジェクトは Supabase Data API を一切使用しない方針 (DB アクセスは Prisma の
--   postgres ロール経由のみ)。ただし Supabase の旧デフォルトで public schema の全テーブル
--   が anon / authenticated に GRANT ALL 状態であり、anon key 流出時に全データ R/W
--   される攻撃面が残っていた。Dashboard 側で Exposed schemas/tables は 0 化済みだが、
--   Defense in Depth として DB 側の grant 自体も剥がす。
--
-- 注意点:
--   - anon / authenticated は Supabase 固有のロール。ローカル Docker postgres には存在
--     しないため、`pg_roles` で存在チェックして無ければ noop にする (DO block の IF EXISTS)。
--   - ALTER DEFAULT PRIVILEGES FOR ROLE postgres ... は、postgres ロールが今後作成する
--     新規オブジェクトに対する自動 grant を抑止する (= prisma migrate で新テーブルを作っても
--     anon/authenticated に grant されない)。
--   - 既存の RLS ポリシー (postgres_only on bonsai_care_logs / daily_visitors) は影響なし、
--     補強される側になる。
--   - Prisma は postgres ロールで接続するためアプリ機能は無影響。

DO $$
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
END $$;
