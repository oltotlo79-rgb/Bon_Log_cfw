-- 手動作成: この環境は DB 未接続のため `prisma migrate dev` を実行できず、
-- schema.prisma の StorageDeletionJob / StorageDeletionJobStatus から
-- 手書きで DDL を起こしている。適用前に `npx prisma migrate diff` 等で schema との
-- 整合性を再確認すること。
--
-- ロールング デプロイ互換性:
-- - 本マイグレーションは追加のみ（新テーブル + 新 enum）で、既存カラムの変更・削除を含まない。
-- - 旧コード（本テーブル未参照）は、新スキーマ適用後もテーブルの存在を無視して従来通り動作する。
-- - 新コード（lib/services/account-deletion-service.ts の outbox 書き込み、
--   app/api/cron/process-storage-deletions の worker）は、本マイグレーションが
--   適用済みでないと起動時エラーになる（テーブルが存在しないため）。したがって
--   「本マイグレーション適用 → 新コードのデプロイ」の順序を厳守すること
--   （逆順で新コードを先にデプロイするとアカウント削除 API が 500 を返し続ける）。
-- - storage_deletion_jobs は users への FK を持たない（owner_user_id は監査用の
--   非 FK 値）。User 削除後もジョブ行が残る設計のため、FK cascade による
--   意図しない行削除は発生しない。

-- CreateEnum
-- enum ブロックの @@map 相当。Prisma が生成する実際の Postgres 型名は
-- スキーマ上の enum 名をそのまま使う（entitlement_provider 等の別 enum とは異なり
-- 本 enum は @map を付けていないため型名は "StorageDeletionJobStatus" になる）。
CREATE TYPE "StorageDeletionJobStatus" AS ENUM ('pending', 'processing', 'completed', 'dead_letter');

-- CreateTable
CREATE TABLE "storage_deletion_jobs" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "status" "StorageDeletionJobStatus" NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "locked_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_deletion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "storage_deletion_jobs_status_next_attempt_at_idx" ON "storage_deletion_jobs"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "storage_deletion_jobs_owner_user_id_idx" ON "storage_deletion_jobs"("owner_user_id");

-- RLS: storage_deletion_jobs は Prisma (postgres ロール) 経由のみアクセスを許可する。
-- anon / authenticated ロールへの GRANT は付与しない（Supabase Data API 非使用方針）。
-- 20260527000000_revoke_data_api_grants_from_public で ALTER DEFAULT PRIVILEGES が設定済みのため
-- 新テーブルへの自動 GRANT は発生しない。明示的な REVOKE は不要。
ALTER TABLE "storage_deletion_jobs" ENABLE ROW LEVEL SECURITY;
