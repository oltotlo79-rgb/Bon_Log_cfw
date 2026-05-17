-- ============================================================
-- Supabase Advisor 対応: public スキーマのテーブルに RLS を有効化
-- 対象: active_ingredients, disease_pests, email_verification_tokens,
--       formulation_types, pesticide_active_ingredients, pesticide_columns,
--       pesticide_effects, pesticides, spreader_types
-- 注意: 20260228100000 は農薬テーブル作成より前のため本番で未適用の可能性あり。
--       本マイグレーションはテーブル作成後に実行されるため確実に適用される。
-- 冪等: 既に RLS 有効・ポリシーありの環境でもエラーにしない。
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'active_ingredients', 'disease_pests', 'email_verification_tokens',
    'formulation_types', 'pesticide_active_ingredients', 'pesticide_columns',
    'pesticide_effects', 'pesticides', 'spreader_types'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- 既存ポリシーは削除してから作成（冪等）。postgres ロールのみ全操作許可。
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'active_ingredients', 'disease_pests', 'email_verification_tokens',
    'formulation_types', 'pesticide_active_ingredients', 'pesticide_columns',
    'pesticide_effects', 'pesticides', 'spreader_types'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "postgres_only" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_app_postgres" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "allow_app_postgres" ON public.%I FOR ALL TO postgres USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;
