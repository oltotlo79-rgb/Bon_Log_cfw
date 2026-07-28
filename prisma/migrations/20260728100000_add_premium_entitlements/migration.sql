-- 手動作成: この環境は DB 未接続のため `prisma migrate dev` を実行できず、
-- schema.prisma の PremiumEntitlement / EntitlementProvider / EntitlementStatus から
-- 手書きで DDL を起こしている。適用前に `npx prisma migrate diff` 等で schema との
-- 整合性を再確認すること。
--
-- ロールング デプロイ互換性:
-- - 本マイグレーションは追加のみ（新テーブル + 新 enum）で、既存カラムの変更・削除を含まない。
-- - 旧コード（本テーブル未参照）は、新スキーマ適用後もテーブルの存在を無視して従来通り動作する
--   （users.is_premium / users.premium_expires_at を直接読み書きし続けるだけで、
--   premium_entitlements の有無に影響されない）。
-- - 新コード（本テーブルを参照する webhook/cron）は、本マイグレーションが適用済みでないと
--   起動時エラーになる（テーブルが存在しないため）。したがって
--   「本マイグレーション適用 → 新コードのデプロイ」の順序を厳守すること
--   （逆順で新コードを先にデプロイすると webhook 処理が 500 を返し続ける）。
-- - 適用後、直ちに `prisma/scripts/backfill-premium-entitlements-2026-07.ts --apply` を
--   実行して既存 Stripe/legacy ユーザーの entitlement 行を作成する
--   （backfill 未実行の間は premium_entitlements が空でも users.is_premium は従来値のまま
--   参照され続けるため、Web ユーザーの見え方に即座の影響はない。backfill 完了までは
--   新コードの OR 集約ロジックが「entitlement 0 件」を根拠に isPremium を false へ
--   上書きしないよう、webhook 側は「対象 provider の entitlement が無ければ作成する」
--   upsert 方式のため安全。ただし cron の期限切れスイープは premium_entitlements 側のみを
--   見るため、backfill 未実行のユーザーは cron による自動失効の対象から漏れる。
--   デプロイ手順として migration 適用 → backfill --apply → 新コードデプロイの順を推奨する）。

-- CreateEnum
-- enum ブロックの @@map("entitlement_provider") により、Prisma が生成する実際の
-- Postgres 型名は snake_case になる（PascalCase の Prisma 型名とは異なる。
-- 既存の bonsai_care_type 等と同じ命名規則）。
CREATE TYPE "entitlement_provider" AS ENUM ('stripe', 'revenuecat', 'legacy');

-- CreateEnum
CREATE TYPE "entitlement_status" AS ENUM ('active', 'expired', 'inactive');

-- CreateTable
CREATE TABLE "premium_entitlements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "entitlement_provider" NOT NULL,
    "provider_ref" TEXT,
    "product_id" TEXT,
    "status" "entitlement_status" NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "provider_event_at" TIMESTAMP(3),
    "last_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "premium_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "premium_entitlements_user_id_provider_key" ON "premium_entitlements"("user_id", "provider");

-- CreateIndex
CREATE INDEX "premium_entitlements_provider_provider_ref_idx" ON "premium_entitlements"("provider", "provider_ref");

-- CreateIndex
CREATE INDEX "premium_entitlements_status_expires_at_idx" ON "premium_entitlements"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "premium_entitlements" ADD CONSTRAINT "premium_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: premium_entitlements は Prisma (postgres ロール) 経由のみアクセスを許可する。
-- anon / authenticated ロールへの GRANT は付与しない（Supabase Data API 非使用方針）。
-- 20260527000000_revoke_data_api_grants_from_public で ALTER DEFAULT PRIVILEGES が設定済みのため
-- 新テーブルへの自動 GRANT は発生しない。明示的な REVOKE は不要。
ALTER TABLE "premium_entitlements" ENABLE ROW LEVEL SECURITY;
