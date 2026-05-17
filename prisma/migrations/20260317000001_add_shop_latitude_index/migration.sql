-- ================================================================
-- bonsai_shops.latitude インデックス追加
--
-- 目的:
--   getShops の sortBy='location' で使用する
--   ORDER BY latitude DESC NULLS LAST をインデックスで解決し、
--   シーケンシャルスキャンを排除する。
-- ================================================================

CREATE INDEX IF NOT EXISTS "bonsai_shops_latitude_idx"
ON "bonsai_shops" ("latitude" DESC NULLS LAST);
