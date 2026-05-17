-- public.handle_new_user() は SECURITY DEFINER で `auth.users` INSERT トリガから呼ばれる。
-- ただし PostgREST が /rest/v1/rpc/handle_new_user として anon / authenticated に公開してしまうため、
-- API 経由の権限昇格リスクを塞ぐ。
-- トリガは EXECUTE 権限を持たない呼び出し元からでも fire するため (SECURITY DEFINER + owner 権限で評価) 機能は維持される。

-- 1) PUBLIC / anon / authenticated から EXECUTE を剥奪する。
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- 2) search_path を固定し、未承知 schema による object resolution hijack を防ぐ
--    (Supabase の SECURITY DEFINER ベストプラクティス)。
ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog, public;
