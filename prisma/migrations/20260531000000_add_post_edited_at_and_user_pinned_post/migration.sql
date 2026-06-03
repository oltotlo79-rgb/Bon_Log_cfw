-- AlterTable: posts.edited_at（投稿後の編集日時。null は未編集）
ALTER TABLE "posts" ADD COLUMN "edited_at" TIMESTAMP(3);

-- AlterTable: users.pinned_post_id（プロフィール固定投稿。1 件・任意）
ALTER TABLE "users" ADD COLUMN "pinned_post_id" TEXT;

-- CreateIndex: 投稿削除時の ON DELETE SET NULL を seq scan させない
CREATE INDEX "users_pinned_post_id_idx" ON "users"("pinned_post_id");

-- AddForeignKey: users.pinned_post_id -> posts.id（投稿削除時は固定を自動解除）
ALTER TABLE "users" ADD CONSTRAINT "users_pinned_post_id_fkey" FOREIGN KEY ("pinned_post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
