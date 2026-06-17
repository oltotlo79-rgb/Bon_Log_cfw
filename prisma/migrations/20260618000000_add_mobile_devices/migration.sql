-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('android', 'ios');

-- CreateTable
CREATE TABLE "mobile_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mobile_devices_token_key" ON "mobile_devices"("token");

-- CreateIndex
CREATE INDEX "mobile_devices_user_id_idx" ON "mobile_devices"("user_id");

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: mobile_devices は Prisma (postgres ロール) 経由のみアクセスを許可する。
-- anon / authenticated ロールへの GRANT は付与しない（Supabase Data API 非使用方針）。
-- 20260527000000_revoke_data_api_grants_from_public で ALTER DEFAULT PRIVILEGES が設定済みのため
-- 新テーブルへの自動 GRANT は発生しない。明示的な REVOKE は不要。
ALTER TABLE "mobile_devices" ENABLE ROW LEVEL SECURITY;
