-- ============================================================
-- Supabase Advisor 対応: RLS が無効な public テーブルに RLS を有効化
-- 対象: pesticide 系テーブル、email_verification_tokens
-- ポリシー: postgres ロール（Prisma 接続）のみ全操作許可
--         anon/authenticated はアクセス不可（API経由の漏洩防止）
-- ============================================================

-- 参照用・マスタ系（読み取り専用でアプリからのみ利用）
ALTER TABLE public.pesticide_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spreader_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesticide_active_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesticide_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disease_pests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesticides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_ingredients ENABLE ROW LEVEL SECURITY;

-- 機密カラム（token）を含むため API 経由のアクセスを禁止
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- postgres ロール（Prisma の DATABASE_URL で接続するロール）のみ全操作を許可
CREATE POLICY "postgres_only" ON public.pesticide_columns
  FOR ALL TO postgres USING (true) WITH CHECK (true);

CREATE POLICY "postgres_only" ON public.formulation_types
  FOR ALL TO postgres USING (true) WITH CHECK (true);

CREATE POLICY "postgres_only" ON public.spreader_types
  FOR ALL TO postgres USING (true) WITH CHECK (true);

CREATE POLICY "postgres_only" ON public.pesticide_active_ingredients
  FOR ALL TO postgres USING (true) WITH CHECK (true);

CREATE POLICY "postgres_only" ON public.pesticide_effects
  FOR ALL TO postgres USING (true) WITH CHECK (true);

CREATE POLICY "postgres_only" ON public.disease_pests
  FOR ALL TO postgres USING (true) WITH CHECK (true);

CREATE POLICY "postgres_only" ON public.pesticides
  FOR ALL TO postgres USING (true) WITH CHECK (true);

CREATE POLICY "postgres_only" ON public.active_ingredients
  FOR ALL TO postgres USING (true) WITH CHECK (true);

CREATE POLICY "postgres_only" ON public.email_verification_tokens
  FOR ALL TO postgres USING (true) WITH CHECK (true);
