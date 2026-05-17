-- PostgreSQL全文検索インデックス設定
-- 使用する検索モードに応じて適切なセクションを実行してください

-- ============================================
-- pg_trgm (推奨: Azure等のクラウドDB対応)
-- ============================================

-- 1. 拡張機能を有効化
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 類似度検索の閾値設定（0.0〜1.0、低いほど緩い）
SELECT set_limit(0.1);

-- 3. GINインデックスを作成
CREATE INDEX IF NOT EXISTS posts_content_trgm_idx
ON posts USING gin (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS users_nickname_trgm_idx
ON users USING gin (nickname gin_trgm_ops);

CREATE INDEX IF NOT EXISTS users_bio_trgm_idx
ON users USING gin (bio gin_trgm_ops);


-- ============================================
-- pg_bigm (日本語最適: ローカル/自前サーバー向け)
-- ============================================
-- 注意: pg_bigmは別途インストールが必要です
-- https://pgbigm.osdn.jp/

-- 1. 拡張機能を有効化（インストール済みの場合）
-- CREATE EXTENSION IF NOT EXISTS pg_bigm;

-- 2. GINインデックスを作成
-- CREATE INDEX IF NOT EXISTS posts_content_bigm_idx
-- ON posts USING gin (content gin_bigm_ops);

-- CREATE INDEX IF NOT EXISTS users_nickname_bigm_idx
-- ON users USING gin (nickname gin_bigm_ops);

-- CREATE INDEX IF NOT EXISTS users_bio_bigm_idx
-- ON users USING gin (bio gin_bigm_ops);


-- ============================================
-- インデックス確認クエリ
-- ============================================
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('posts', 'users');


-- ============================================
-- インデックス削除（必要に応じて）
-- ============================================
-- DROP INDEX IF EXISTS posts_content_trgm_idx;
-- DROP INDEX IF EXISTS users_nickname_trgm_idx;
-- DROP INDEX IF EXISTS users_bio_trgm_idx;
-- DROP INDEX IF EXISTS posts_content_bigm_idx;
-- DROP INDEX IF EXISTS users_nickname_bigm_idx;
-- DROP INDEX IF EXISTS users_bio_bigm_idx;
