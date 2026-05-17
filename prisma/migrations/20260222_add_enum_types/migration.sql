-- CreateEnum: MediaType
CREATE TYPE "MediaType" AS ENUM ('image', 'video');

-- CreateEnum: NotificationType
CREATE TYPE "NotificationType" AS ENUM ('like', 'comment', 'follow', 'quote', 'reply', 'comment_like', 'follow_request', 'follow_request_approved', 'system', 'mention', 'message', 'repost', 'subscription_expiring');

-- CreateEnum: ReportTargetType
CREATE TYPE "ReportTargetType" AS ENUM ('post', 'comment', 'event', 'shop', 'review', 'user');

-- CreateEnum: ReportReason
CREATE TYPE "ReportReason" AS ENUM ('spam', 'inappropriate', 'harassment', 'copyright', 'other');

-- CreateEnum: ReportStatus
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed', 'auto_hidden');

-- CreateEnum: RequestStatus
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum: PaymentStatus
CREATE TYPE "PaymentStatus" AS ENUM ('succeeded', 'pending', 'failed');

-- CreateEnum: AdminRole
CREATE TYPE "AdminRole" AS ENUM ('admin', 'moderator');

-- CreateEnum: GenreType
CREATE TYPE "GenreType" AS ENUM ('post', 'shop');

-- AlterTable: post_media.type String -> MediaType
ALTER TABLE "post_media" ALTER COLUMN "type" TYPE "MediaType" USING "type"::"MediaType";

-- AlterTable: comment_media.type String -> MediaType
ALTER TABLE "comment_media" ALTER COLUMN "type" TYPE "MediaType" USING "type"::"MediaType";

-- AlterTable: scheduled_post_media.type - drop default, convert, set new default
ALTER TABLE "scheduled_post_media" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "scheduled_post_media" ALTER COLUMN "type" TYPE "MediaType" USING "type"::"MediaType";
ALTER TABLE "scheduled_post_media" ALTER COLUMN "type" SET DEFAULT 'image'::"MediaType";

-- AlterTable: draft_post_media.type - drop default, convert, set new default
ALTER TABLE "draft_post_media" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "draft_post_media" ALTER COLUMN "type" TYPE "MediaType" USING "type"::"MediaType";
ALTER TABLE "draft_post_media" ALTER COLUMN "type" SET DEFAULT 'image'::"MediaType";

-- AlterTable: notifications.type String -> NotificationType
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType" USING "type"::"NotificationType";

-- AlterTable: reports.target_type String -> ReportTargetType
ALTER TABLE "reports" ALTER COLUMN "target_type" TYPE "ReportTargetType" USING "target_type"::"ReportTargetType";

-- AlterTable: reports.reason String -> ReportReason
ALTER TABLE "reports" ALTER COLUMN "reason" TYPE "ReportReason" USING "reason"::"ReportReason";

-- AlterTable: reports.status - drop default, convert, set new default
ALTER TABLE "reports" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "reports" ALTER COLUMN "status" TYPE "ReportStatus" USING "status"::"ReportStatus";
ALTER TABLE "reports" ALTER COLUMN "status" SET DEFAULT 'pending'::"ReportStatus";

-- AlterTable: follow_requests.status - drop default, convert, set new default
ALTER TABLE "follow_requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "follow_requests" ALTER COLUMN "status" TYPE "RequestStatus" USING "status"::"RequestStatus";
ALTER TABLE "follow_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::"RequestStatus";

-- AlterTable: shop_change_requests.status - drop default, convert, set new default
ALTER TABLE "shop_change_requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "shop_change_requests" ALTER COLUMN "status" TYPE "RequestStatus" USING "status"::"RequestStatus";
ALTER TABLE "shop_change_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::"RequestStatus";

-- AlterTable: payments.status String -> PaymentStatus
ALTER TABLE "payments" ALTER COLUMN "status" TYPE "PaymentStatus" USING "status"::"PaymentStatus";

-- AlterTable: admin_users.role String -> AdminRole
ALTER TABLE "admin_users" ALTER COLUMN "role" TYPE "AdminRole" USING "role"::"AdminRole";

-- AlterTable: genres.type - drop default, convert, set new default
ALTER TABLE "genres" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "genres" ALTER COLUMN "type" TYPE "GenreType" USING "type"::"GenreType";
ALTER TABLE "genres" ALTER COLUMN "type" SET DEFAULT 'post'::"GenreType";

-- AddIndex: comment_media(comment_id)
CREATE INDEX IF NOT EXISTS "comment_media_comment_id_idx" ON "comment_media"("comment_id");

-- AddIndex: shop_review_images(review_id)
CREATE INDEX IF NOT EXISTS "shop_review_images_review_id_idx" ON "shop_review_images"("review_id");

-- AddIndex: bonsai_record_images(record_id)
CREATE INDEX IF NOT EXISTS "bonsai_record_images_record_id_idx" ON "bonsai_record_images"("record_id");

-- AddIndex: bonsai_shops(created_by)
CREATE INDEX IF NOT EXISTS "bonsai_shops_created_by_idx" ON "bonsai_shops"("created_by");

-- AddVarCharConstraints
ALTER TABLE "users" ALTER COLUMN "nickname" TYPE VARCHAR(50);
ALTER TABLE "users" ALTER COLUMN "email" TYPE VARCHAR(100);
ALTER TABLE "users" ALTER COLUMN "bio" TYPE VARCHAR(200);
ALTER TABLE "users" ALTER COLUMN "location" TYPE VARCHAR(100);
ALTER TABLE "events" ALTER COLUMN "title" TYPE VARCHAR(100);
ALTER TABLE "genres" ALTER COLUMN "name" TYPE VARCHAR(50);
ALTER TABLE "genres" ALTER COLUMN "category" TYPE VARCHAR(50);
ALTER TABLE "bonsai_shops" ALTER COLUMN "name" TYPE VARCHAR(100);
ALTER TABLE "bonsai_shops" ALTER COLUMN "phone" TYPE VARCHAR(20);
ALTER TABLE "contact_inquiries" ALTER COLUMN "name" TYPE VARCHAR(50);
ALTER TABLE "contact_inquiries" ALTER COLUMN "email" TYPE VARCHAR(100);
ALTER TABLE "contact_inquiries" ALTER COLUMN "subject" TYPE VARCHAR(100);
