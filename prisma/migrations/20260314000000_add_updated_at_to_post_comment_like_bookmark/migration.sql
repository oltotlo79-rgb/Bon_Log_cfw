-- AlterTable: posts に updated_at を追加
ALTER TABLE "posts" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: comments に updated_at を追加
ALTER TABLE "comments" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: likes に updated_at を追加
ALTER TABLE "likes" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: bookmarks に updated_at を追加
ALTER TABLE "bookmarks" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
