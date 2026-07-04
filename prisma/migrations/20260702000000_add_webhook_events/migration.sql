-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "event_id" VARCHAR(255) NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_event_id_key" ON "webhook_events"("provider", "event_id");

-- CreateIndex
CREATE INDEX "webhook_events_processed_at_idx" ON "webhook_events"("processed_at");

-- RLS: webhook_events は Prisma (postgres ロール) 経由のみアクセスを許可する。
-- anon / authenticated ロールへの GRANT は付与しない（Supabase Data API 非使用方針）。
-- 20260527000000_revoke_data_api_grants_from_public で ALTER DEFAULT PRIVILEGES が設定済みのため
-- 新テーブルへの自動 GRANT は発生しない。明示的な REVOKE は不要。
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
