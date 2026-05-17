-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ScheduledPostStatus" AS ENUM ('pending', 'published', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "password" TEXT,
    "nickname" TEXT NOT NULL,
    "avatar_url" TEXT,
    "header_url" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "bonsai_start_year" INTEGER,
    "bonsai_start_month" INTEGER,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_suspended" BOOLEAN NOT NULL DEFAULT false,
    "suspended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "premium_expires_at" TIMESTAMP(3),
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT,
    "quote_post_id" TEXT,
    "repost_post_id" TEXT,
    "bonsai_id" TEXT,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "hidden_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_media" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'post',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_genres" (
    "post_id" TEXT NOT NULL,
    "genre_id" TEXT NOT NULL,

    CONSTRAINT "post_genres_pkey" PRIMARY KEY ("post_id","genre_id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "content" TEXT NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "hidden_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_media" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "comment_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "post_id" TEXT,
    "comment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "follower_id" TEXT NOT NULL,
    "following_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","following_id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("blocker_id","blocked_id")
);

-- CreateTable
CREATE TABLE "mutes" (
    "muter_id" TEXT NOT NULL,
    "muted_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mutes_pkey" PRIMARY KEY ("muter_id","muted_id")
);

-- CreateTable
CREATE TABLE "follow_requests" (
    "id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "post_id" TEXT,
    "comment_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonsai_shops" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "phone" TEXT,
    "website" TEXT,
    "business_hours" TEXT,
    "closed_days" TEXT,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "hidden_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonsai_shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_genres" (
    "shop_id" TEXT NOT NULL,
    "genre_id" TEXT NOT NULL,

    CONSTRAINT "shop_genres_pkey" PRIMARY KEY ("shop_id","genre_id")
);

-- CreateTable
CREATE TABLE "shop_reviews" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "hidden_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_review_images" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "shop_review_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_change_requests" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_changes" JSONB NOT NULL,
    "reason" TEXT,
    "admin_comment" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "prefecture" TEXT,
    "city" TEXT,
    "venue" TEXT,
    "organizer" TEXT,
    "admission_fee" TEXT,
    "has_sales" BOOLEAN NOT NULL DEFAULT false,
    "external_url" TEXT,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "hidden_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "admin_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "report_count" INTEGER NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_at" TIMESTAMP(3),

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_payment_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'jpy',
    "status" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_posts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledPostStatus" NOT NULL DEFAULT 'pending',
    "published_post_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_post_media" (
    "id" TEXT NOT NULL,
    "scheduled_post_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'image',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "scheduled_post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_post_genres" (
    "scheduled_post_id" TEXT NOT NULL,
    "genre_id" TEXT NOT NULL,

    CONSTRAINT "scheduled_post_genres_pkey" PRIMARY KEY ("scheduled_post_id","genre_id")
);

-- CreateTable
CREATE TABLE "draft_posts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "draft_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_post_media" (
    "id" TEXT NOT NULL,
    "draft_post_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'image',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "draft_post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_post_genres" (
    "draft_post_id" TEXT NOT NULL,
    "genre_id" TEXT NOT NULL,

    CONSTRAINT "draft_post_genres_pkey" PRIMARY KEY ("draft_post_id","genre_id")
);

-- CreateTable
CREATE TABLE "hashtags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hashtags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_hashtags" (
    "post_id" TEXT NOT NULL,
    "hashtag_id" TEXT NOT NULL,

    CONSTRAINT "post_hashtags_pkey" PRIMARY KEY ("post_id","hashtag_id")
);

-- CreateTable
CREATE TABLE "bonsais" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT,
    "acquired_at" TIMESTAMP(3),
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonsais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonsai_records" (
    "id" TEXT NOT NULL,
    "bonsai_id" TEXT NOT NULL,
    "content" TEXT,
    "record_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonsai_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonsai_record_images" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bonsai_record_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_analytics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "profile_views" INTEGER NOT NULL DEFAULT 0,
    "post_views" INTEGER NOT NULL DEFAULT 0,
    "likes_received" INTEGER NOT NULL DEFAULT 0,
    "new_followers" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_email_token_key" ON "password_reset_tokens"("email", "token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_subscription_id_key" ON "users"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "posts_user_id_idx" ON "posts"("user_id");

