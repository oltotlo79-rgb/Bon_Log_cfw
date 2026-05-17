-- PostgreSQL pg_trgm拡張を有効化（全文検索用）
-- Supabaseでは標準で利用可能
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ================================================================
-- 投稿検索用GINインデックス
-- ================================================================

-- 投稿内容の全文検索インデックス
CREATE INDEX IF NOT EXISTS posts_content_trgm_idx
ON posts USING gin (content gin_trgm_ops);

-- ================================================================
-- ユーザー検索用GINインデックス
-- ================================================================

-- ニックネームの全文検索インデックス
CREATE INDEX IF NOT EXISTS users_nickname_trgm_idx
ON users USING gin (nickname gin_trgm_ops);

-- 自己紹介の全文検索インデックス
CREATE INDEX IF NOT EXISTS users_bio_trgm_idx
ON users USING gin (bio gin_trgm_ops);

-- ================================================================
-- 盆栽園検索用GINインデックス
-- ================================================================

-- 盆栽園名の全文検索インデックス
CREATE INDEX IF NOT EXISTS bonsai_shops_name_trgm_idx
ON bonsai_shops USING gin (name gin_trgm_ops);

-- 住所の全文検索インデックス
CREATE INDEX IF NOT EXISTS bonsai_shops_address_trgm_idx
ON bonsai_shops USING gin (address gin_trgm_ops);

-- ================================================================
-- イベント検索用GINインデックス
-- ================================================================

-- イベントタイトルの全文検索インデックス
CREATE INDEX IF NOT EXISTS events_title_trgm_idx
ON events USING gin (title gin_trgm_ops);

-- イベント説明の全文検索インデックス
CREATE INDEX IF NOT EXISTS events_description_trgm_idx
ON events USING gin (description gin_trgm_ops);

-- ================================================================
-- 盆栽（成長記録）検索用GINインデックス
-- ================================================================

-- 盆栽名の全文検索インデックス
CREATE INDEX IF NOT EXISTS bonsais_name_trgm_idx
ON bonsais USING gin (name gin_trgm_ops);

-- 樹種の全文検索インデックス
CREATE INDEX IF NOT EXISTS bonsais_species_trgm_idx
ON bonsais USING gin (species gin_trgm_ops);

-- 説明の全文検索インデックス
CREATE INDEX IF NOT EXISTS bonsais_description_trgm_idx
ON bonsais USING gin (description gin_trgm_ops);

-- ================================================================
-- ハッシュタグ検索用GINインデックス
-- ================================================================

-- ハッシュタグ名の全文検索インデックス
CREATE INDEX IF NOT EXISTS hashtags_name_trgm_idx
ON hashtags USING gin (name gin_trgm_ops);

-- ================================================================
-- コメント検索用GINインデックス（将来的な拡張用）
-- ================================================================

-- コメント内容の全文検索インデックス
CREATE INDEX IF NOT EXISTS comments_content_trgm_idx
ON comments USING gin (content gin_trgm_ops);
