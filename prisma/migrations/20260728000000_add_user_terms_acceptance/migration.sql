-- AlterTable
-- 規約同意の証跡（新規登録時に必須。既存ユーザーは NULL のまま遡及しない = additive/nullable）。
-- ロールング デプロイ互換性: 旧コード（本カラム未参照）は新カラム追加後も無影響で動作し、
-- 新コード（本カラム参照）は旧スキーマ適用前でも当該カラムが NULL 前提の分岐で安全に動作しない
-- ため、必ず本マイグレーションを新コードのデプロイより先に適用すること。
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "terms_version" TEXT;
