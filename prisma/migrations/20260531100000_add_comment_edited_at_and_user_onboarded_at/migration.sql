-- AlterTable: comments.edited_at（コメント編集日時。null は未編集）
ALTER TABLE "comments" ADD COLUMN "edited_at" TIMESTAMP(3);

-- AlterTable: users.onboarded_at（初回オンボーディング完了日時。null は未完了）
ALTER TABLE "users" ADD COLUMN "onboarded_at" TIMESTAMP(3);
