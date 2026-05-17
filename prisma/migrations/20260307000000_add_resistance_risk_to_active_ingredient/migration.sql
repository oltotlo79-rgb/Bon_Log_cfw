-- CreateEnum: ResistanceRisk (耐性のつきやすさ)
CREATE TYPE "ResistanceRisk" AS ENUM ('low', 'medium', 'high');

-- AlterTable: active_ingredients に resistance_risk を追加
ALTER TABLE "active_ingredients" ADD COLUMN "resistance_risk" "ResistanceRisk";
