-- ============================================================
-- hormone_techniques テーブルと RLS の整合
-- ============================================================
--
-- 背景:
--   `HormoneTechnique` モデルは schema.prisma に定義されているが、
--   過去に `prisma db push` で本番DBに直接反映されたため、
--   既存マイグレーションにテーブル作成 SQL が存在しない（schema drift）。
--   結果として:
--     - 本番DBにはテーブルが存在するが RLS が無効
--       （Supabase Security Advisor が "RLS Disabled in Public" を警告）
--     - フレッシュ環境への `prisma migrate deploy` ではテーブルが作成されない
--
-- 対処:
--   1. テーブル定義を `IF NOT EXISTS` で冪等に作成（既存環境では no-op）
--   2. インデックス・FK も同様に冪等化
--   3. RLS を有効化（重複適用しても安全）
--   4. 公開読み取りポリシーを `DROP IF EXISTS` → `CREATE` で再作成
--
-- ポリシー方針: 他の hormone_* テーブルと同じく公開読み取り（書き込みは
-- service_role 経由の Prisma のみ）。

-- ------------------------------------------------------------
-- テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "hormone_techniques" (
    "id" TEXT NOT NULL,
    "hormone_id" TEXT NOT NULL,
    "technique_name" VARCHAR(50) NOT NULL,
    "technique_name_en" VARCHAR(100),
    "technique_slug" VARCHAR(50) NOT NULL,
    "effect_type" VARCHAR(20) NOT NULL,
    "magnitude" VARCHAR(20) NOT NULL,
    "mechanism" TEXT,
    "practical_note" TEXT,
    "best_months" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hormone_techniques_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- インデックス
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "hormone_techniques_hormone_id_technique_slug_key"
    ON "hormone_techniques"("hormone_id", "technique_slug");

CREATE INDEX IF NOT EXISTS "hormone_techniques_hormone_id_idx"
    ON "hormone_techniques"("hormone_id");

CREATE INDEX IF NOT EXISTS "hormone_techniques_technique_slug_idx"
    ON "hormone_techniques"("technique_slug");

-- ------------------------------------------------------------
-- 外部キー（PostgreSQL は制約に IF NOT EXISTS をサポートしないため
-- DO ブロックで duplicate_object を握り潰す）
-- ------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE "hormone_techniques"
        ADD CONSTRAINT "hormone_techniques_hormone_id_fkey"
        FOREIGN KEY ("hormone_id") REFERENCES "hormone_types"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- RLS 有効化（冪等）
-- ------------------------------------------------------------
ALTER TABLE public.hormone_techniques ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 公開読み取りポリシー（他の hormone_* と同パターン）
-- 書き込みは service_role 経由（Prisma）のみで実行される前提のため
-- 明示的な write ポリシーは作らず、デフォルトの deny に任せる。
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read access to hormone_techniques"
    ON public.hormone_techniques;

CREATE POLICY "Allow read access to hormone_techniques"
    ON public.hormone_techniques
    FOR SELECT
    USING (true);
