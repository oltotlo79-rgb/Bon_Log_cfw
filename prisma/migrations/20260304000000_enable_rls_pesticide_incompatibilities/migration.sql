-- ============================================================
-- Supabase Advisor 対応: public.pesticide_incompatibilities に RLS を有効化
-- 冪等: 既に RLS 有効・ポリシーありの環境でもエラーにしない。
-- ============================================================

DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.pesticide_incompatibilities'::regclass) THEN
    ALTER TABLE public.pesticide_incompatibilities ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "postgres_only" ON public.pesticide_incompatibilities;
  DROP POLICY IF EXISTS "allow_app_postgres" ON public.pesticide_incompatibilities;
  CREATE POLICY "allow_app_postgres" ON public.pesticide_incompatibilities
    FOR ALL TO postgres USING (true) WITH CHECK (true);
END $$;
