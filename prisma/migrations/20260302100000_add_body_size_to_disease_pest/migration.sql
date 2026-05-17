-- AlterTable: disease_pests に体長カラムを追加
ALTER TABLE "disease_pests" ADD COLUMN "body_size_min_mm" DOUBLE PRECISION;
ALTER TABLE "disease_pests" ADD COLUMN "body_size_max_mm" DOUBLE PRECISION;
