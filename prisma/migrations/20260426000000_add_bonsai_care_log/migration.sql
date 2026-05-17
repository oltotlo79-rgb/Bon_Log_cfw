-- CreateEnum
CREATE TYPE "bonsai_care_type" AS ENUM ('pesticide', 'solid_fertilizer', 'liquid_fertilizer', 'rotate', 'shading', 'muro_in', 'muro_out', 'other');

-- CreateTable
CREATE TABLE "bonsai_care_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "bonsai_care_type" NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonsai_care_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bonsai_care_logs_user_id_performed_at_idx" ON "bonsai_care_logs"("user_id", "performed_at");

-- CreateIndex
CREATE INDEX "bonsai_care_logs_user_id_type_performed_at_idx" ON "bonsai_care_logs"("user_id", "type", "performed_at");

-- AddForeignKey
ALTER TABLE "bonsai_care_logs" ADD CONSTRAINT "bonsai_care_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS (matching pattern of bonsais / bonsai_records: service_role 経由のみアクセス)
ALTER TABLE public.bonsai_care_logs ENABLE ROW LEVEL SECURITY;
