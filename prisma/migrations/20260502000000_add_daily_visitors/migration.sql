-- ============================================================
-- daily_visitors テーブルと RLS の追加
-- ============================================================
--
-- 目的: 管理者ダッシュボードの「過去 30 日のアクセス推移」を、ユーザー操作ベース
-- ではなく実訪問者ベースで集計するための日次訪問ログ。
--
-- 設計:
--   - `(date, visitor_id)` の UNIQUE 制約により、同一訪問者が同日に複数回ヒット
--     しても 1 行のみ保持される（API 側で `INSERT ... ON CONFLICT DO NOTHING`
--     相当の upsert を実行）。
--   - `visitor_id` は HttpOnly Cookie `bon_log_visitor_id` の UUID（個人特定不可
--     な opaque ID）を格納。IP・User-Agent 等の PII は格納しない。
--   - `user_id` は認証時のみバックフィル。User 削除時は SET NULL（ログイン履歴
--     としての訪問記録は残す方針）。
--
-- 冪等化: `IF NOT EXISTS` / `DROP POLICY IF EXISTS` で複数回適用しても安全。

-- ------------------------------------------------------------
-- テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "daily_visitors" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "visitor_id" VARCHAR(64) NOT NULL,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_visitors_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- インデックス
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "daily_visitors_date_visitor_id_key"
    ON "daily_visitors"("date", "visitor_id");

CREATE INDEX IF NOT EXISTS "daily_visitors_date_idx"
    ON "daily_visitors"("date");

CREATE INDEX IF NOT EXISTS "daily_visitors_user_id_idx"
    ON "daily_visitors"("user_id");

-- ------------------------------------------------------------
-- 外部キー（PostgreSQL は制約に IF NOT EXISTS をサポートしないため
-- DO ブロックで duplicate_object を握り潰す）
-- ------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE "daily_visitors"
        ADD CONSTRAINT "daily_visitors_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- RLS 有効化（冪等）
-- ------------------------------------------------------------
ALTER TABLE public.daily_visitors ENABLE ROW LEVEL SECURITY;

-- 書き込み・読み取りはともに service_role 経由（Prisma）のみで実行される前提。
-- anon/authenticated への公開ポリシーは作らないことで、デフォルトの deny に
-- 任せる（admin 集計クエリは Prisma が DB owner として実行するため RLS をバイパス）。