-- CreateIndex
CREATE INDEX "posts_created_at_idx" ON "posts"("created_at");

-- CreateIndex
CREATE INDEX "posts_is_hidden_idx" ON "posts"("is_hidden");

-- CreateIndex
CREATE INDEX "posts_bonsai_id_idx" ON "posts"("bonsai_id");

-- CreateIndex
CREATE INDEX "posts_user_id_is_hidden_created_at_idx" ON "posts"("user_id", "is_hidden", "created_at" DESC);

-- CreateIndex
CREATE INDEX "comments_post_id_idx" ON "comments"("post_id");

-- CreateIndex
CREATE INDEX "comments_user_id_idx" ON "comments"("user_id");

-- CreateIndex
CREATE INDEX "likes_post_id_idx" ON "likes"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "likes_user_id_post_id_key" ON "likes"("user_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "likes_user_id_comment_id_key" ON "likes"("user_id", "comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_user_id_post_id_key" ON "bookmarks"("user_id", "post_id");

-- CreateIndex
CREATE INDEX "follows_follower_id_idx" ON "follows"("follower_id");

-- CreateIndex
CREATE INDEX "follows_following_id_idx" ON "follows"("following_id");

-- CreateIndex
CREATE INDEX "follow_requests_requester_id_idx" ON "follow_requests"("requester_id");

-- CreateIndex
CREATE INDEX "follow_requests_target_id_idx" ON "follow_requests"("target_id");

-- CreateIndex
CREATE INDEX "follow_requests_status_idx" ON "follow_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "follow_requests_requester_id_target_id_key" ON "follow_requests"("requester_id", "target_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "bonsai_shops_is_hidden_idx" ON "bonsai_shops"("is_hidden");

-- CreateIndex
CREATE INDEX "shop_reviews_is_hidden_idx" ON "shop_reviews"("is_hidden");

-- CreateIndex
CREATE INDEX "shop_change_requests_shop_id_idx" ON "shop_change_requests"("shop_id");

-- CreateIndex
CREATE INDEX "shop_change_requests_user_id_idx" ON "shop_change_requests"("user_id");

-- CreateIndex
CREATE INDEX "shop_change_requests_status_idx" ON "shop_change_requests"("status");

-- CreateIndex
CREATE INDEX "events_start_date_idx" ON "events"("start_date");

-- CreateIndex
CREATE INDEX "events_prefecture_idx" ON "events"("prefecture");

-- CreateIndex
CREATE INDEX "events_is_hidden_idx" ON "events"("is_hidden");

-- CreateIndex
CREATE INDEX "reports_target_type_target_id_idx" ON "reports"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "admin_notifications_is_read_idx" ON "admin_notifications"("is_read");

-- CreateIndex
CREATE INDEX "admin_notifications_is_resolved_idx" ON "admin_notifications"("is_resolved");

-- CreateIndex
CREATE INDEX "admin_notifications_created_at_idx" ON "admin_notifications"("created_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_payment_id_key" ON "payments"("stripe_payment_id");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_posts_published_post_id_key" ON "scheduled_posts"("published_post_id");

-- CreateIndex
CREATE INDEX "scheduled_posts_user_id_idx" ON "scheduled_posts"("user_id");

-- CreateIndex
CREATE INDEX "scheduled_posts_scheduled_at_idx" ON "scheduled_posts"("scheduled_at");

-- CreateIndex
CREATE INDEX "scheduled_posts_status_idx" ON "scheduled_posts"("status");

-- CreateIndex
CREATE INDEX "scheduled_post_media_scheduled_post_id_idx" ON "scheduled_post_media"("scheduled_post_id");

-- CreateIndex
CREATE INDEX "draft_posts_user_id_idx" ON "draft_posts"("user_id");

-- CreateIndex
CREATE INDEX "draft_post_media_draft_post_id_idx" ON "draft_post_media"("draft_post_id");

-- CreateIndex
CREATE UNIQUE INDEX "hashtags_name_key" ON "hashtags"("name");

-- CreateIndex
CREATE INDEX "hashtags_count_idx" ON "hashtags"("count");

-- CreateIndex
CREATE INDEX "bonsais_user_id_idx" ON "bonsais"("user_id");

-- CreateIndex
CREATE INDEX "bonsai_records_bonsai_id_idx" ON "bonsai_records"("bonsai_id");

-- CreateIndex
CREATE INDEX "bonsai_records_record_at_idx" ON "bonsai_records"("record_at");

-- CreateIndex
CREATE INDEX "user_analytics_user_id_idx" ON "user_analytics"("user_id");

-- CreateIndex
CREATE INDEX "user_analytics_date_idx" ON "user_analytics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "user_analytics_user_id_date_key" ON "user_analytics"("user_id", "date");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_quote_post_id_fkey" FOREIGN KEY ("quote_post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_repost_post_id_fkey" FOREIGN KEY ("repost_post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_bonsai_id_fkey" FOREIGN KEY ("bonsai_id") REFERENCES "bonsais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_genres" ADD CONSTRAINT "post_genres_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_genres" ADD CONSTRAINT "post_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_media" ADD CONSTRAINT "comment_media_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mutes" ADD CONSTRAINT "mutes_muter_id_fkey" FOREIGN KEY ("muter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mutes" ADD CONSTRAINT "mutes_muted_id_fkey" FOREIGN KEY ("muted_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_requests" ADD CONSTRAINT "follow_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_requests" ADD CONSTRAINT "follow_requests_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonsai_shops" ADD CONSTRAINT "bonsai_shops_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_genres" ADD CONSTRAINT "shop_genres_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "bonsai_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_genres" ADD CONSTRAINT "shop_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_reviews" ADD CONSTRAINT "shop_reviews_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "bonsai_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_reviews" ADD CONSTRAINT "shop_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_review_images" ADD CONSTRAINT "shop_review_images_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "shop_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_change_requests" ADD CONSTRAINT "shop_change_requests_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "bonsai_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_change_requests" ADD CONSTRAINT "shop_change_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_published_post_id_fkey" FOREIGN KEY ("published_post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_post_media" ADD CONSTRAINT "scheduled_post_media_scheduled_post_id_fkey" FOREIGN KEY ("scheduled_post_id") REFERENCES "scheduled_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_post_genres" ADD CONSTRAINT "scheduled_post_genres_scheduled_post_id_fkey" FOREIGN KEY ("scheduled_post_id") REFERENCES "scheduled_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_post_genres" ADD CONSTRAINT "scheduled_post_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_posts" ADD CONSTRAINT "draft_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_post_media" ADD CONSTRAINT "draft_post_media_draft_post_id_fkey" FOREIGN KEY ("draft_post_id") REFERENCES "draft_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_post_genres" ADD CONSTRAINT "draft_post_genres_draft_post_id_fkey" FOREIGN KEY ("draft_post_id") REFERENCES "draft_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_post_genres" ADD CONSTRAINT "draft_post_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_hashtags" ADD CONSTRAINT "post_hashtags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_hashtags" ADD CONSTRAINT "post_hashtags_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "hashtags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonsais" ADD CONSTRAINT "bonsais_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonsai_records" ADD CONSTRAINT "bonsai_records_bonsai_id_fkey" FOREIGN KEY ("bonsai_id") REFERENCES "bonsais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonsai_record_images" ADD CONSTRAINT "bonsai_record_images_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "bonsai_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_analytics" ADD CONSTRAINT "user_analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

